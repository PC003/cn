import type {
  AbrCompare,
  CompareSingle,
  CompareTrials,
  DefaultsResponse,
  MathisResult,
  SensitivityResult,
  SessionResult,
  SimConfig,
  SweepResult,
  TrialsResult,
  Protocol,
  UdpRecovery,
} from "../types/sim";

const API_BASE = "/api";

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ProjectInfoResponse {
  name: string;
  subtitle: string;
  report_title: string;
  phase: string;
  review_milestone: number;
  modules_scaffolded: string[];
}

export class ApiError extends Error {}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Request to ${path} failed with status ${res.status}`;
    try {
      const j = await res.json();
      if (j && typeof j.detail === "string") detail = j.detail;
    } catch {
      /* keep default message */
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  info: () => request<ProjectInfoResponse>("/info"),
  defaults: () => request<DefaultsResponse>("/defaults"),
  simulate: (config: SimConfig) => request<SessionResult>("/simulate", { config }),
  compare: (config: SimConfig, protocols: Protocol[], udpRecoveries: UdpRecovery[] | null, nTrials: number) =>
    request<CompareSingle | CompareTrials>("/compare", {
      config,
      protocols,
      udp_recoveries: udpRecoveries,
      n_trials: nTrials,
    }),
  trials: (config: SimConfig, nTrials: number) =>
    request<TrialsResult>("/trials", { config, n_trials: nTrials }),
  abrCompare: (config: SimConfig, nTrials: number) =>
    request<AbrCompare>("/abr-compare", { config, n_trials: nTrials }),
  sensitivity: (config: SimConfig, parameter: string, values: number[], nTrials: number) =>
    request<SensitivityResult>("/sensitivity", { config, parameter, values, n_trials: nTrials }),
  mathis: (lossValues: number[], rttValues: number[], nTrials: number) =>
    request<MathisResult>("/mathis", {
      loss_values: lossValues,
      rtt_ms_values: rttValues,
      n_trials: nTrials,
    }),
  sweep: (config: SimConfig, lossValues: number[], rttValues: number[], nTrials: number, protocols: Protocol[]) =>
    request<SweepResult>("/sweep", {
      config,
      loss_values: lossValues,
      rtt_ms_values: rttValues,
      n_trials: nTrials,
      protocols,
    }),
  /** Ask the backend export module to serialise data and trigger a browser download. */
  async download(
    format: "json" | "csv",
    filename: string,
    payload: { data?: unknown; rows?: Record<string, unknown>[] },
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, filename, ...payload }),
    });
    if (!res.ok) throw new ApiError(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
