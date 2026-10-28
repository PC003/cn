/** Types mirroring the backend simulation engine's configuration and output. */

export interface Impairment {
  start_s: number;
  duration_s: number;
  bandwidth_scale: number;
  extra_loss: number;
  extra_rtt_ms: number;
}

export interface NetworkConfig {
  bandwidth_mbps: number;
  rtt_ms: number;
  jitter_ms: number;
  loss_probability: number;
  profile: "constant" | "random_walk" | "steps";
  variability: number;
  trace_interval_s: number;
  min_bandwidth_mbps: number;
  max_bandwidth_mbps: number | null;
  steps: [number, number][];
  impairments: Impairment[];
  queue_packets: number;
}

export type Protocol = "tcp" | "udp" | "quic";
export type UdpRecovery = "none" | "arq" | "fec";

export interface TransportConfig {
  protocol: Protocol;
  mss_bytes: number;
  init_cwnd_packets: number;
  rwnd_packets: number;
  handshake_rtts: number | null;
  min_rto_ms: number | null;
  slow_start_after_idle: boolean;
  quic_streams: number;
  udp_pacing_factor: number;
  udp_recovery: UdpRecovery;
  udp_max_repair_rounds: number;
  udp_fec_block: number;
  udp_fec_overhead: number;
  udp_on_incomplete: "accept" | "drop";
  udp_concealment_penalty: number;
}

export interface VideoConfig {
  duration_s: number;
  segment_s: number;
  ladder_mbps: number[];
  startup_buffer_s: number;
  max_buffer_s: number;
  rebuffer_resume_s: number;
}

export interface AbrConfig {
  strategy: "throughput" | "buffer";
  safety_factor: number;
  estimator_window: number;
  initial_level: number;
  reservoir_s: number;
  cushion_s: number;
}

export interface QoEConfig {
  rebuffer_ratio_penalty_per_pct: number;
  rebuffer_event_penalty: number;
  startup_penalty_per_s: number;
  startup_penalty_cap: number;
  switch_penalty_weight: number;
}

export interface SimConfig {
  seed: number;
  network: NetworkConfig;
  video: VideoConfig;
  transport: TransportConfig;
  abr: AbrConfig;
  qoe: QoEConfig;
  packet_trace_limit: number;
}

export interface DefaultsResponse {
  config: SimConfig;
  presets: Record<string, NetworkConfig>;
  ladder_labels: string[];
  sensitivity_parameters: Record<string, string>;
  max_trials: number;
}

export interface Metrics {
  protocol: Protocol;
  abr: string;
  seed: number;
  segments: number;
  startup_delay_s: number;
  rebuffer_s: number;
  rebuffer_events: number;
  rebuffer_ratio: number;
  avg_bitrate_mbps: number;
  avg_delivered_bitrate_mbps: number;
  bitrate_switches: number;
  mean_switch_magnitude_mbps: number;
  qoe: number;
  session_time_s: number;
  mean_download_s: number;
  mean_throughput_mbps: number;
  delivered_mb: number;
  mean_buffer_s: number;
  packets_sent: number;
  packets_lost: number;
  retransmissions: number;
  fast_retransmits: number;
  timeouts: number;
  hol_blocked_packet_s: number;
  hol_blocked_packets: number;
  reordered_packets: number;
  late_packets: number;
  incomplete_segments: number;
  mean_delivered_fraction: number;
}

export interface QoEBreakdown {
  score: number;
  raw_score: number;
  quality_term: number;
  rebuffer_penalty: number;
  startup_penalty: number;
  switch_penalty: number;
  avg_bitrate_mbps: number;
  startup_delay_s: number;
  rebuffer_s: number;
  rebuffer_events: number;
  rebuffer_ratio: number;
  bitrate_switches: number;
  weights: Record<string, number>;
}

