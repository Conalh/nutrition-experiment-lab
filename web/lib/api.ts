/**
 * Tiny typed fetch wrapper over the FastAPI backend.
 * Dev: Next on :3000 talks to FastAPI on :8000. Prod: relative paths.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ─── Types (mirror nutrition_lab.models) ─────────────────────────────
export type ExperimentStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "abandoned";
export type Phase = "baseline" | "washout" | "intervention";
export type Adherence = "yes" | "partial" | "no" | "not_applicable";
export type Metric =
  | "hunger"
  | "energy"
  | "digestion"
  | "sleep_quality"
  | "training_performance"
  | "body_weight";
export type OutcomeKind = "rating" | "numeric" | "boolean";
export type OutcomeDirection =
  | "higher_better"
  | "lower_better"
  | "target_range";
export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type OutcomeResult =
  | "improved"
  | "worsened"
  | "unchanged"
  | "inconclusive";

export interface UserPublic {
  id: string;
  email: string;
  display_name: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  title: string;
  question: string;
  hypothesis: string | null;
  status: ExperimentStatus;
  baseline_start: string | null;
  baseline_end: string | null;
  washout_start: string | null;
  washout_end: string | null;
  intervention_start: string | null;
  intervention_end: string | null;
  primary_outcome: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Intervention {
  id: string;
  experiment_id: string;
  name: string;
  rule_text: string;
  category: string;
  expected_effect: string | null;
  safety_note: string | null;
}

export interface OutcomeDefinition {
  id: string;
  experiment_id: string;
  name: string;
  kind: OutcomeKind;
  direction: OutcomeDirection;
  metric: Metric | null;
  target_min: number | null;
  target_max: number | null;
  unit: string | null;
  is_primary: boolean;
}

export interface ExperimentDetail {
  experiment: Experiment;
  interventions: Intervention[];
  outcomes: OutcomeDefinition[];
}

export interface DailyLog {
  id: string;
  user_id: string;
  experiment_id: string;
  date: string;
  phase: Phase | null;
  adherence: Adherence | null;
  hunger: number | null;
  energy: number | null;
  digestion: number | null;
  sleep_quality: number | null;
  training_performance: number | null;
  body_weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Confounder {
  id: string;
  user_id: string;
  experiment_id: string;
  date: string;
  kind: string;
  severity: Severity;
  notes: string | null;
}

export interface SafetyWarning {
  code: string;
  message: string;
  severity: Severity;
}

export interface AdherenceResult {
  expected_days: number;
  logged_days: number;
  coverage: number;
  adherence_rate: number;
  trust: Confidence;
}

export interface OutcomeComparison {
  outcome_id: string;
  name: string;
  metric: Metric | null;
  kind: OutcomeKind;
  direction: OutcomeDirection;
  is_primary: boolean;
  baseline_mean: number | null;
  intervention_mean: number | null;
  baseline_n: number;
  intervention_n: number;
  absolute_change: number | null;
  percent_change: number | null;
  result: OutcomeResult;
}

export interface ConfounderFlag {
  code: string;
  message: string;
  severity: Severity;
}

export interface AnalysisResult {
  experiment_id: string;
  generated_at: string;
  adherence: AdherenceResult;
  comparisons: OutcomeComparison[];
  confounder_flags: ConfounderFlag[];
  confidence: Confidence;
  caveats: string[];
  recommendation: string;
}

export interface ReportMealExample {
  phase: Phase;
  description: string;
  tags: string[];
}

export interface Report {
  experiment_id: string;
  title: string;
  question: string;
  hypothesis: string | null;
  status: ExperimentStatus;
  baseline_start: string | null;
  baseline_end: string | null;
  intervention_start: string | null;
  intervention_end: string | null;
  adherence: AdherenceResult;
  confidence: Confidence;
  primary_outcome: OutcomeComparison | null;
  secondary_outcomes: OutcomeComparison[];
  what_changed: string[];
  what_did_not_change: string[];
  confounders: Confounder[];
  confounder_flags: ConfounderFlag[];
  meal_examples: ReportMealExample[];
  caveats: string[];
  recommendation: string;
  decision: string;
}

// ─── Endpoints ───────────────────────────────────────────────────────
export const api = {
  me: () => request<UserPublic>("/api/auth/me"),
  signup: (email: string, password: string, display_name?: string) =>
    request<UserPublic>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),
  login: (email: string, password: string) =>
    request<UserPublic>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  listExperiments: () => request<Experiment[]>("/api/experiments"),
  getExperiment: (id: string) =>
    request<ExperimentDetail>(`/api/experiments/${id}`),
  createExperiment: (body: Record<string, unknown>) =>
    request<Experiment>("/api/experiments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateExperiment: (id: string, body: Record<string, unknown>) =>
    request<Experiment>(`/api/experiments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteExperiment: (id: string) =>
    request(`/api/experiments/${id}`, { method: "DELETE" }),
  addIntervention: (id: string, body: Record<string, unknown>) =>
    request<Intervention>(`/api/experiments/${id}/interventions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteIntervention: (id: string) =>
    request(`/api/interventions/${id}`, { method: "DELETE" }),
  addOutcome: (id: string, body: Record<string, unknown>) =>
    request<OutcomeDefinition>(`/api/experiments/${id}/outcomes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateOutcome: (id: string, body: Record<string, unknown>) =>
    request<OutcomeDefinition>(`/api/outcomes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteOutcome: (id: string) =>
    request(`/api/outcomes/${id}`, { method: "DELETE" }),
  lifecycle: (id: string, action: string, body?: Record<string, unknown>) =>
    request<Experiment>(`/api/experiments/${id}/${action}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  checkSafety: (body: Record<string, unknown>) =>
    request<SafetyWarning[]>("/api/experiments/check-safety", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getDailyLog: (experimentId: string, date: string) =>
    request<DailyLog>(
      `/api/daily-log?experiment_id=${experimentId}&date=${date}`,
    ),
  upsertDailyLog: (body: Record<string, unknown>) =>
    request<DailyLog>("/api/daily-log", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addMeal: (logId: string, body: Record<string, unknown>) =>
    request(`/api/daily-log/${logId}/meals`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addConfounder: (id: string, body: Record<string, unknown>) =>
    request<Confounder>(`/api/experiments/${id}/confounders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listConfounders: (id: string) =>
    request<Confounder[]>(`/api/experiments/${id}/confounders`),
  analyze: (id: string) =>
    request<AnalysisResult>(`/api/experiments/${id}/analyze`, {
      method: "POST",
    }),
  getAnalysis: (id: string) =>
    request<AnalysisResult>(`/api/experiments/${id}/analysis`),
  getReport: (id: string) => request<Report>(`/api/experiments/${id}/report`),
  reportPdfUrl: (id: string) => `${API_BASE}/api/experiments/${id}/report.pdf`,
  seedDemo: () =>
    request<{ experiment_id: string }>("/api/demo", { method: "POST" }),
  exportAccount: () => request<Record<string, unknown>>("/api/account/export"),
  deleteAccountData: () =>
    request<{ deleted: Record<string, number> }>("/api/account/data", {
      method: "DELETE",
    }),
};

export { API_BASE };
