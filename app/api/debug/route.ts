import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function decodeJwt(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload;
  } catch {
    return null;
  }
}

export async function GET() {
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const srPayload = decodeJwt(srKey);
  const anonPayload = decodeJwt(anonKey);

  // Make a direct REST call to Supabase to test the key
  let supabaseTest: { status: number; body: string } | null = null;
  try {
    const res = await fetch(`${url}/rest/v1/scout_jobs?limit=1`, {
      headers: {
        apikey: srKey,
        Authorization: `Bearer ${srKey}`,
      },
    });
    const body = await res.text();
    supabaseTest = { status: res.status, body: body.slice(0, 300) };
  } catch (e) {
    supabaseTest = { status: 0, body: String(e) };
  }

  return NextResponse.json({
    supabase_url: { present: !!url, value: url },
    service_role_key: {
      present: !!srKey,
      length: srKey.length,
      prefix: srKey.slice(0, 10),
      dot_count: (srKey.match(/\./g) ?? []).length,
      is_jwt: srKey.startsWith("eyJ") && (srKey.match(/\./g) ?? []).length === 2,
      payload: srPayload,
    },
    anon_key: {
      present: !!anonKey,
      length: anonKey.length,
      prefix: anonKey.slice(0, 10),
      is_jwt: anonKey.startsWith("eyJ") && (anonKey.match(/\./g) ?? []).length === 2,
      payload: anonPayload,
    },
    supabase_live_test: supabaseTest,
    insert_test: await (async () => {
      try {
        const res = await fetch(`${url}/rest/v1/scout_jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": srKey,
            "Authorization": `Bearer ${srKey}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            title: "__debug_test__",
            location: "__debug__",
            context: "",
            mode: "quick",
            status: "queued",
            status_message: "debug",
            progress: 0,
          }),
        });
        const body = await res.text();
        // Clean up if it inserted
        if (res.ok) {
          const rows = JSON.parse(body) as { id: string }[];
          if (rows[0]?.id) {
            await fetch(`${url}/rest/v1/scout_jobs?id=eq.${rows[0].id}`, {
              method: "DELETE",
              headers: { "apikey": srKey, "Authorization": `Bearer ${srKey}` },
            });
          }
        }
        return { status: res.status, body: body.slice(0, 200) };
      } catch (e) {
        return { status: 0, body: String(e) };
      }
    })(),
    createclient_test: (() => {
      try {
        createClient(url, srKey, { auth: { persistSession: false } });
        return "OK - no error thrown";
      } catch (e) {
        return `ERROR: ${String(e)}`;
      }
    })(),
  });
}
