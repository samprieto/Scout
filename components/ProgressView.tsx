"use client";
import type { ScoutJob } from "@/lib/types";
import { MODE_CONFIGS } from "@/lib/types";

// Pipeline steps mapped to progress ranges
const STEPS = [
  {
    id: "queries",
    label: "Generating search queries",
    detail: "Building targeted LinkedIn searches using AI",
    activeAt: 1,
    doneAt: 15,
  },
  {
    id: "search",
    label: "Searching LinkedIn",
    detail: "Running neural searches across LinkedIn profiles",
    activeAt: 15,
    doneAt: 25,
  },
  {
    id: "enrich",
    label: "Enriching profiles",
    detail: "Fetching full profile data for each candidate",
    activeAt: 25,
    doneAt: 68,
  },
  {
    id: "score",
    label: "Scoring candidates",
    detail: "Evaluating each profile against your role requirements",
    activeAt: 68,
    doneAt: 85,
  },
  {
    id: "verify",
    label: "Verifying top candidates",
    detail: "Deep review of the strongest matches",
    activeAt: 85,
    doneAt: 100,
  },
];

function getStepState(
  stepActiveAt: number,
  stepDoneAt: number,
  progress: number,
  status: string
): "pending" | "active" | "done" {
  if (status === "complete") return "done";
  if (progress >= stepDoneAt) return "done";
  if (progress >= stepActiveAt) return "active";
  return "pending";
}

export default function ProgressView({ job }: { job: ScoutJob }) {
  const progress = job.progress ?? 0;
  const modeConfig = MODE_CONFIGS[job.mode];
  const isQueued = job.status === "queued";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-sky-600 uppercase">{modeConfig.label}</span>
            {job.req_number && (
              <span className="bg-gray-100 text-gray-600 font-mono font-semibold text-xs px-2 py-0.5 rounded">
                {job.req_number}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {job.title}
            <span className="text-gray-400 font-normal"> in </span>
            <span className="text-sky-600">{job.location}</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">Expected completion: {modeConfig.duration}</p>
        </div>
        {/* Live pulse indicator */}
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-full px-3 py-1.5 mt-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          <span className="text-xs font-medium text-sky-600">Live</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500 font-medium">
            {isQueued ? "Waiting to start..." : (job.status_message ?? "Processing...")}
          </span>
          <span className="font-semibold text-sky-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
            style={{
              width: `${Math.max(progress, isQueued ? 0 : 3)}%`,
              background: "linear-gradient(90deg, #0284c7, #38bdf8)",
            }}
          >
            {/* Shimmer effect on the active bar */}
            {!isQueued && progress < 100 && (
              <span
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                  animation: "shimmer 1.8s infinite",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Step-by-step checklist */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const state = getStepState(step.activeAt, step.doneAt, progress, job.status);
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                state === "active"
                  ? "bg-sky-50 border border-sky-100"
                  : state === "done"
                  ? "bg-gray-50 border border-gray-100"
                  : "border border-transparent"
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {state === "done" ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : state === "active" ? (
                  <div className="w-5 h-5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    state === "done"
                      ? "text-gray-400 line-through"
                      : state === "active"
                      ? "text-sky-700"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>
                {state === "active" && (
                  <p className="text-xs text-sky-500 mt-0.5">{step.detail}</p>
                )}
              </div>

              {/* Active badge */}
              {state === "active" && (
                <span className="text-xs bg-sky-100 text-sky-600 font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                  Running
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
