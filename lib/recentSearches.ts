import type { SearchMode, JobStatus } from "@/lib/types";

export interface RecentSearch {
  jobId: string;
  title: string;
  location: string;
  mode: SearchMode;
  createdAt: string;
  status: JobStatus;
  statusMessage?: string;
  reqNumber?: string; // e.g. "2133-S1"
}

const KEY = "scout_recent_searches";

export function getRecentSearches(): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentSearch[];
  } catch {
    return [];
  }
}

export function updateRecentSearchStatus(
  jobId: string,
  status: JobStatus,
  statusMessage?: string
): void {
  try {
    const searches = getRecentSearches();
    const updated = searches.map(s =>
      s.jobId === jobId ? { ...s, status, statusMessage: statusMessage ?? s.statusMessage } : s
    );
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* localStorage unavailable */ }
}

/**
 * Given a base req number like "2133", returns the next available suffix,
 * e.g. "2133-S1" if no searches exist yet, "2133-S3" if S1 and S2 are taken.
 */
export function getNextReqNumber(baseReq: string): string {
  const trimmed = baseReq.trim();
  if (!trimmed) return "";
  const searches = getRecentSearches();
  // Find all searches that match this base req (e.g. "2133-S1", "2133-S2")
  const pattern = new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-S(\\d+)$`);
  const existing = searches
    .map(s => s.reqNumber)
    .filter((r): r is string => !!r && pattern.test(r))
    .map(r => parseInt(r.match(pattern)![1], 10));
  const next = existing.length === 0 ? 1 : Math.max(...existing) + 1;
  return `${trimmed}-S${next}`;
}

export function removeRecentSearch(jobId: string): void {
  try {
    const searches = getRecentSearches().filter(s => s.jobId !== jobId);
    localStorage.setItem(KEY, JSON.stringify(searches));
  } catch { /* localStorage unavailable */ }
}
