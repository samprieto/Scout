export type SearchMode = "quick" | "thorough" | "exhaustive";
export type JobStatus = "queued" | "running" | "complete" | "error";

export interface Candidate {
  name: string;
  current_title: string;
  current_company: string;
  location: string;
  profile_url: string;
  score: number;
  reason: string;
  skills?: string[];
  experience_years?: number;
}

export interface ScoutJob {
  id: string;
  created_at: string;
  title: string;
  location: string;
  context: string;
  mode: SearchMode;
  status: JobStatus;
  status_message: string | null;
  progress: number | null;
  results: Candidate[] | null;
  error: string | null;
  last_heartbeat_at: string | null;
  trigger_run_id: string | null;
}

export interface ModeConfig {
  label: string;
  description: string;
  duration: string;
  queries: number;
  maxProfiles: number;
  targetResults: number;
  rateDelayMs: number;
}

export const MODE_CONFIGS: Record<SearchMode, ModeConfig> = {
  quick: {
    label: "Quick Scan",
    description: "Fast search, top 10 candidates",
    duration: "~30 min",
    queries: 10,
    maxProfiles: 50,
    targetResults: 10,
    rateDelayMs: 30_000,
  },
  thorough: {
    label: "Deep Search",
    description: "Comprehensive search, top 20 candidates",
    duration: "~2-3 hours",
    queries: 30,
    maxProfiles: 150,
    targetResults: 20,
    rateDelayMs: 30_000,
  },
  exhaustive: {
    label: "Full Market Scan",
    description: "Exhaustive search, top 30 candidates",
    duration: "~12-24 hours",
    queries: 80,
    maxProfiles: 500,
    targetResults: 30,
    rateDelayMs: 30_000,
  },
};