export interface SegmentRow {
  segment?: number;
  segment_index?: number;
  level: number;
  label: string;
  bitrate_mbps: number;
  rule: string;
  reason: string;
  buffer_s: number;
  buffer_before_s: number;
  buffer_after_s: number;
  estimate_mbps: number | null;
  safe_mbps: number | null;
  throughput_mbps: number;
  size_megabits: number;
  size_bytes: number;
  t_request: number;
  t_complete: number;
  download_s: number;
  idle_wait_s: number;
  packets: number;
  packets_sent: number;
  packets_lost: number;
  retransmissions: number;
  fast_retransmits: number;
  timeouts: number;
  hol_blocked_packet_s: number;
  reordered_packets: number;
  delivered_fraction: number;
  quality_factor: number;
  cwnd_end: number | null;
}

export interface TimelinePoint {
  t: number;
  bandwidth_mbps: number;
  rtt_ms: number;
  loss_percent: number;
  buffer_s: number;
  played_s: number;
  state: "startup" | "playing" | "stalled" | "ended";
  playing_bitrate_mbps: number;
  downloading: boolean;
}

export interface SimEvent {
  t: number;
  type: string;
  detail: string;
}

export interface PacketRow {
  packet_id: number;
  segment: number;
  seq: number;
  send_time: number;
  arrival_time: number | null;
  lost: boolean;
  retransmitted: boolean;
  delivered: boolean;
  in_order: boolean;
}

export interface SessionResult {
  config: SimConfig;
  transport_label: string;
  metrics: Metrics;
  qoe: QoEBreakdown;
  segments: SegmentRow[];
  events: SimEvent[];
  timeline: TimelinePoint[];
  stalls: { start: number; end: number }[];
  packet_trace: PacketRow[];
  note: string;
}

export interface Summary {
  n: number;
  excluded: number;
  mean: number | null;
  std: number | null;
  ci_low: number | null;
  ci_high: number | null;
  ci_half_width: number | null;
  min: number | null;
  max: number | null;
}

export interface TrialsResult {
  protocol: string;
  abr: string;
  label?: string;
  n_requested: number;
  n_ok: number;
  excluded: { seed: number; reason: string }[];
  base_seed: number;
  ci_method: string;
  summary: Record<string, Summary>;
  per_trial: Record<string, number>[];
}

export interface CompareSingle {
  seed: number;
  runs: { label: string; protocol: Protocol; result: SessionResult }[];
}

export interface CompareTrials {
  n_trials: number;
  base_seed: number;
  variants: TrialsResult[];
}

export interface AbrCompare {
  seed: number;
  n_trials: number;
  runs: { strategy: string; result?: SessionResult; trials?: TrialsResult }[];
}

export interface SensitivityResult {
  parameter: string;
  parameter_label: string;
  protocol: string;
  abr: string;
  n_trials: number;
  points: {
    value: number;
    error?: string;
    n_ok?: number;
    excluded?: { seed: number; reason: string }[];
    summary?: Record<string, Summary>;
  }[];
}

export interface MathisRow {
  rtt_ms: number;
  loss_probability: number;
  excluded: boolean;
  reason?: string;
  transfer_packets?: number;
  expected_loss_events?: number;
  simulated_mbps?: number;
  simulated_ci_low?: number | null;
  simulated_ci_high?: number | null;
  simulated_std?: number;
  n?: number;
  mathis_mbps?: number;
  abs_error_mbps?: number;
  rel_error?: number | null;
  predicted_window_packets?: number;
  regime_ok?: boolean;
  warnings?: string[];
}

export interface MathisResult {
  formula: string;
  mss_bytes: number;
  n_trials: number;
  bandwidth_mbps: number;
  rows: MathisRow[];
  mean_abs_rel_error_valid_regime: number | null;
  n_valid_regime_points: number;
  caveats: string[];
}

export interface SweepResult {
  n_trials: number;
  cells: {
    rtt_ms: number;
    loss_probability: number;
    protocol: Protocol;
    n_ok: number;
    excluded: { seed: number; reason: string }[];
    summary: Record<string, Summary>;
  }[];
}
