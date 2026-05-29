"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoutJob } from "@/lib/types";
import ProgressView from "@/components/ProgressView";
import ResultsView from "@/components/ResultsView";

export default function ResultsPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const router = useRouter();
  const [job, setJob] = useState<ScoutJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        if (!res.ok) { setError("Job not found"); return; }
        const data = await res.json() as ScoutJob;
        setJob(data);
        if (data.status === "complete" || data.status === "error") {
          clearInterval(interval);
        }
      } catch {
        setError("Failed to load job status");
      }
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">
            New Search
          </button>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Scout</h1>
              <p className="text-sm text-gray-500">AI recruiting sourcing</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            New Search
          </button>
        </div>

        {(job.status === "queued" || job.status === "running") && (
          <ProgressView job={job} />
        )}

        {job.status === "complete" && (
          <ResultsView job={job} />
        )}

        {job.status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium mb-2">Search failed</p>
            <p className="text-red-600 text-sm mb-4">{job.error}</p>
            <button onClick={() => router.push("/")} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
