import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SearchMode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title: string; location: string; context?: string; mode: SearchMode };
    const { title, location, context = "", mode } = body;

    if (!title?.trim() || !location?.trim()) {
      return NextResponse.json({ error: "Title and location are required" }, { status: 400 });
    }

    // Diagnostic: log key shapes (first 12 chars only, never the full key)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)";
    const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "(missing)";
    console.log("[scout] SUPABASE_URL prefix:", url.slice(0, 30));
    console.log("[scout] SERVICE_ROLE_KEY prefix:", srKey.slice(0, 12), "| length:", srKey.length);

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

    // Trigger the background pipeline via REST API (bypasses SDK auth issues)
    const secretKey = process.env.TRIGGER_SECRET_KEY;
    if (!secretKey) throw new Error("TRIGGER_SECRET_KEY is not set");

    const triggerRes = await fetch(
      `https://api.trigger.dev/api/v1/tasks/scout-pipeline/trigger`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          payload: {
            jobId,
            title: title.trim(),
            location: location.trim(),
            context: context.trim(),
            mode,
          },
        }),
      }
    );

    if (!triggerRes.ok) {
      const errText = await triggerRes.text();
      throw new Error(`Trigger.dev error: ${triggerRes.status} ${errText}`);
    }

    const triggerData = await triggerRes.json() as { id: string };

    // Save the trigger run ID
    await supabase
      .from("scout_jobs")
      .update({ trigger_run_id: triggerData.id })
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
