"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchMode } from "@/lib/types";
import { MODE_CONFIGS } from "@/lib/types";
import { getRecentSearches, getNextReqNumber } from "@/lib/recentSearches";
import type { RecentSearch } from "@/lib/recentSearches";

export default function SearchForm() {
  const router = useRouter();
  const [reqBase, setReqBase] = useState("");       // what the user types, e.g. "2133"
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<SearchMode>("quick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute a live preview of what the req number will become
  const reqPreview = reqBase.trim() ? getNextReqNumber(reqBase) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !location.trim()) return;
    setLoading(true);
    setError(null);

    // Lock in the req number at submit time (re-compute to avoid race)
    const reqNumber = reqBase.trim() ? getNextReqNumber(reqBase) : null;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, location, context, mode, reqNumber }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start search");

      // Persist job so the homepage can show a "resume" link if the tab is closed
      if (data.jobId) {
        try {
          const existing = getRecentSearches();
          const entry: RecentSearch = {
            jobId: data.jobId,
            title: title.trim(),
            location: location.trim(),
            mode,
            createdAt: new Date().toISOString(),
            status: "queued",
            statusMessage: "Queued...",
            reqNumber: reqNumber ?? undefined,
          };
          localStorage.setItem(
            "scout_recent_searches",
            JSON.stringify([entry, ...existing.filter(s => s.jobId !== data.jobId)].slice(0, 10))
          );
        } catch { /* localStorage unavailable */ }
      }

      router.push(`/results/${data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">

      {/* Req # */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Req # <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={reqBase}
            onChange={e => setReqBase(e.target.value)}
            placeholder="e.g. 2133"
            className="w-40 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {reqPreview && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">→</span>
              <span className="bg-sky-50 border border-sky-200 text-sky-700 font-mono font-semibold text-sm px-3 py-1.5 rounded-lg">
                {reqPreview}
              </span>
              <span className="text-xs text-gray-400">will be assigned</span>
            </div>
          )}
        </div>
      </div>

      {/* Role Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Role Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Financial Analyst"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          required
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Salt Lake City, Utah"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          required
        />
      </div>

      {/* Context */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Key Skills / Job Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Paste job description or list key skills (e.g. FP&A, Excel, SQL, CPA preferred)"
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
        />
      </div>

      {/* Search Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Search Mode</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(MODE_CONFIGS) as [SearchMode, typeof MODE_CONFIGS[SearchMode]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                mode === key
                  ? "border-sky-500 bg-sky-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">{cfg.label}</div>
              <div className="text-xs text-gray-500 mt-1">{cfg.duration}</div>
              <div className="text-xs text-gray-400 mt-1">{cfg.description}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !title.trim() || !location.trim()}
        className="w-full py-3 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Starting..." : "Search"}
      </button>
    </form>
  );
}
