"use client";
import type { ScoutJob } from "@/lib/types";
import { MODE_CONFIGS } from "@/lib/types";
import { timeSince } from "@/lib/utils";

export default function ProgressView({ job }: { job: ScoutJob }) {
  const progress = job.progress ?? 0;
  const isStalled = job.last_heartbeat_at
    ? timeSince(job.last_heartbeat_at) > 120
    : false;
  const modeConfig = MODE_CONFIGS[job.mode];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-2xl mx-auto">
      <div className="text-xs font-semibold tracking-wider text-sky-600 uppercase mb-2">
        {modeConfig.label}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        <span className="text-gray-900">{job.title}</span>
        <span className="text-gray-400 font-normal"> in </span>
        <span className="text-sky-600">{job.location}</span>
      </h2>
      <p className="text-sm text-gray-500 mb-8">Expected completion: {modeConfig.duration}</p>

      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{job.status_message ?? "Processing..."}</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-sky-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isStalled && (
        <div className="mt-6 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          <p className="text-amber-700 text-sm">Still running — this is a long search. Check back later.</p>
        </div>
      )}
    </div>
  );
}
