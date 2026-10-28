"""
Playback buffer simulation.

The buffer holds *seconds of video* that have been downloaded but not yet
played.

* ``add(seconds)`` is called when a segment finishes downloading.
* ``advance(t)`` moves wall-clock time forward; while the player is playing the
  level falls by 1 s per second of wall-clock time. It can never go negative:
  when it reaches zero the player enters the ``stalled`` state (a rebuffering
  event) - unless all content has already been played, in which case playback
  simply ends.
* Playback starts when the level first reaches ``startup_s`` and resumes after a
  stall when it reaches ``resume_s`` (or when no more content is coming).

All times are seconds; the first request is at t = 0 so ``startup_delay_s`` is
the user-visible time to first frame (handshake + request + download of the
startup buffer).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

EPS = 1e-9

STARTUP = "startup"
PLAYING = "playing"
STALLED = "stalled"
ENDED = "ended"


@dataclass
class BufferPoint:
    t: float
    level_s: float
    played_s: float
    state: str


@dataclass
class PlaybackBuffer:
    startup_s: float
    resume_s: float
    total_content_s: float
    t: float = 0.0
    level_s: float = 0.0
    played_s: float = 0.0
    content_added_s: float = 0.0
    state: str = STARTUP
    startup_delay_s: Optional[float] = None
    ended_at: Optional[float] = None
    stall_started_at: Optional[float] = None
    stalls: list[tuple[float, float]] = field(default_factory=list)  # (start, end)
    points: list[BufferPoint] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._record()

    # ------------------------------------------------------------------ internals
    def _record(self) -> None:
        self.points.append(BufferPoint(self.t, self.level_s, self.played_s, self.state))

    def _event(self, t: float, kind: str, detail: str) -> None:
        self.events.append({"t": round(t, 4), "type": kind, "detail": detail})

    @property
    def all_content_added(self) -> bool:
        return self.content_added_s >= self.total_content_s - EPS

    # --------------------------------------------------------------------- driving
    def advance(self, t_new: float) -> None:
        """Advance wall-clock time to ``t_new`` (>= current time)."""
        if t_new < self.t - EPS:
            raise ValueError("playback buffer cannot move backwards in time")
        dt = max(0.0, t_new - self.t)
        if dt > 0 and self.state == PLAYING:
            if self.level_s > dt + EPS:
                self.level_s -= dt
                self.played_s += dt
                self.t = t_new
            else:
                t_empty = self.t + self.level_s
                self.played_s += self.level_s
                self.level_s = 0.0
                self.t = t_empty
                if self.all_content_added:
                    self.state = ENDED
                    self.ended_at = t_empty
                    self._record()
                    self._event(t_empty, "playback_end", "all content played")
                else:
                    self.state = STALLED
                    self.stall_started_at = t_empty
                    self._record()
                    self._event(t_empty, "stall_start", "buffer empty: rebuffering")
                self.t = max(t_new, self.t)
        else:
            self.t = max(self.t, t_new)
        self._record()

    def add(self, seconds: float) -> None:
        """A segment of ``seconds`` of video became available at the current time."""
        if seconds < 0:
            raise ValueError("cannot add negative content")
        self.level_s += seconds
        self.content_added_s += seconds
        self._record()
        if self.state == STARTUP and (self.level_s >= self.startup_s - EPS or self.all_content_added):
            self._start_playing("startup")
        elif self.state == STALLED and (self.level_s >= self.resume_s - EPS or self.all_content_added):
            self._start_playing("resume")

    def _start_playing(self, why: str) -> None:
        if why == "startup":
            self.startup_delay_s = self.t
            self._event(self.t, "playback_start",
                        f"startup buffer reached ({self.level_s:.1f}s) after {self.t:.2f}s")
        else:
            assert self.stall_started_at is not None
            self.stalls.append((self.stall_started_at, self.t))
            self._event(self.t, "stall_end",
                        f"resumed after {self.t - self.stall_started_at:.2f}s stall")
            self.stall_started_at = None
        self.state = PLAYING
        self._record()

    def finish(self) -> None:
        """No more content is coming: play out whatever remains."""
        if self.state in (STARTUP, STALLED) and self.level_s > 0:
            self._start_playing("startup" if self.state == STARTUP else "resume")
        if self.state == PLAYING:
            self.advance(self.t + self.level_s)

    # ------------------------------------------------------------------ summaries
    @property
    def rebuffer_s(self) -> float:
        return sum(e - s for s, e in self.stalls)

    @property
    def rebuffer_events(self) -> int:
        return len(self.stalls)

    def sample(self, t: float) -> tuple[float, float, str]:
        """(level, played, state) at wall-clock ``t`` by interpolating recorded breakpoints."""
        pts = self.points
        if t <= pts[0].t:
            return pts[0].level_s, pts[0].played_s, pts[0].state
        last = pts[-1]
        if t >= last.t:
            return last.level_s, last.played_s, last.state
        lo, hi = 0, len(pts) - 1
        while hi - lo > 1:  # last breakpoint with time <= t
            mid = (lo + hi) // 2
            if pts[mid].t <= t:
                lo = mid
            else:
                hi = mid
        a = pts[lo]
        # take the final record at an identical timestamp
        while lo + 1 < len(pts) and pts[lo + 1].t <= a.t:
            lo += 1
            a = pts[lo]
        b = pts[lo + 1]
        if b.t - a.t <= EPS:
            return a.level_s, a.played_s, a.state
        f = (t - a.t) / (b.t - a.t)
        return (a.level_s + f * (b.level_s - a.level_s),
                a.played_s + f * (b.played_s - a.played_s), a.state)

    def average_level(self) -> float:
        """Time-weighted mean buffer level over [0, end of session]."""
        pts = self.points
        total = 0.0
        span = pts[-1].t - pts[0].t
        if span <= 0:
            return 0.0
        for a, b in zip(pts, pts[1:]):
            total += 0.5 * (a.level_s + b.level_s) * max(0.0, b.t - a.t)
        return total / span


def step_buffer(buf: PlaybackBuffer, t: float, added_s: float = 0.0) -> PlaybackBuffer:
    """Functional wrapper kept for the original module interface."""
    buf.advance(t)
    if added_s:
        buf.add(added_s)
    return buf
