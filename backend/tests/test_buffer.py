import pytest

from app.simulation.buffer import ENDED, PLAYING, STALLED, STARTUP, PlaybackBuffer


def test_buffer_grows_on_add_and_depletes_while_playing():
    b = PlaybackBuffer(startup_s=4, resume_s=2, total_content_s=40)
    b.advance(1.0)
    b.add(2.0)
    assert b.state == STARTUP and b.level_s == 2.0
    b.advance(2.0)
    b.add(2.0)
    assert b.state == PLAYING and b.startup_delay_s == pytest.approx(2.0)
    assert b.level_s == pytest.approx(4.0)
    b.advance(5.0)  # 3 s of playback
    assert b.level_s == pytest.approx(1.0)
    assert b.played_s == pytest.approx(3.0)


def test_rebuffering_event_and_duration():
    b = PlaybackBuffer(startup_s=4, resume_s=2, total_content_s=40)
    b.advance(0.0)
    b.add(4.0)  # starts playing at t=0
    b.advance(7.0)  # buffer empties at t=4, stalled until 7
    assert b.state == STALLED
    assert b.level_s == 0.0
    b.add(2.0)
    assert b.state == PLAYING
    assert b.rebuffer_events == 1
    assert b.rebuffer_s == pytest.approx(3.0)


def test_buffer_never_negative_and_end_is_not_a_stall():
    b = PlaybackBuffer(startup_s=2, resume_s=2, total_content_s=4)
    b.advance(0.0)
    b.add(2.0)
    b.advance(1.0)
    b.add(2.0)
    b.advance(100.0)
    assert b.level_s == 0.0
    assert b.state == ENDED
    assert b.rebuffer_events == 0
    assert b.ended_at == pytest.approx(4.0)
    assert all(p.level_s >= 0 for p in b.points)


def test_cannot_move_backwards():
    b = PlaybackBuffer(2, 2, 10)
    b.advance(5.0)
    with pytest.raises(ValueError):
        b.advance(1.0)


def test_finish_plays_out_remaining_content_when_threshold_not_reached():
    b = PlaybackBuffer(startup_s=10, resume_s=10, total_content_s=4)
    b.advance(1.0)
    b.add(4.0)  # all content added but below startup threshold
    assert b.state == PLAYING  # all content in -> starts immediately
    b.finish()
    assert b.state == ENDED


def test_sample_interpolates():
    b = PlaybackBuffer(startup_s=2, resume_s=2, total_content_s=20)
    b.advance(0.0)
    b.add(10.0)
    b.advance(4.0)
    level, played, state = b.sample(2.0)
    assert level == pytest.approx(8.0) and played == pytest.approx(2.0) and state == PLAYING
