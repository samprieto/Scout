import { task, wait } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import Exa from "exa-js";
import type { SearchMode, Candidate } from "@/lib/types";
import { extractJson } from "@/lib/utils";

interface PipelinePayload {
  jobId: string;
  title: string;
  location: string;
  context: string;
  mode: SearchMode;
}

interface ExaResult {
  url: string;
  title?: string;
  text?: string;
}

interface NinjaPearProfile {
  full_name?: string;
  headline?: string;
  occupation?: string;
  city?: string;
  state?: string;
  country?: string;
  experiences?: Array<{
    company?: string;
    title?: string;
    description?: string;
    starts_at?: { year?: number };
    ends_at?: { year?: number } | null;
  }>;
  skills?: string[];
  education?: Array<{
    school?: string;
    degree_name?: string;
    field_of_study?: string;
  }>;
}

const MODE_CONFIG = {
  quick:      { queries: 10, maxProfiles: 50,  targetResults: 10, rateDelayMs: 30_000 },
  thorough:   { queries: 30, maxProfiles: 150, targetResults: 20, rateDelayMs: 30_000 },
  exhaustive: { queries: 80, maxProfiles: 500, targetResults: 30, rateDelayMs: 30_000 },
};

// Raw DB patch using fetch — never supabase-js in background tasks
async function dbPatch(jobId: string, patch: Record<string, unknown>): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("dbPatch: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }
  try {
    const res = await fetch(`${url}/rest/v1/scout_jobs?id=eq.${jobId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`dbPatch failed: ${res.status} ${text}`);
    }
  } catch (e) {
    console.error("dbPatch error:", e);
  }
}

async function callClaude(
  system: string,
  user: string,
  model: "claude-haiku-4-5" | "claude-sonnet-4-5",
  maxTokens = 2048
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const signal = AbortSignal.timeout(60_000);

  const response = await anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    },
    { signal }
  );

  return response.content
    .filter(c => c.type === "text")
    .map(c => c.type === "text" ? c.text : "")
    .join("");
}

async function generateQueries(
  title: string,
  location: string,
  context: string,
  count: number
): Promise<string[]> {
  const contextLine = context.trim() ? `Key requirements: ${context.trim()}.` : "";

  try {
    const text = await callClaude(
      "You are an expert sourcing researcher who generates highly targeted LinkedIn search queries.",
      `Generate ${count} diverse search queries to find the BEST candidates for: ${title} in ${location}. ${contextLine}

Target different angles across queries:
- Exact title matches at various seniority levels
- Related/adjacent titles that lead to this role
- Key skills and certifications specific to the role
- Industry-specific experience
- Prestigious companies in this field in ${location}
- Alumni of top universities in the area who work in this field

Format each query to work with Exa's neural search — natural language descriptions work better than boolean.
Examples: "senior financial analyst with FP&A experience in Salt Lake City Utah linkedin"

Return JSON: { "queries": ["query1", "query2", ...] }`,
      "claude-haiku-4-5"
    );

    const parsed = extractJson<{ queries: string[] }>(text);
    const queries = parsed?.queries?.filter(q => typeof q === "string" && q.trim().length > 0);
    if (queries && queries.length > 0) return queries.slice(0, count);
  } catch (e) {
    console.error("Query generation failed:", e);
  }

  return [
    `${title} ${location} linkedin profile`,
    `senior ${title} ${location} linkedin`,
    `${title} professional ${location}`,
  ];
}

/**
 * Build a set of lowercase location keywords from a freeform location string.
 * e.g. "Salt Lake City, Utah, US" → ["salt lake", "utah", "ut", "us", "united states"]
 */
function buildLocationKeywords(location: string): string[] {
  const loc = location.toLowerCase();
  const keywords = new Set<string>();

  // Always include the raw location tokens
  loc.split(/[,\s]+/).forEach(token => {
    const t = token.trim();
    if (t.length >= 2) keywords.add(t);
  });

  // US state abbreviation → full name mappings (common ones)
  const stateMap: Record<string, string[]> = {
    ut: ["utah"],
    ca: ["california"],
    ny: ["new york"],
    tx: ["texas"],
    fl: ["florida"],
    wa: ["washington"],
    or: ["oregon"],
    co: ["colorado"],
    az: ["arizona"],
    nv: ["nevada"],
    id: ["idaho"],
    mt: ["montana"],
    wy: ["wyoming"],
    nm: ["new mexico"],
    il: ["illinois"],
    oh: ["ohio"],
    mi: ["michigan"],
    ga: ["georgia"],
    nc: ["north carolina"],
    va: ["virginia"],
    ma: ["massachusetts"],
    pa: ["pennsylvania"],
    mn: ["minnesota"],
    mo: ["missouri"],
    wi: ["wisconsin"],
    in: ["indiana"],
    tn: ["tennessee"],
    md: ["maryland"],
    ok: ["oklahoma"],
    ks: ["kansas"],
  };

  // If location contains a known abbreviation, add the full name too (and vice versa)
  for (const [abbr, names] of Object.entries(stateMap)) {
    if (loc.includes(abbr) || names.some(n => loc.includes(n))) {
      keywords.add(abbr);
      names.forEach(n => keywords.add(n));
    }
  }

  return Array.from(keywords);
}

/**
 * Filter Exa results to only keep profiles that mention the target location.
 * Uses the Exa text snippet (LinkedIn profile excerpt) for matching.
 * Returns up to maxProfiles results. If filtering would return 0 results,
 * falls back to the original list (better some results than none).
 */
function filterByLocation(results: ExaResult[], location: string, maxProfiles: number): ExaResult[] {
  const keywords = buildLocationKeywords(location);
  if (keywords.length === 0) return results.slice(0, maxProfiles);

  const filtered = results.filter(r => {
    const haystack = ((r.text ?? "") + " " + (r.title ?? "")).toLowerCase();
    return keywords.some(kw => haystack.includes(kw));
  });

  // Fallback: if filtering kills everything, return original (unfiltered) list
  const pool = filtered.length > 0 ? filtered : results;
  console.log(`Location filter: ${results.length} → ${filtered.length} (keywords: ${keywords.slice(0, 5).join(", ")})`);
  return pool.slice(0, maxProfiles);
}

async function searchExa(queries: string[], maxProfiles: number): Promise<ExaResult[]> {
  const exa = new Exa(process.env.EXA_API_KEY!);

  const results = await Promise.allSettled(
    queries.map(async (query) => {
      try {
        const result = await exa.searchAndContents(query, {
          numResults: 10,
          type: "neural",
          includeDomains: ["linkedin.com"],
          text: { maxCharacters: 3000 },
        });
        return (result.results ?? []).map(r => ({
          url: r.url,
          title: r.title ?? undefined,
          text: r.text ?? undefined,
        }));
      } catch {
        return [];
      }
    })
  );

  const seen = new Set<string>();
  const deduped: ExaResult[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const r of result.value) {
      if (!r.url?.includes("linkedin.com/in/")) continue;
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      deduped.push(r);
      if (deduped.length >= maxProfiles) return deduped;
    }
  }

  return deduped;
}

async function enrichProfile(url: string): Promise<NinjaPearProfile | null> {
  const key = process.env.NINJAPEAR_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${encodeURIComponent(url)}&use_cache=if-recent`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) return null;

    const bodyTimeout = new Promise<never>((_, reject) =>
      AbortSignal.timeout(15_000).addEventListener("abort", () => reject(new Error("Body read timeout")))
    );

    return await Promise.race([res.json() as Promise<NinjaPearProfile>, bodyTimeout]);
  } catch {
    return null;
  }
}

