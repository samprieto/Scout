import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env vars not set" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/scout_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Supabase fetch error:", res.status, errText);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const rows = await res.json() as Record<string, unknown>[];
    if (!rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("Job fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
