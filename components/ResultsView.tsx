"use client";
import { useRouter } from "next/navigation";
import type { ScoutJob } from "@/lib/types";
import CandidateCard from "@/components/CandidateCard";
import { MODE_CONFIGS } from "@/lib/types";

export default function ResultsView({ job }: { job: ScoutJob }) {
  const router = useRouter();
  const candidates = job.results ?? [];
  const strongCandidates = candidates.filter(c => c.score >= 4);
  const modeConfig = MODE_CONFIGS[job.mode];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            <span className="text-sky-600">{strongCandidates.length} strong candidates</span>
            <span className="text-gray-400 font-normal text-lg"> — {job.title} in {job.location}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">{modeConfig.label} · All candidates scored 4 or 5</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50 font-medium"
        >
          New Search
        </button>
      </div>

      {strongCandidates.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <p className="text-gray-500">No strong candidates found. Try a broader search or add more context about the role.</p>
          <button onClick={() => router.push("/")} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-xl text-sm hover:bg-sky-700">
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {strongCandidates.map((candidate, i) => (
            <CandidateCard key={i} candidate={candidate} />
          ))}
        </div>
      )}

      {candidates.length > strongCandidates.length && (
        <details className="bg-gray-50 rounded-xl border border-gray-100">
          <summary className="px-5 py-3 text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            {candidates.length - strongCandidates.length} additional candidates (scored 1-3)
          </summary>
          <div className="p-4 space-y-3">
            {candidates.filter(c => c.score < 4).map((candidate, i) => (
              <CandidateCard key={i} candidate={candidate} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
