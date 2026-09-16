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

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  info: () => request<ProjectInfoResponse>("/info"),
};
