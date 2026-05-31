import type { Candidate } from "@/lib/types";
import { scoreColor } from "@/lib/utils";

export default function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={candidate.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-semibold text-gray-900 hover:text-sky-600 transition-colors group"
            >
              {candidate.name}
              <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p className="text-sm text-sky-700 font-medium">
            {candidate.current_title}
            {candidate.current_company && candidate.current_company !== "Unknown" && (
              <span className="text-gray-500 font-normal"> @ {candidate.current_company}</span>
            )}
          </p>
          {candidate.location && candidate.location !== "Unknown" && (
            <p className="text-xs text-gray-500 mt-0.5">{candidate.location}</p>
          )}
          <p className="text-sm text-gray-600 mt-3">{candidate.reason}</p>
        </div>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${scoreColor(candidate.score)}`}>
          {candidate.score}
        </div>
      </div>
    </div>
  );
}