function buildProfileSummary(profile: NinjaPearProfile, fallbackText?: string): string {
  if (!profile.full_name && !profile.headline) {
    return fallbackText ?? "No profile data available";
  }

  const parts: string[] = [];

  if (profile.full_name) parts.push(`Name: ${profile.full_name}`);
  if (profile.headline) parts.push(`Headline: ${profile.headline}`);
  if (profile.occupation) parts.push(`Current role: ${profile.occupation}`);

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);

  if (profile.experiences?.length) {
    const expSummary = profile.experiences.slice(0, 4).map(e => {
      const years = e.starts_at?.year
        ? `${e.starts_at.year}–${e.ends_at?.year ?? "present"}`
        : "";
      return `  - ${e.title ?? "Role"} at ${e.company ?? "Company"}${years ? ` (${years})` : ""}`;
    }).join("\n");
    parts.push(`Experience:\n${expSummary}`);
  }

  if (profile.skills?.length) {
    parts.push(`Skills: ${profile.skills.slice(0, 15).join(", ")}`);
  }

  if (profile.education?.length) {
    const edu = profile.education.slice(0, 2).map(e =>
      `${e.degree_name ?? "Degree"} in ${e.field_of_study ?? "Field"} from ${e.school ?? "School"}`
    ).join("; ");
    parts.push(`Education: ${edu}`);
  }

  return parts.join("\n");
}

