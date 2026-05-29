import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { configure, tasks } from "@trigger.dev/sdk/v3";
import type { SearchMode } from "@/lib/types";

configure({
  secretKey: process.env.TRIGGER_SECRET_KEY ?? "",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title: string; location: string; context?: string; mode: SearchMode };
    const { title, location, context = "", mode } = body;

    if (!title?.trim() || !location?.trim()) {
      return NextResponse.json({ error: "Title and location are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Insert job row
    const { data: row, error } = await supabase
      .from("scout_jobs")
      .insert({
        title: title.trim(),
        location: location.trim(),
        context: context.trim(),
        mode,
        status: "queued",
        status_message: "Queued...",
        progress: 0,
      })
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(error?.message ?? "Failed to create job");
    }

    const jobId = row.id as string;

    // Trigger the background pipeline
    const handle = await tasks.trigger("scout-pipeline", {
      jobId,
      title: title.trim(),
      location: location.trim(),
      context: context.trim(),
      mode,
    });

    // Save the trigger run ID
    await supabase
      .from("scout_jobs")
      .update({ trigger_run_id: handle.id })
      .eq("id", jobId);

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start search" },
      { status: 500 }
    );
  }
}
