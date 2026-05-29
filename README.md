# Scout — AI Recruiting Sourcing

Scout is an AI-powered recruiting sourcing tool that finds qualified candidates on LinkedIn using a multi-step pipeline: Claude generates targeted search queries, Exa.ai discovers profiles, NinjaPear/ProxyCurl enriches them, and Claude scores each candidate for fit.

## What Scout Does

1. You enter a role title, location, and optional job description/skills
2. Scout runs in the background (30 min to 24 hours depending on mode)
3. You get a ranked list of LinkedIn profiles with fit scores and reasons

**Search Modes:**
- **Quick Scan** (~30 min) — 10 queries, up to 50 profiles, top 10 results
- **Deep Search** (~2-3 hours) — 30 queries, up to 150 profiles, top 20 results
- **Full Market Scan** (~12-24 hours) — 80 queries, up to 500 profiles, top 30 results

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd scout
npm install
```

### 2. Fill in `.env.local`

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project settings
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `EXA_API_KEY` — from exa.ai
- `NINJAPEAR_API_KEY` — from nubela.co (ProxyCurl)
- `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_ID` — from trigger.dev

### 3. Run the Supabase SQL migration

Go to your Supabase project → SQL Editor and run:

```sql
-- Create the scout_jobs table (run this if it doesn't exist)
create table if not exists scout_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  location text not null,
  context text default '',
  mode text default 'quick',
  status text default 'queued',
  status_message text,
  progress integer default 0,
  results jsonb,
  error text,
  last_heartbeat_at timestamptz,
  trigger_run_id text
);

-- If the table already exists, add missing columns
alter table scout_jobs
  add column if not exists context text default '',
  add column if not exists mode text default 'quick',
  add column if not exists trigger_run_id text;
```

### 4. Deploy the Trigger.dev worker

```bash
# Log in to trigger.dev
npx trigger.dev@latest login

# In development (local background jobs)
npm run trigger:dev

# In production
npm run trigger:deploy
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** You need both `npm run dev` AND `npm run trigger:dev` running simultaneously for the full pipeline to work in development.

## Deploying to Vercel

1. Push your repo to GitHub (make sure `.env.local` is in `.gitignore`)
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add all environment variables from `.env.local` in the Vercel dashboard (Project Settings → Environment Variables)
4. Deploy
5. Run `npm run trigger:deploy` to deploy the background worker to Trigger.dev cloud

The Next.js app (frontend + API routes) runs on Vercel. The pipeline runs on Trigger.dev's cloud infrastructure — no serverless timeouts.

## Sharing with Others

Once deployed to Vercel:
- Share the Vercel URL (e.g., `https://scout.vercel.app`)
- All users share the same Supabase database and Trigger.dev project
- No auth is required by default — add Supabase Auth if you need user isolation

## Architecture

```
Browser → Next.js API (/api/search) → Supabase (creates job row) → Trigger.dev (triggers pipeline)
                                                                           ↓
Browser ← Next.js API (/api/job/[id]) ← Supabase ← scout-pipeline task (enriches + scores)
```

The pipeline:
1. **Claude Haiku** — generates diverse LinkedIn search queries
2. **Exa.ai** — neural search to discover LinkedIn profile URLs
3. **NinjaPear/ProxyCurl** — enriches each profile (rate-limited to 2 req/min)
4. **Claude Haiku** — scores candidates in batches of 10
5. **Claude Sonnet** — verifies and re-ranks top candidates (score 4-5 only)

## API Notes

- NinjaPear (ProxyCurl) Pay-As-You-Go tier: 2 requests/minute — the pipeline waits 31 seconds between enrichment calls
- Exa.ai: parallel searches, all filtered to `linkedin.com/in/` URLs
- Trigger.dev maxDuration: 86400 seconds (24 hours) to handle exhaustive mode
