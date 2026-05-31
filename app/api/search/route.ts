import { NextRequest, NextResponse } from "next/server";
import type { SearchMode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title: string; location: string; context?: string; mode: SearchMode; reqNumber?: string | null };
    const { title, location, context = "", mode, reqNumber = null } = body;

    if (!title?.trim() || !location?.trim()) {
      return NextResponse.json({ error: "Title and location are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase env vars not set");
    }

    // Insert job row via direct REST (bypasses SDK auth issues)
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/scout_jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        title: title.trim(),
        location: location.trim(),
        context: context.trim(),
        mode,
        req_number: reqNumber ?? null,
        status: "queued",
        status_message: "Queued...",
        progress: 0,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(`[Step 1 - Supabase insert] ${insertRes.status}: ${errText}`);
    }

    const inserted = await insertRes.json() as { id: string }[];
    const jobId = inserted[0]?.id;
    if (!jobId) throw new Error("[Step 1 - Supabase insert] No job ID returned");

    // Trigger the background pipeline
    const secretKey = process.env.TRIGGER_SECRET_KEY;
    if (!secretKey) throw new Error("[Step 2 - Trigger.dev] TRIGGER_SECRET_KEY is not set");

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
      throw new Error(`[Step 2 - Trigger.dev] ${triggerRes.status}: ${errText}`);
    }

    const triggerData = await triggerRes.json() as { id: string };

    // Save the trigger run ID via direct REST
    await fetch(`${supabaseUrl}/rest/v1/scout_jobs?id=eq.${jobId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ trigger_run_id: triggerData.id }),
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start search" },
      { status: 500 }
    );
  }
}
