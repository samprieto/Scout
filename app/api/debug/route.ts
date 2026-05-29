import { NextResponse } from "next/server";

export async function GET() {
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const triggerKey = process.env.TRIGGER_SECRET_KEY ?? "";

  return NextResponse.json({
    supabase_url: { present: !!url, prefix: url.slice(0, 40) },
    service_role_key: {
      present: !!srKey,
      length: srKey.length,
      prefix: srKey.slice(0, 10),
      dot_count: (srKey.match(/\./g) ?? []).length,
      is_jwt: srKey.startsWith("eyJ") && (srKey.match(/\./g) ?? []).length === 2,
    },
    anon_key: {
      present: !!anonKey,
      length: anonKey.length,
      prefix: anonKey.slice(0, 10),
      is_jwt: anonKey.startsWith("eyJ") && (anonKey.match(/\./g) ?? []).length === 2,
    },
    trigger_key: { present: !!triggerKey, prefix: triggerKey.slice(0, 8) },
  });
}
