"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecentSearches, removeRecentSearch } from "@/lib/recentSearches";
import type { RecentSearch } from "@/lib/recentSearches";
import { MODE_CONFIGS } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusBadge({ status }: { status: RecentSearch["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Complete
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
        Failed
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
        </span>
        Running
      </span>
    );
  }
  // queued
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
      </span>
      Queued
    </span>
  );
}

export default function RecentSearchBanner() {
  const router = useRouter();
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setSearches(getRecentSearches());
  }, []);

  function dismiss(jobId: string, e: React.MouseEvent) {
    e.stopPropagation();
    removeRecentSearch(jobId);
    setSearches(prev => prev.filter(s => s.jobId !== jobId));
  }

  if (searches.length === 0) return null;

  // Split into active (queued/running) and recent (complete/error)
  const active = searches.filter(s => s.status === "queued" || s.status === "running");
  const recent = searches.filter(s => s.status === "complete" || s.status === "error");

  return (
    <div className="space-y-3 mb-6">
      {/* Active searches — shown more prominently */}
      {active.map(search => (
        <div
          key={search.jobId}
          onClick={() => router.push(`/results/${search.jobId}`)}
          className="flex items-center gap-4 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-sky-100 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {search.reqNumber && (
                <span className="bg-white border border-sky-200 text-sky-700 font-mono font-bold text-xs px-2 py-0.5 rounded">
                  {search.reqNumber}
                </span>
              )}
              <span className="font-semibold text-sm text-gray-900">{search.title}</span>
              <span className="text-gray-400 text-sm">in</span>
              <span className="text-sky-600 font-medium text-sm">{search.location}</span>
              <StatusBadge status={search.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {MODE_CONFIGS[search.mode].label} · started {timeAgo(search.createdAt)}
              {search.statusMessage ? ` · ${search.statusMessage}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push(`/results/${search.jobId}`)}
              className="text-xs font-semibold text-sky-700 bg-white border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition-colors"
            >
              Resume →
            </button>
            <button
              onClick={e => dismiss(search.jobId, e)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Recent completed searches — shown as a compact list */}
      {recent.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Searches</span>
          </div>
          {recent.map(search => (
            <div
              key={search.jobId}
              onClick={() => router.push(`/results/${search.jobId}`)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {search.reqNumber && (
                    <span className="bg-gray-100 text-gray-600 font-mono font-bold text-xs px-2 py-0.5 rounded">
                      {search.reqNumber}
                    </span>
                  )}
                  <span className="font-medium text-sm text-gray-800">{search.title}</span>
                  <span className="text-gray-400 text-xs">in {search.location}</span>
                  <StatusBadge status={search.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {MODE_CONFIGS[search.mode].label} · {timeAgo(search.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">View →</span>
                <button
                  onClick={e => dismiss(search.jobId, e)}
                  className="text-gray-300 hover:text-gray-500 p-1 rounded"
                  title="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