async function scoreChunk(
  title: string,
  location: string,
  context: string,
  chunk: Array<{ url: string; profile: NinjaPearProfile | null; fallbackText?: string }>
): Promise<Candidate[]> {
  const contextLine = context.trim()
    ? `\nKey requirements: ${context.trim()}\nPrioritize candidates with direct experience matching these requirements.`
    : "";

  const profileBlocks = chunk.map((item, i) => {
    const summary = item.profile
      ? buildProfileSummary(item.profile, item.fallbackText)
      : (item.fallbackText ?? "Limited data available");

    return `--- Candidate ${i + 1} ---\nURL: ${item.url}\n${summary}`;
  }).join("\n\n");

  const user = `Score each candidate for the role: ${title} in ${location}.${contextLine}

${profileBlocks}

Scoring criteria (be strict and conservative):
- 5 = Exceptional: Perfect title match, extensive directly relevant experience, right location, strong credentials
- 4 = Strong: Title clearly matches, solid relevant experience, plausible location fit
- 3 = Possible: Adjacent role or transferable skills, some gaps
- 2 = Weak: Tangential relevance, significant gaps
- 1 = No fit: Wrong field, student with no experience, unrelated role, OR clearly in a different geographic region than ${location}

IMPORTANT: If a candidate's location is clearly different from ${location} (different state, country, or major metro area), cap their score at 2 regardless of qualifications.
Only score 4-5 when profile data provides CLEAR DIRECT EVIDENCE of both role qualification AND geographic fit.

Return a JSON array:
[{
  "name": "Full Name",
  "current_title": "Current Job Title",
  "current_company": "Company Name",
  "location": "City, State",
  "profile_url": "https://linkedin.com/in/...",
  "score": 4,
  "reason": "Specific reason for score based on their actual experience",
  "skills": ["skill1", "skill2"]
}]`;

  try {
    const text = await callClaude(
      "You are a senior recruiting analyst. Score candidates strictly based on evidence. Return only valid JSON.",
      user,
      "claude-haiku-4-5",
      4096
    );

    const arr = extractJson<Candidate[]>(text);
    if (!Array.isArray(arr)) return [];

    return arr
      .filter(c => c && typeof c.profile_url === "string")
      .map((c, i) => ({
        name: String(c.name ?? "Unknown"),
        current_title: String(c.current_title ?? ""),
        current_company: String(c.current_company ?? ""),
        location: String(c.location ?? ""),
        profile_url: chunk[i]?.url ?? String(c.profile_url),
        score: Math.max(1, Math.min(5, Number(c.score) || 1)),
        reason: String(c.reason ?? ""),
        skills: Array.isArray(c.skills) ? c.skills : [],
      }));
  } catch {
    return [];
  }
}

async function verifyTopCandidates(
  candidates: Candidate[],
  title: string,
  location: string,
  context: string
): Promise<Candidate[]> {
  if (candidates.length === 0) return [];

  const contextLine = context.trim() ? `Key requirements: ${context.trim()}` : "";

  const candidateList = candidates.map((c, i) =>
    `${i + 1}. ${c.name} — ${c.current_title} @ ${c.current_company} (${c.location})\n   Reason: ${c.reason}`
  ).join("\n\n");

  try {
    const text = await callClaude(
      "You are a senior talent acquisition expert. Verify candidate fit assessments carefully and accurately.",
      `Re-evaluate these candidates for: ${title} in ${location}. ${contextLine}

${candidateList}

For each candidate, assign a final score 1-5. Be fair and inclusive — if someone has relevant experience or a related title, give them the benefit of the doubt. Consider:
- Does the title/role match or closely relate to what we're hiring for?
- Is the experience level reasonable?
- Is the location a plausible fit?

Return JSON array with same structure: [{
  "name": "...", "current_title": "...", "current_company": "...",
  "location": "...", "profile_url": "...", "score": 3-5,
  "reason": "verified assessment..."
}]

Include all candidates with score 3 or above. Aim to return at least 10 candidates if the data supports it.`,
      "claude-sonnet-4-5",
      4096
    );

    const arr = extractJson<Candidate[]>(text);
    if (!Array.isArray(arr)) return candidates;

    // Map back to original candidates with verified scores
    return arr
      .filter(c => c.score >= 3)
      .map((c, i) => ({
        ...candidates[i],
        ...c,
        score: Math.max(3, Math.min(5, Number(c.score) || 3)),
      }));
  } catch {
    return candidates;
  }
}

