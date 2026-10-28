import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Wifi,
  WifiOff,
  Radio,
  Sliders,
  Activity,
  Gauge,
  AlertTriangle,
  Zap,
  Film,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Globe,
  RefreshCw,
  Laptop,
  SquarePlay,
  Link2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card } from "./Card";
import { Button } from "./Field";

export interface LadderTier {
  label: string;
  mbps: number;
  blur: number;
  badgeClass: string;
  resText: string;
}

export const LADDER: LadderTier[] = [
  { label: "240p", mbps: 0.35, blur: 4.5, badgeClass: "bg-red-500/20 text-red-400 border-red-500/40", resText: "426×240" },
  { label: "360p", mbps: 0.75, blur: 2.6, badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40", resText: "640×360" },
  { label: "480p", mbps: 1.50, blur: 1.3, badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", resText: "854×480" },
  { label: "720p", mbps: 3.00, blur: 0.4, badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/40", resText: "1280×720" },
  { label: "1080p", mbps: 6.00, blur: 0, badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", resText: "1920×1080" },
];

export interface NetworkPreset {
  id: string;
  name: string;
  desc: string;
  icon: typeof Wifi;
  bandwidthMbps: number;
  rttMs: number;
  jitterMs: number;
  lossPercent: number;
  protocol: "tcp" | "udp" | "quic";
  udpRecovery: "none" | "arq" | "fec";
}

export const NETWORK_PRESETS: NetworkPreset[] = [
  {
    id: "good-wifi",
    name: "Good Wi-Fi",
    desc: "5 GHz Home / Office (15 Mbps, 18ms, 0.1% loss)",
    icon: Wifi,
    bandwidthMbps: 15.0,
    rttMs: 18,
    jitterMs: 2,
    lossPercent: 0.1,
    protocol: "tcp",
    udpRecovery: "none",
  },
  {
    id: "bad-wifi",
    name: "Bad Wi-Fi",
    desc: "Congested 2.4 GHz Weak Signal (1.2 Mbps, 190ms, 7.5% loss)",
    icon: WifiOff,
    bandwidthMbps: 1.2,
    rttMs: 190,
    jitterMs: 40,
    lossPercent: 7.5,
    protocol: "tcp",
    udpRecovery: "none",
  },
  {
    id: "cellular-4g",
    name: "4G Mobile",
    desc: "Cellular with Moderate Jitter (4.2 Mbps, 70ms, 1.8% loss)",
    icon: Radio,
    bandwidthMbps: 4.2,
    rttMs: 70,
    jitterMs: 18,
    lossPercent: 1.8,
    protocol: "quic",
    udpRecovery: "none",
  },
  {
    id: "tunnel",
    name: "Tunnel / Deadzone",
    desc: "Severe Obstruction (0.28 Mbps, 450ms, 18% loss)",
    icon: AlertTriangle,
    bandwidthMbps: 0.28,
    rttMs: 450,
    jitterMs: 70,
    lossPercent: 18.0,
    protocol: "tcp",
    udpRecovery: "none",
  },
  {
    id: "fiber",
    name: "Gigabit Fiber",
    desc: "Pristine High-Bandwidth (40.0 Mbps, 8ms, 0% loss)",
    icon: Zap,
    bandwidthMbps: 40.0,
    rttMs: 8,
    jitterMs: 1,
    lossPercent: 0.0,
    protocol: "tcp",
    udpRecovery: "none",
  },
];

const SAMPLE_VIDEOS = [
  { id: "bbb", name: "Big Buck Bunny (Action)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { id: "tos", name: "Tears of Steel (Sci-Fi)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" },
  { id: "oceans", name: "Oceans (Nature)", url: "https://vjs.zencdn.net/v/oceans.mp4" },
];

export interface YouTubePreset {
  id: string;
  name: string;
  category: string;
}

export const YOUTUBE_PRESETS: YouTubePreset[] = [
  { id: "aqz-KE-bpKQ", name: "Big Buck Bunny (Official 4K)", category: "Benchmark" },
  { id: "LXb3EKWsInQ", name: "4K Planet Earth Landscapes", category: "Nature" },
  { id: "jfKfPfyJRdk", name: "Lofi Beats Live Stream", category: "Music" },
  { id: "DDU-rZs8C4w", name: "NASA ISS Orbit Timelapse", category: "Space" },
  { id: "R6MlUcmOul8", name: "Tears of Steel (Sci-Fi 4K)", category: "Action" },
];

export function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "aqz-KE-bpKQ";
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export interface LiveEvent {
  id: string;
  t: number;
  type: "abr" | "stall" | "resume" | "network" | "glitch";
  title: string;
  detail: string;
}

export function InteractiveVideoLab() {
  // Network parameters state
  const [activePreset, setActivePreset] = useState<string>("good-wifi");
  const [bandwidthMbps, setBandwidthMbps] = useState(15.0);
  const [rttMs, setRttMs] = useState(18);
  const [jitterMs, setJitterMs] = useState(2);
  const [lossPercent, setLossPercent] = useState(0.1);
  const [protocol, setProtocol] = useState<"tcp" | "udp" | "quic">("tcp");
  const [udpRecovery, setUdpRecovery] = useState<"none" | "arq" | "fec">("none");
  const [abrStrategy, setAbrStrategy] = useState<"throughput" | "buffer">("throughput");

  // Video source state (YouTube / Procedural HUD / Web Video)
  const [videoMode, setVideoMode] = useState<"youtube" | "stream" | "procedural">("youtube");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(SAMPLE_VIDEOS[0].url);
  const [selectedYoutubeId, setSelectedYoutubeId] = useState("aqz-KE-bpKQ");
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Playback & simulation engine state
  const [isPlaying, setIsPlaying] = useState(true);
  const [bufferS, setBufferS] = useState(8.0);
  const [playerState, setPlayerState] = useState<"startup" | "playing" | "stalled">("playing");
  const [activeTier, setActiveTier] = useState<LadderTier>(LADDER[4]); // 1080p
  const [nextTier, setNextTier] = useState<LadderTier>(LADDER[4]);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [effectiveThroughput, setEffectiveThroughput] = useState(15.0);
  const [simTime, setSimTime] = useState(0);
  const [stallCount, setStallCount] = useState(0);
  const [totalStallDuration, setTotalStallDuration] = useState(0);
  const [qualitySwitches, setQualitySwitches] = useState(0);
  const [qoeScore, setQoeScore] = useState(96);
  const [isGlitching, setIsGlitching] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  // Real-time chart telemetry
  const [telemetry, setTelemetry] = useState<
    { t: number; bandwidth: number; effectiveThroughput: number; bitrate: number; buffer: number }[]
  >([]);

  // Real Wi-Fi Active Probe State
  const [networkMode, setNetworkMode] = useState<"presets" | "real-wifi">("presets");
  const [isProbing, setIsProbing] = useState(false);
  const [lastProbe, setLastProbe] = useState<{
    mbps: number;
    rtt: number;
    time: string;
    location?: string;
  } | null>(null);

  // Refs for animation & loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  // YouTube iFrame API Controller via postMessage
  const postToYouTube = useCallback(
    (func: "playVideo" | "pauseVideo" | "seekTo" | "mute" | "unMute", args: unknown[] = []) => {
      try {
        if (ytIframeRef.current?.contentWindow) {
          ytIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "*"
          );
        }
      } catch {
        // cross-origin safety
      }
    },
    []
  );

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    postToYouTube(nextMuted ? "mute" : "unMute");
  };

  // Mutable engine reference for the tick interval
  const engineRef = useRef({
    simTime: 0,
    bufferS: 8.0,
    playerState: "playing" as "startup" | "playing" | "stalled",
    activeTier: LADDER[4],
    nextTier: LADDER[4],
    chunkProgressBits: 0,
    chunkTotalBits: LADDER[4].mbps * 1e6 * 4.0, // 4s segment
    chunkIndex: 0,
    stallCount: 0,
    totalStallDuration: 0,
    qualitySwitches: 0,
    recentThroughputs: [15.0, 15.0, 15.0],
    lastGlitchAt: 0,
  });

  const addEvent = useCallback((event: LiveEvent) => {
    setEvents((prev) => [event, ...prev.slice(0, 19)]);
  }, []);

  // Real Network Probe via HTTP edge fetch
  const runRealNetworkProbe = useCallback(async () => {
    setIsProbing(true);
    try {
      // 1. Measure real RTT (ping) to public edge
      const t0 = performance.now();
      const pingResp = await fetch("https://speed.cloudflare.com/__down?bytes=0&_=" + Date.now(), {
        cache: "no-store",
      });
      const tPing = Math.round(performance.now() - t0);
      const city = pingResp.headers.get("cf-meta-city") || "";
      const country = pingResp.headers.get("cf-meta-country") || "";
      const location = city && country ? `${city}, ${country}` : "";

      // 2. Measure real throughput (fetch 150KB chunk)
      const t1 = performance.now();
      const chunkBytes = 150000;
      const dlResp = await fetch(`https://speed.cloudflare.com/__down?bytes=${chunkBytes}&_=${Date.now()}`, {
        cache: "no-store",
      });
      await dlResp.blob();
      const tDl = (performance.now() - t1) / 1000;
      let measuredMbps = Math.max(0.2, Math.round(((chunkBytes * 8) / tDl / 1e6) * 10) / 10);

      // Check navigator.connection if available
      const navConn = (navigator as unknown as { connection?: { downlink?: number; rtt?: number } }).connection;
      if (navConn?.downlink && navConn.downlink > 0) {
        measuredMbps = Math.round(((measuredMbps + navConn.downlink) / 2) * 10) / 10;
      }

      const measuredRtt = Math.max(5, tPing);
      const measuredJitter = Math.max(1, Math.round(measuredRtt * 0.12));
      const estLoss = measuredRtt > 220 ? 6.0 : measuredRtt > 120 ? 2.5 : 0.1;

      setBandwidthMbps(measuredMbps);
      setRttMs(measuredRtt);
      setJitterMs(measuredJitter);
      setLossPercent(estLoss);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastProbe({
        mbps: measuredMbps,
        rtt: measuredRtt,
        time: timeStr,
        location,
      });

      addEvent({
        id: Math.random().toString(),
        t: engineRef.current.simTime,
        type: "network",
        title: "Real Wi-Fi Active Measurement",
        detail: `Measured real throughput: ${measuredMbps} Mbps · Ping: ${measuredRtt}ms ${location ? `· ${location}` : ""}.`,
      });
    } catch {
      setBandwidthMbps(0.1);
      setRttMs(450);
      setLossPercent(20);
      addEvent({
        id: Math.random().toString(),
        t: engineRef.current.simTime,
        type: "network",
        title: "Real Wi-Fi Unreachable",
        detail: "Unable to probe public speed edge. Check your internet connection or Airplane Mode.",
      });
    } finally {
      setIsProbing(false);
    }
  }, [addEvent]);

  // Periodic Real-Wi-Fi probe hook
  useEffect(() => {
    if (networkMode !== "real-wifi") return;

    void runRealNetworkProbe();

    const id = window.setInterval(() => {
      void runRealNetworkProbe();
    }, 3500);

    const navConn = (navigator as unknown as { connection?: EventTarget }).connection;
    const onConnChange = () => {
      void runRealNetworkProbe();
    };
    navConn?.addEventListener?.("change", onConnChange);

    return () => {
      window.clearInterval(id);
      navConn?.removeEventListener?.("change", onConnChange);
    };
  }, [networkMode, runRealNetworkProbe]);

  // Apply a preset
  const applyPreset = (preset: NetworkPreset) => {
    setActivePreset(preset.id);
    setBandwidthMbps(preset.bandwidthMbps);
    setRttMs(preset.rttMs);
    setJitterMs(preset.jitterMs);
    setLossPercent(preset.lossPercent);
    setProtocol(preset.protocol);
    setUdpRecovery(preset.udpRecovery);

    addEvent({
      id: Math.random().toString(),
      t: engineRef.current.simTime,
      type: "network",
      title: `Switched network: ${preset.name}`,
      detail: `${preset.bandwidthMbps} Mbps · ${preset.rttMs}ms RTT · ${preset.lossPercent}% loss`,
    });
  };

  // Quick switch from Good WiFi to Bad WiFi (and vice-versa)
  const toggleGoodBadWifi = () => {
    if (activePreset === "good-wifi") {
      const bad = NETWORK_PRESETS.find((p) => p.id === "bad-wifi")!;
      applyPreset(bad);
    } else {
      const good = NETWORK_PRESETS.find((p) => p.id === "good-wifi")!;
      applyPreset(good);
    }
  };

  // Reset simulation session
  const resetSimulation = () => {
    const s = engineRef.current;
    s.simTime = 0;
    s.bufferS = 8.0;
    s.playerState = "playing";
    s.activeTier = LADDER[4];
    s.nextTier = LADDER[4];
    s.chunkProgressBits = 0;
    s.chunkTotalBits = LADDER[4].mbps * 1e6 * 4.0;
    s.chunkIndex = 0;
    s.stallCount = 0;
    s.totalStallDuration = 0;
    s.qualitySwitches = 0;
    s.recentThroughputs = [bandwidthMbps, bandwidthMbps];

    setSimTime(0);
    setBufferS(8.0);
    setPlayerState("playing");
    setActiveTier(LADDER[4]);
    setNextTier(LADDER[4]);
    setChunkProgress(0);
    setStallCount(0);
    setTotalStallDuration(0);
    setQualitySwitches(0);
    setQoeScore(96);
    setTelemetry([]);
    setEvents([
      {
        id: "init",
        t: 0,
        type: "network",
        title: "Simulation Initialized",
        detail: "Starting playback with 8.0s startup buffer at 1080p.",
      },
    ]);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    postToYouTube("seekTo", [0, true]);
    postToYouTube("playVideo");
  };

  // --- Main Simulation Tick Loop (runs every 100ms) ---
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      postToYouTube("pauseVideo");
      return;
    } else {
      if (engineRef.current.playerState === "playing") {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
        postToYouTube("playVideo");
      }
    }

    const SEGMENT_S = 4.0;
    const MAX_BUFFER_S = 30.0;
    const RESUME_THRESHOLD_S = 4.0;
    const DT = 0.1; // 100ms

    const intervalId = window.setInterval(() => {
      const eng = engineRef.current;
      eng.simTime += DT;

      // 1. Calculate Instantaneous Effective Throughput based on Network & Protocol
      const lossFraction = lossPercent / 100.0;
      let jitterOffset = (Math.random() - 0.5) * (jitterMs / 40.0) * bandwidthMbps * 0.25;
      let rawCapacity = Math.max(0.1, bandwidthMbps + jitterOffset);

      let effThroughput = rawCapacity;

      if (protocol === "tcp") {
        // TCP Reno AIMD penalty: loss causes window halving + RTT retransmission delays
        if (lossFraction > 0.0001) {
          // Mathis formula approximation penalty
          const mathisFactor = Math.min(
            1.0,
            1.2 / ((rttMs / 1000.0) * Math.sqrt(lossFraction) * 12.0 + 0.15)
          );
          effThroughput = Math.max(0.08, rawCapacity * Math.min(1.0, mathisFactor));
        }
      } else if (protocol === "udp") {
        if (udpRecovery === "none") {
          // Full bandwidth delivery, but packet loss produces real-time visual glitch
          effThroughput = rawCapacity;
          if (lossFraction > 0.02 && Math.random() < lossFraction * 0.8) {
            setIsGlitching(true);
            eng.lastGlitchAt = eng.simTime;
            setTimeout(() => setIsGlitching(false), 160);
          }
        } else if (udpRecovery === "arq") {
          // ARQ Retransmissions cost 1 RTT round trip
          const retransPenalty = 1.0 / (1.0 + lossFraction * 2.5 * (rttMs / 100.0));
          effThroughput = Math.max(0.1, rawCapacity * retransPenalty);
        } else if (udpRecovery === "fec") {
          // FEC adds 50% parity overhead to data
          effThroughput = rawCapacity * 0.67;
        }
      } else if (protocol === "quic") {
        // QUIC: Multiplexed, fast 1-RTT loss recovery, no HoL blocking
        const quicPenalty = 1.0 / (1.0 + Math.sqrt(lossFraction) * 0.6 * (rttMs / 200.0));
        effThroughput = Math.max(0.15, rawCapacity * quicPenalty);
      }

      setEffectiveThroughput(effThroughput);

      // 2. Playback Buffer Depletion / Stall State Machine
      if (eng.playerState === "playing") {
        eng.bufferS = Math.max(0, eng.bufferS - DT);

        // Check for buffer underrun
        if (eng.bufferS <= 0.01) {
          eng.bufferS = 0;
          eng.playerState = "stalled";
          eng.stallCount += 1;
          setPlayerState("stalled");
          setStallCount(eng.stallCount);

          if (videoRef.current) {
            videoRef.current.pause();
          }
          postToYouTube("pauseVideo");

          addEvent({
            id: Math.random().toString(),
            t: eng.simTime,
            type: "stall",
            title: `BUFFER STALL #${eng.stallCount}`,
            detail: `Buffer drained to 0.0s! Freezing video. Waiting to rebuild ${RESUME_THRESHOLD_S}s buffer.`,
          });
        }
      } else if (eng.playerState === "stalled") {
        eng.totalStallDuration += DT;
        setTotalStallDuration(eng.totalStallDuration);

        // Resume when buffer reaches threshold
        if (eng.bufferS >= RESUME_THRESHOLD_S) {
          eng.playerState = "playing";
          setPlayerState("playing");

          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
          postToYouTube("playVideo");

          addEvent({
            id: Math.random().toString(),
            t: eng.simTime,
            type: "resume",
            title: "Rebuffer Complete",
            detail: `Buffer restored to ${eng.bufferS.toFixed(1)}s (>= ${RESUME_THRESHOLD_S}s threshold). Resuming playback.`,
          });
        }
      }

      // 3. Segment Download Progress
      if (eng.bufferS < MAX_BUFFER_S) {
        const bitsDelivered = effThroughput * 1e6 * DT;
        eng.chunkProgressBits += bitsDelivered;

        if (eng.chunkProgressBits >= eng.chunkTotalBits) {
          // Segment download finished!
          eng.bufferS = Math.min(MAX_BUFFER_S, eng.bufferS + SEGMENT_S);
          eng.chunkIndex += 1;
          eng.chunkProgressBits = 0;

          // Push to recent throughputs for ABR estimation
          eng.recentThroughputs.push(effThroughput);
          if (eng.recentThroughputs.length > 5) eng.recentThroughputs.shift();

          const avgThroughput =
            eng.recentThroughputs.reduce((a, b) => a + b, 0) / eng.recentThroughputs.length;

          // Next chunk ABR decision
          let selectedTier = LADDER[0];

          if (abrStrategy === "throughput") {
            // Pick highest tier whose bitrate <= 0.85 * measured throughput
            const safeRate = avgThroughput * 0.85;
            for (const tier of LADDER) {
              if (tier.mbps <= safeRate) {
                selectedTier = tier;
              }
            }
          } else {
            // Buffer-based (BBA-0):
            // Reservoir: 6.0s (<= 6s picks 240p)
            // Cushion: 20.0s (>= 20s picks 1080p)
            if (eng.bufferS <= 6.0) {
              selectedTier = LADDER[0];
            } else if (eng.bufferS >= 20.0) {
              selectedTier = LADDER[LADDER.length - 1];
            } else {
              const fraction = (eng.bufferS - 6.0) / 14.0;
              const idx = Math.min(
                LADDER.length - 1,
                Math.max(0, Math.floor(fraction * LADDER.length))
              );
              selectedTier = LADDER[idx];
            }
          }

          // Check if quality switched
          if (selectedTier.label !== eng.activeTier.label) {
            eng.qualitySwitches += 1;
            setQualitySwitches(eng.qualitySwitches);

            const isUpgrade = selectedTier.mbps > eng.activeTier.mbps;
            addEvent({
              id: Math.random().toString(),
              t: eng.simTime,
              type: "abr",
              title: `ABR ${isUpgrade ? "Upshift" : "Downshift"}: ${selectedTier.label}`,
              detail: `${isUpgrade ? "Bandwidth headroom available" : "Throughput dropped below tier"}. Switched from ${eng.activeTier.label} to ${selectedTier.label} (${selectedTier.mbps} Mbps).`,
            });
          }

          eng.activeTier = selectedTier;
          eng.nextTier = selectedTier;
          eng.chunkTotalBits = selectedTier.mbps * 1e6 * SEGMENT_S;

          setActiveTier(selectedTier);
          setNextTier(selectedTier);
        }

        const pct = Math.min(100, (eng.chunkProgressBits / eng.chunkTotalBits) * 100);
        setChunkProgress(pct);
      }

      // 4. Update QoE Score
      // QoE = 100 - (stall penalty) - (switch penalty) - (low bitrate penalty)
      const avgBitratePenalty = (6.0 - eng.activeTier.mbps) * 2.5;
      const stallPenalty = eng.stallCount * 6.0 + eng.totalStallDuration * 4.0;
      const switchPenalty = eng.qualitySwitches * 1.5;
      const computedQoE = Math.max(
        5,
        Math.min(100, Math.round(100 - avgBitratePenalty - stallPenalty - switchPenalty))
      );
      setQoeScore(computedQoE);

      // 5. Update React states
      setSimTime(eng.simTime);
      setBufferS(eng.bufferS);

      // 6. Push to Telemetry array (keep last 35 points)
      setTelemetry((prev) => {
        const nextPoint = {
          t: Math.round(eng.simTime * 10) / 10,
          bandwidth: Math.round(bandwidthMbps * 10) / 10,
          effectiveThroughput: Math.round(effThroughput * 10) / 10,
          bitrate: eng.activeTier.mbps,
          buffer: Math.round(eng.bufferS * 10) / 10,
        };
        const updated = [...prev, nextPoint];
        return updated.length > 40 ? updated.slice(updated.length - 40) : updated;
      });
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [
    isPlaying,
    bandwidthMbps,
    rttMs,
    jitterMs,
    lossPercent,
    protocol,
    udpRecovery,
    abrStrategy,
    addEvent,
    postToYouTube,
  ]);

  // --- Procedural Canvas Rendering (High-tech 60fps dynamic video fallback) ---
  useEffect(() => {
    if (videoMode !== "procedural") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // Clear with dark cinematic space gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "#080a10");
      bgGrad.addColorStop(0.5, "#0e1320");
      bgGrad.addColorStop(1, "#05070a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw Retro Perspective Moving Cyber-Grid
      const horizonY = h * 0.52;
      ctx.strokeStyle = playerState === "stalled" ? "rgba(229, 34, 43, 0.25)" : "rgba(15, 111, 222, 0.35)";
      ctx.lineWidth = 1.5;

      const offset = (frame * (playerState === "stalled" ? 0.3 : 3.5)) % 40;

      // Horizontal moving grid lines
      for (let y = horizonY; y < h; y += 4) {
        const perspective = Math.pow((y - horizonY) / (h - horizonY), 2.2);
        const curY = horizonY + perspective * (h - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(w, curY);
        ctx.stroke();
      }

      // Vanishing point radial grid lines
      const vanishingX = w / 2;
      for (let x = -w * 0.8; x <= w * 1.8; x += 60) {
        ctx.beginPath();
        ctx.moveTo(vanishingX, horizonY);
        ctx.lineTo(x + (offset * 2 - 40), h);
        ctx.stroke();
      }

      // Draw glowing neon sun / horizon orb
      const sunGrad = ctx.createRadialGradient(vanishingX, horizonY, 5, vanishingX, horizonY, 80);
      sunGrad.addColorStop(0, playerState === "stalled" ? "rgba(255, 60, 60, 0.8)" : "rgba(20, 160, 255, 0.9)");
      sunGrad.addColorStop(0.5, playerState === "stalled" ? "rgba(255, 30, 30, 0.3)" : "rgba(15, 111, 222, 0.3)");
      sunGrad.addColorStop(1, "transparent");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(vanishingX, horizonY, 80, 0, Math.PI * 2);
      ctx.fill();

      // Audio-style equalizer spectrum bars on horizon
      const numBars = 32;
      const barW = 8;
      const barGap = 6;
      const startX = vanishingX - (numBars * (barW + barGap)) / 2;
      for (let i = 0; i < numBars; i++) {
        const freq = Math.sin(frame * 0.08 + i * 0.4) * 0.5 + 0.5;
        const barH = playerState === "stalled" ? 4 : freq * 36 + 6;
        ctx.fillStyle = playerState === "stalled" ? "#e5222b" : "#3ddc84";
        ctx.fillRect(startX + i * (barW + barGap), horizonY - barH, barW, barH);
      }

      // Center Stream Identity Emblem & Resolution Tag
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `STREAMLENS LIVE STREAM [${activeTier.label} - ${activeTier.resText}]`,
        w / 2,
        horizonY - 70
      );

      ctx.font = "13px monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fillText(
        `FRAME #${frame} | PROTOCOL: ${protocol.toUpperCase()} | TARGET BITRATE: ${activeTier.mbps} Mbps`,
        w / 2,
        horizonY - 45
      );

      // If Glitching on UDP packet loss
      if (isGlitching) {
        ctx.fillStyle = "rgba(255, 0, 80, 0.35)";
        const sliceY = Math.random() * h;
        const sliceH = Math.random() * 40 + 10;
        ctx.fillRect(0, sliceY, w, sliceH);

        // Draw RGB shift
        ctx.fillStyle = "rgba(0, 255, 255, 0.25)";
        ctx.fillRect(Math.random() * 20 - 10, sliceY + 5, w, sliceH / 2);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [videoMode, activeTier, playerState, protocol, isGlitching]);

  return (
    <div className="space-y-6">
      {/* Network Switcher Ribbon (Focus: Good WiFi -> Bad WiFi & Real-World Probe) */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-semibold text-text">Network Mode & Telemetry</h2>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {networkMode === "real-wifi" ? "Live Real-World Wi-Fi" : "Dynamic Simulation"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              Choose between simulated network conditions or drive the video with your physical computer's actual Wi-Fi connection.
            </p>
          </div>

          {/* Mode Switcher: Simulated Models vs Real-World Wi-Fi */}
          <div className="flex rounded-lg border border-border bg-surface-alt p-1 shrink-0">
            <button
              onClick={() => {
                setNetworkMode("presets");
                const good = NETWORK_PRESETS.find((p) => p.id === "good-wifi")!;
                applyPreset(good);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                networkMode === "presets"
                  ? "bg-surface text-primary shadow-xs ring-1 ring-border"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Simulated Presets</span>
            </button>
            <button
              onClick={() => setNetworkMode("real-wifi")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                networkMode === "real-wifi"
                  ? "bg-surface text-primary shadow-xs ring-1 ring-border"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-accent" />
              <span>📡 Live Real Wi-Fi Probe</span>
            </button>
          </div>
        </div>

        {/* If Simulated Presets Mode */}
        {networkMode === "presets" ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-text-muted">Preset Scenarios:</span>
              <button
                onClick={toggleGoodBadWifi}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs ${
                  activePreset === "good-wifi"
                    ? "bg-warning-bg text-warning border border-warning/40 hover:bg-warning/20"
                    : "bg-success-bg text-success border border-success/40 hover:bg-success/20"
                }`}
              >
                {activePreset === "good-wifi" ? (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>Switch to Bad Wi-Fi (1.2 Mbps)</span>
                    <TrendingDown className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Switch to Good Wi-Fi (15 Mbps)</span>
                    <TrendingUp className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {NETWORK_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                        : "border-border bg-surface-alt/40 hover:border-border/80 hover:bg-surface-alt"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-text-muted"}`} />
                        <span className="text-xs font-semibold">{preset.name}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <span className="mt-1 font-mono text-[11px] text-text-muted">
                      {preset.bandwidthMbps} Mbps · {preset.lossPercent}% loss
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Real Wi-Fi Live Probe Dashboard */
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    Actual Wi-Fi Telemetry Active
                    {lastProbe?.location && (
                      <span className="text-xs font-normal text-text-muted">({lastProbe.location})</span>
                    )}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Probing real download throughput & ping to Cloudflare Edge every 3.5s across your physical network card.
                  </p>
                </div>
              </div>

              <button
                onClick={() => void runRealNetworkProbe()}
                disabled={isProbing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-surface px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProbing ? "animate-spin" : ""}`} />
                {isProbing ? "Measuring Link..." : "Retest Link Now"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="rounded-lg bg-surface border border-border p-2.5">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Real Wi-Fi Throughput</span>
                <p className="text-xl font-bold font-mono text-accent mt-0.5">
                  {lastProbe ? lastProbe.mbps.toFixed(1) : bandwidthMbps.toFixed(1)}{" "}
                  <span className="text-xs font-normal text-text-muted">Mbps</span>
                </p>
              </div>
              <div className="rounded-lg bg-surface border border-border p-2.5">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Real Ping (RTT)</span>
                <p className="text-xl font-bold font-mono text-emerald-500 mt-0.5">
                  {lastProbe ? lastProbe.rtt : rttMs}{" "}
                  <span className="text-xs font-normal text-text-muted">ms</span>
                </p>
              </div>
              <div className="rounded-lg bg-surface border border-border p-2.5">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Measured Jitter</span>
                <p className="text-xl font-bold font-mono text-text mt-0.5">
                  ±{jitterMs}{" "}
                  <span className="text-xs font-normal text-text-muted">ms</span>
                </p>
              </div>
              <div className="rounded-lg bg-surface border border-border p-2.5">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Last Probe Timestamp</span>
                <p className="text-sm font-semibold font-mono text-text mt-1.5 truncate">
                  {lastProbe ? lastProbe.time : "Connecting..."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-accent/20 text-[11px] text-text-muted">
              <span className="flex items-center gap-1.5 font-medium text-text">
                <Laptop className="h-3.5 w-3.5 text-accent" />
                How to test: Switch Wi-Fi networks on your computer (e.g. to phone 4G Hotspot), or open Chrome DevTools (F12) &gt; Network &gt; Throttling &gt; 'Fast 3G' / 'Slow 3G'.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Simulation Stage: Video Player & Controls Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: The Cinematic Video Display (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
            {/* 1. Procedural High-Tech Video Stream */}
            {videoMode === "procedural" ? (
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                className="h-full w-full object-cover transition-all duration-300"
                style={{
                  filter: `blur(${activeTier.blur}px)`,
                  imageRendering: activeTier.blur > 2 ? "pixelated" : "auto",
                }}
              />
            ) : videoMode === "stream" ? (
              /* 2. HTML5 Video Element */
              <video
                ref={videoRef}
                src={selectedVideoUrl}
                crossOrigin="anonymous"
                loop
                muted={isMuted}
                playsInline
                autoPlay
                className="h-full w-full object-cover transition-all duration-300"
                style={{
                  filter: `blur(${activeTier.blur}px)`,
                  imageRendering: activeTier.blur > 2 ? "pixelated" : "auto",
                }}
              />
            ) : (
              /* 3. Real YouTube Embedded Player */
              <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
                <iframe
                  ref={ytIframeRef}
                  key={selectedYoutubeId}
                  src={`https://www.youtube-nocookie.com/embed/${selectedYoutubeId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&playsinline=1&loop=1&playlist=${selectedYoutubeId}&modestbranding=1&rel=0`}
                  title="Real YouTube Simulation Stream"
                  className="h-full w-full pointer-events-none transition-all duration-300 scale-[1.01]"
                  style={{
                    filter: `blur(${activeTier.blur}px)`,
                    imageRendering: activeTier.blur > 2 ? "pixelated" : "auto",
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            {/* UDP Unrecovered Packet Loss Glitch Canvas Overlay */}
            {isGlitching && (
              <div className="pointer-events-none absolute inset-0 z-10 bg-red-500/20 mix-blend-color-dodge animate-pulse">
                <div className="absolute top-1/4 h-8 w-full bg-cyan-400/30 -skew-x-12" />
                <div className="absolute top-2/3 h-12 w-full bg-rose-500/30 skew-x-6" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded bg-black/80 px-2 py-1 font-mono text-xs font-bold text-red-400 border border-red-500">
                    UDP PACKET LOSS ARTIFACT (NO ARQ)
                  </span>
                </div>
              </div>
            )}

            {/* In-Video HUD: Top Bar */}
            <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between">
              {/* Active Resolution Badge & Next Chunk Anticipation */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md shadow-lg transition-all ${activeTier.badgeClass}`}
                >
                  <span className="flex h-2 w-2 rounded-full bg-current animate-ping" />
                  <span className="font-mono text-xs font-bold">{activeTier.label}</span>
                  <span className="text-[11px] opacity-80">({activeTier.mbps} Mbps)</span>
                  <span className="hidden font-mono text-[10px] opacity-60 sm:inline">
                    [{activeTier.resText}]
                  </span>
                </div>
                {nextTier.label !== activeTier.label && (
                  <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-black/60 px-2.5 py-1.5 backdrop-blur-md text-[11px] font-mono text-amber-300">
                    <span className="text-zinc-400">Next:</span>
                    <span className="font-bold">{nextTier.label}</span>
                  </div>
                )}
              </div>

              {/* Protocol Badge & Ping */}
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-black/60 px-3 py-1.5 backdrop-blur-md text-xs text-white shadow-lg font-mono">
                <span className="font-bold text-primary">{protocol.toUpperCase()}</span>
                {protocol === "udp" && <span className="text-[10px] text-text-muted">({udpRecovery})</span>}
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{rttMs}ms</span>
              </div>
            </div>

            {/* In-Video HUD: Playback Buffer Gauge (Bottom Bar) */}
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/75 p-3 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-400" />
                  <span>
                    Playback Buffer:{" "}
                    <strong
                      className={`font-mono text-sm ${
                        bufferS < 4.0 ? "text-red-400" : bufferS < 12.0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {bufferS.toFixed(1)}s
                    </strong>{" "}
                    <span className="text-zinc-400">/ 30.0s</span>
                  </span>
                </div>
                <div className="font-mono text-[11px] text-zinc-300">
                  Segment #{engineRef.current.chunkIndex} ({chunkProgress.toFixed(0)}%)
                </div>
              </div>

              {/* Buffer Bar Fill */}
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
                <div
                  className={`h-full transition-all duration-100 ${
                    bufferS < 4.0
                      ? "bg-red-500"
                      : bufferS < 10.0
                      ? "bg-amber-500"
                      : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  }`}
                  style={{ width: `${Math.min(100, (bufferS / 30.0) * 100)}%` }}
                />
              </div>

              <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>0s (Stall Zone)</span>
                <span>Resume: 4.0s</span>
                <span>Target: 20s+</span>
                <span>Cap: 30s</span>
              </div>
            </div>

            {/* Buffering Stall Overlay (Shown when buffer === 0) */}
            {playerState === "stalled" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
                  <AlertTriangle className="absolute inset-0 m-auto h-7 w-7 text-red-500 animate-pulse" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white tracking-wide">
                  BUFFER UNDERRUN &mdash; REBUFFERING
                </h3>
                <p className="mt-1 max-w-sm text-xs text-zinc-300">
                  Network bandwidth was insufficient to sustain the video stream. Video is paused until the
                  buffer refills to 4.0s.
                </p>
                <div className="mt-3 flex items-center gap-2 font-mono text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                  <span>Rebuilding:</span>
                  <strong>{bufferS.toFixed(1)}s</strong> / 4.0s
                  <span className="text-zinc-500">|</span>
                  <span>Stall time: {totalStallDuration.toFixed(1)}s</span>
                </div>
              </div>
            )}
          </div>

          {/* Video Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={isPlaying ? "secondary" : "primary"}
                onClick={() => setIsPlaying((p) => !p)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause Stream" : "Resume Stream"}
              </Button>
              <Button variant="ghost" onClick={resetSimulation}>
                <RotateCcw className="h-4 w-4" /> Reset Lab
              </Button>
              <Button variant="ghost" onClick={toggleMute} title={isMuted ? "Unmute Audio" : "Mute Audio"}>
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-text-muted" />
                ) : (
                  <Volume2 className="h-4 w-4 text-primary" />
                )}
                <span>{isMuted ? "Muted" : "Audio On"}</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Source:</span>
              <div className="flex rounded-lg border border-border bg-surface-alt p-0.5">
                <button
                  onClick={() => setVideoMode("youtube")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    videoMode === "youtube"
                      ? "bg-red-500/15 text-red-400 border border-red-500/30 shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <SquarePlay className="h-3.5 w-3.5 text-red-500" /> YouTube
                </button>
                <button
                  onClick={() => setVideoMode("procedural")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                    videoMode === "procedural"
                      ? "bg-surface text-primary shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <Sparkles className="h-3 w-3" /> HUD Canvas
                </button>
                <button
                  onClick={() => setVideoMode("stream")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                    videoMode === "stream"
                      ? "bg-surface text-primary shadow-xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <Film className="h-3 w-3" /> Web Video
                </button>
              </div>

              {videoMode === "youtube" && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedYoutubeId}
                    onChange={(e) => {
                      setSelectedYoutubeId(e.target.value);
                      setShowCustomInput(false);
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                  >
                    {YOUTUBE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowCustomInput((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors cursor-pointer ${
                      showCustomInput
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : "border-border bg-surface hover:bg-surface-alt text-text-muted"
                    }`}
                    title="Paste custom YouTube video URL or ID"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>Custom URL</span>
                  </button>
                </div>
              )}

              {videoMode === "stream" && (
                <select
                  value={selectedVideoUrl}
                  onChange={(e) => setSelectedVideoUrl(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                >
                  {SAMPLE_VIDEOS.map((v) => (
                    <option key={v.id} value={v.url}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Custom YouTube URL Input Drawer */}
          {videoMode === "youtube" && showCustomInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const extracted = extractYouTubeId(customYoutubeUrl);
                if (extracted) {
                  setSelectedYoutubeId(extracted);
                  setShowCustomInput(false);
                  addEvent({
                    id: Math.random().toString(),
                    t: engineRef.current.simTime,
                    type: "network",
                    title: "Custom YouTube Stream Mounted",
                    detail: `Video [${extracted}] mounted into real-time adaptive buffer simulation pipeline.`,
                  });
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-2.5 text-xs shadow-inner"
            >
              <SquarePlay className="h-4 w-4 text-red-500 shrink-0" />
              <input
                type="text"
                placeholder="Paste any YouTube URL or 11-char ID (e.g. https://www.youtube.com/watch?v=... or youtu.be/...)"
                value={customYoutubeUrl}
                onChange={(e) => setCustomYoutubeUrl(e.target.value)}
                className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                type="submit"
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 transition-colors cursor-pointer shrink-0"
              >
                Load Stream
              </button>
            </form>
          )}

          {/* Real-time QoE & Performance Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">QoE Score</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${
                  qoeScore >= 80 ? "text-emerald-500" : qoeScore >= 50 ? "text-amber-500" : "text-red-500"
                }`}
              >
                {qoeScore} <span className="text-xs font-normal text-text-muted">/ 100</span>
              </p>
              <span className="text-[10px] text-text-muted">Quality of Experience</span>
            </Card>

            <Card className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">Rebuffer Stalls</p>
              <p className={`mt-1 font-mono text-2xl font-bold ${stallCount > 0 ? "text-red-500" : "text-text"}`}>
                {stallCount} <span className="text-xs font-normal text-text-muted">({totalStallDuration.toFixed(1)}s)</span>
              </p>
              <span className="text-[10px] text-text-muted">Total freeze events</span>
            </Card>

            <Card className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">Effective Speed</p>
              <p className="mt-1 font-mono text-2xl font-bold text-accent">
                {effectiveThroughput.toFixed(1)}{" "}
                <span className="text-xs font-normal text-text-muted">Mbps</span>
              </p>
              <span className="text-[10px] text-text-muted">Post-loss throughput</span>
            </Card>

            <Card className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">ABR Switches</p>
              <p className="mt-1 font-mono text-2xl font-bold text-text">
                {qualitySwitches} <span className="text-xs font-normal text-text-muted">shifts</span>
              </p>
              <span className="text-[10px] text-text-muted">Ladder oscillations</span>
            </Card>
          </div>
        </div>

        {/* Right Column: Live Network Control Sliders (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text flex items-center gap-1.5 text-sm">
                  <Sliders className="h-4 w-4 text-primary" /> Live Network Parameters
                </h3>
                <span className="font-mono text-xs text-text-muted">
                  t = {simTime.toFixed(1)}s
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                Adjust sliders while the video runs to witness instant buffering & quality adaptation.
              </p>
            </div>

            {/* Bandwidth Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Bandwidth (Capacity)</span>
                <span className="font-mono font-bold text-primary tabular-nums">
                  {bandwidthMbps.toFixed(1)} Mbps
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="40.0"
                step="0.1"
                value={bandwidthMbps}
                onChange={(e) => {
                  setActivePreset("custom");
                  setBandwidthMbps(parseFloat(e.target.value));
                }}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>0.2 Mbps (Severe)</span>
                <span>10 Mbps</span>
                <span>40 Mbps (Fiber)</span>
              </div>
            </div>

            {/* Packet Loss Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Packet Loss Rate</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    lossPercent > 5 ? "text-red-500" : lossPercent > 1 ? "text-amber-500" : "text-emerald-500"
                  }`}
                >
                  {lossPercent.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="25.0"
                step="0.1"
                value={lossPercent}
                onChange={(e) => {
                  setActivePreset("custom");
                  setLossPercent(parseFloat(e.target.value));
                }}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>0% (Clean)</span>
                <span>5% (Cellular/Weak)</span>
                <span>25% (Heavy)</span>
              </div>
            </div>

            {/* RTT / Latency Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Latency (Round-Trip Time)</span>
                <span className="font-mono font-bold text-text tabular-nums">{rttMs} ms</span>
              </div>
              <input
                type="range"
                min="5"
                max="500"
                step="5"
                value={rttMs}
                onChange={(e) => {
                  setActivePreset("custom");
                  setRttMs(parseInt(e.target.value, 10));
                }}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>5 ms (LAN)</span>
                <span>100 ms</span>
                <span>500 ms (Satellite)</span>
              </div>
            </div>

            {/* Jitter Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Jitter (Delay Variance)</span>
                <span className="font-mono font-bold text-text tabular-nums">±{jitterMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={jitterMs}
                onChange={(e) => {
                  setActivePreset("custom");
                  setJitterMs(parseInt(e.target.value, 10));
                }}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
            </div>

            <hr className="border-border" />

            {/* Transport Protocol Select */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-text">Transport Protocol</span>
              <div className="grid grid-cols-3 gap-2">
                {(["tcp", "udp", "quic"] as const).map((proto) => (
                  <button
                    key={proto}
                    onClick={() => {
                      setActivePreset("custom");
                      setProtocol(proto);
                    }}
                    className={`rounded-lg border py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                      protocol === proto
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40"
                        : "border-border bg-surface hover:bg-surface-alt text-text-muted"
                    }`}
                  >
                    {proto}
                  </button>
                ))}
              </div>

              {/* Protocol info tip */}
              <p className="text-[11px] text-text-muted leading-relaxed">
                {protocol === "tcp" &&
                  "TCP Reno: Reliable & in-order. Packet loss triggers congestion window cuts and HoL blocking delays."}
                {protocol === "udp" &&
                  "UDP: Fast datagram delivery with zero handshake. Packet loss causes visual frame glitching when unrecovered."}
                {protocol === "quic" &&
                  "QUIC: UDP-based multiplexed transport with independent streams and 0-RTT/1-RTT handshake."}
              </p>

              {/* UDP Recovery Policy */}
              {protocol === "udp" && (
                <div className="mt-2 rounded-lg border border-border bg-surface-alt/50 p-2.5">
                  <span className="block text-[11px] font-medium text-text-muted mb-1.5">
                    UDP Recovery Policy:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["none", "arq", "fec"] as const).map((rec) => (
                      <button
                        key={rec}
                        onClick={() => setUdpRecovery(rec)}
                        className={`rounded px-2 py-1 text-[11px] font-medium uppercase ${
                          udpRecovery === rec
                            ? "bg-primary text-white"
                            : "bg-surface border border-border text-text-muted hover:text-text"
                        }`}
                      >
                        {rec}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ABR Algorithm Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-text">ABR Algorithm</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAbrStrategy("throughput")}
                  className={`rounded-lg border p-2 text-left transition-all ${
                    abrStrategy === "throughput"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                      : "border-border bg-surface text-text-muted hover:bg-surface-alt"
                  }`}
                >
                  <p className="text-xs font-semibold">Throughput-Based</p>
                  <p className="mt-0.5 text-[10px] text-text-muted">Bitrate ≤ 0.85 × throughput</p>
                </button>

                <button
                  onClick={() => setAbrStrategy("buffer")}
                  className={`rounded-lg border p-2 text-left transition-all ${
                    abrStrategy === "buffer"
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                      : "border-border bg-surface text-text-muted hover:bg-surface-alt"
                  }`}
                >
                  <p className="text-xs font-semibold">Buffer-Based (BBA-0)</p>
                  <p className="mt-0.5 text-[10px] text-text-muted">Bitrate = f(buffer occupancy)</p>
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Real-Time Rolling Telemetry Oscilloscope */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Real-Time Telemetry Oscilloscope
            </h3>
            <p className="text-xs text-text-muted">
              Live rolling window showing Bandwidth vs Effective Throughput vs Selected Bitrate vs Buffer
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0f6fde]" /> Bandwidth
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#e5222b]" /> Bitrate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#147a3f]" /> Buffer (s)
            </span>
          </div>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={telemetry} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" opacity={0.6} />
              <XAxis dataKey="t" unit="s" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
              <YAxis
                yAxisId="mbps"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                width={35}
                unit="M"
              />
              <YAxis
                yAxisId="buffer"
                orientation="right"
                domain={[0, 30]}
                tick={{ fontSize: 10, fill: "#147a3f" }}
                width={30}
                unit="s"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Line
                yAxisId="mbps"
                type="monotone"
                dataKey="bandwidth"
                name="Network Bandwidth (Mbps)"
                stroke="#0f6fde"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="mbps"
                type="stepAfter"
                dataKey="bitrate"
                name="Playing Bitrate (Mbps)"
                stroke="#e5222b"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="buffer"
                type="monotone"
                dataKey="buffer"
                name="Playback Buffer (s)"
                stroke="#147a3f"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {/* Stall threshold reference line */}
              <ReferenceLine yAxisId="buffer" y={4.0} stroke="#ffb85c" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Live Event Diagnostics Stream */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Live Event & Decision Log
          </h3>
          <span className="text-xs text-text-muted">Logged as events trigger</span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="text-xs text-text-muted py-3">No events logged yet.</p>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt/40 p-2 text-xs transition-all"
              >
                <span className="shrink-0 font-mono text-[11px] text-text-muted pt-0.5">
                  [{evt.t.toFixed(1)}s]
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    evt.type === "stall"
                      ? "bg-red-500/20 text-red-500 border border-red-500/30"
                      : evt.type === "resume"
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                      : evt.type === "abr"
                      ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                      : "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                  }`}
                >
                  {evt.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text">{evt.title}</p>
                  <p className="text-text-muted text-[11px]">{evt.detail}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