export const scoutPipeline = task({
  id: "scout-pipeline",
  maxDuration: 86400, // 24 hours max

  run: async (payload: PipelinePayload) => {
    const { jobId, title, location, context, mode } = payload;
    const config = MODE_CONFIG[mode];

    try {
      // Step 1: Generate search queries
      await dbPatch(jobId, {
        status: "running",
        progress: 5,
        status_message: "Generating search queries...",
      });

      const queries = await generateQueries(title, location, context, config.queries);
      console.log(`Generated ${queries.length} queries`);

      // Step 2: Search with Exa
      await dbPatch(jobId, {
        progress: 15,
        status_message: `Running ${queries.length} searches...`,
      });

      const rawExaResults = await searchExa(queries, config.maxProfiles * 3); // fetch extra before filtering
      console.log(`Found ${rawExaResults.length} candidate URLs before location filter`);

      const exaResults = filterByLocation(rawExaResults, location, config.maxProfiles);
      console.log(`After location filter: ${exaResults.length} candidates`);

      if (exaResults.length === 0) {
        await dbPatch(jobId, {
          status: "complete",
          progress: 100,
          status_message: "No candidates found",
          results: [],
        });
        return { success: true, candidateCount: 0 };
      }

      // Step 3: Enrich with NinjaPear (rate limited)
      await dbPatch(jobId, {
        progress: 25,
        status_message: `Enriching ${exaResults.length} profiles via NinjaPear...`,
      });

      const enrichedProfiles: Array<{
        url: string;
        profile: NinjaPearProfile | null;
        fallbackText?: string;
      }> = [];

      for (let i = 0; i < exaResults.length; i++) {
        const result = exaResults[i];

        if (i % 3 === 0) {
          const progressPct = 25 + Math.round((i / exaResults.length) * 40);
          await dbPatch(jobId, {
            progress: progressPct,
            status_message: `Enriching profile ${i + 1} of ${exaResults.length}...`,
          });
        }

        const profile = await enrichProfile(result.url);
        enrichedProfiles.push({
          url: result.url,
          profile,
          fallbackText: result.text,
        });

        // Rate limit: wait between requests (2 req/min for Pay-As-You-Go)
        if (i < exaResults.length - 1) {
          await wait.for({ seconds: 31 }); // ~2 per minute
        }
      }

      console.log(`Enriched ${enrichedProfiles.length} profiles`);

      // Step 4: Score in chunks with Claude Haiku
      await dbPatch(jobId, {
        progress: 68,
        status_message: `Scoring ${enrichedProfiles.length} candidates...`,
      });

      const CHUNK_SIZE = 10;
      const chunks: typeof enrichedProfiles[] = [];
      for (let i = 0; i < enrichedProfiles.length; i += CHUNK_SIZE) {
        chunks.push(enrichedProfiles.slice(i, i + CHUNK_SIZE));
      }

      const chunkResults = await Promise.allSettled(
        chunks.map(chunk => scoreChunk(title, location, context, chunk))
      );

      const allScored: Candidate[] = chunkResults.flatMap(r =>
        r.status === "fulfilled" ? r.value : []
      );

      console.log(`Scored ${allScored.length} candidates`);

      // Step 5: Filter to 4+ and verify with Claude Sonnet
      const topCandidates = allScored
        .filter(c => c.score >= 3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30); // cap at 30 for verification

      await dbPatch(jobId, {
        progress: 85,
        status_message: `Verifying ${topCandidates.length} top candidates...`,
      });

      const verified = topCandidates.length > 0
        ? await verifyTopCandidates(topCandidates, title, location, context)
        : [];

      verified.sort((a, b) => b.score - a.score);

      console.log(`Verified ${verified.length} strong candidates`);

      // Save results
      await dbPatch(jobId, {
        status: "complete",
        progress: 100,
        status_message: `Found ${verified.length} strong candidates`,
        results: verified,
      });

      return { success: true, candidateCount: verified.length };

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Pipeline error:", message);
      await dbPatch(jobId, {
        status: "error",
        progress: 100,
        error: message,
      });
      throw err;
    }
  },
});
