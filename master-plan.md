# Master Plan — Gumtree Deal Finder MVP

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind 4 + shadcn · GitHub Actions (scraper) · Resend (email)  
**Deployment:** Vercel (web) · GitHub Actions (scraper cron)  
**Scale:** Personal / small friend group — simplicity and speed over enterprise patterns.

---

## Phase 0 — Repo & Tooling (Day 1, ~1 hour)

Goal: clean working environment before touching product code.

- [ ] Create a GitHub repo and push the existing `web/` scaffold
- [ ] Add `.env.local` to `.gitignore`, document required vars in `.env.example`
- [ ] Create a `scraper/` directory at the repo root (sibling to `web/`) — this is where the Node scraping scripts live
- [ ] Install `pnpm` workspaces or keep them as separate package roots (recommend separate — simpler for GitHub Actions to `cd scraper && node run.js`)
- [ ] Set up Vercel project linked to the GitHub repo (auto-deploy `web/` on push to `main`)

---

## Phase 1 — Supabase Project & Schema (Day 1, ~2 hours)

Goal: all tables, RLS policies, and auth configured before writing a single line of UI.

### 1.1 Create Supabase project
- New project via Supabase dashboard
- Note: project URL, anon key, service role key (service role stays server-side only)

### 1.2 Run SQL migrations (in order)

**Migration 001 — profiles**
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users own their profile"
  on profiles for all using (auth.uid() = id);
```

**Migration 002 — searches**
```sql
create table searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  query_text text not null,
  location_text text,
  min_price numeric,
  max_price numeric,
  radius_km int,
  category text,
  include_keywords text[],
  exclude_keywords text[],
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table searches enable row level security;
create policy "Users own their searches"
  on searches for all using (auth.uid() = user_id);
```

**Migration 003 — listings**
```sql
create table listings (
  id uuid primary key default gen_random_uuid(),
  source text default 'gumtree',
  source_listing_id text not null,
  title text,
  price numeric,
  location_text text,
  url text,
  posted_at timestamptz,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  raw_json jsonb,
  unique (source, source_listing_id)
);
-- No RLS on listings — they are not user-owned, scraper writes via service role
```

**Migration 004 — search_matches**
```sql
create table search_matches (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references searches(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  matched_at timestamptz default now(),
  notified_at timestamptz,
  notification_status text default 'pending',
  unique (search_id, listing_id)
);
alter table search_matches enable row level security;
create policy "Users see their own matches"
  on search_matches for select
  using (
    auth.uid() = (select user_id from searches where id = search_id)
  );
```

**Migration 005 — scrape_runs**
```sql
create table scrape_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references searches(id) on delete set null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text default 'running',
  error_message text,
  listings_found int default 0
);
-- Admin-only visibility; RLS off, controlled by service role
```

**Migration 006 — notification_logs**
```sql
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references search_matches(id) on delete cascade,
  channel text default 'email',
  status text default 'pending',
  sent_at timestamptz,
  error_message text
);
alter table notification_logs enable row level security;
create policy "Users see their own notifications"
  on notification_logs for select using (auth.uid() = user_id);
```

### 1.3 Auth config
- Enable Email provider in Supabase Auth dashboard
- Set Site URL to Vercel preview URL initially, then prod URL
- Create a `handle_new_user` trigger that inserts a row into `profiles` on signup

```sql
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## Phase 2 — Next.js Auth Integration (Day 2, ~2 hours)

Goal: users can sign up, log in, and be redirected correctly.

- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Create `lib/supabase/client.ts` (browser client) and `lib/supabase/server.ts` (server component client using cookies)
- [ ] Add middleware (`middleware.ts`) to protect `/dashboard/**` routes — redirect unauthenticated users to `/login`
- [ ] Build pages:
  - `/login` — email + password form (shadcn `Input`, `Button`)
  - `/signup` — same, with display name field
  - `/auth/callback` — handles the Supabase redirect after email confirmation
- [ ] Add a simple nav with logout button (server action calling `supabase.auth.signOut()`)

**No OAuth for MVP** — email/password only keeps setup minimal.

---

## Phase 3 — Search CRUD UI (Day 2–3, ~3 hours)

Goal: users can create, view, pause, and delete saved searches.

### Pages to build

| Route | Purpose |
|---|---|
| `/dashboard` | List of saved searches + quick stats |
| `/dashboard/searches/new` | Create search form |
| `/dashboard/searches/[id]/edit` | Edit existing search |
| `/dashboard/alerts` | Alerts feed (Phase 5) |

### Search form fields
- Query text (required)
- Location (text, optional)
- Min / max price (number inputs, optional)
- Radius km (optional)
- Category (optional select)
- Include keywords (tag input — comma-separated, split on save)
- Exclude keywords (same)
- Active toggle

### Server actions
- `createSearch(formData)` — insert into `searches`, revalidate `/dashboard`
- `updateSearch(id, formData)` — update row
- `toggleSearch(id, active)` — flip `active` boolean
- `deleteSearch(id)` — delete row

All server actions call the **server-side** Supabase client (RLS enforces user ownership automatically).

---

## Phase 4 — Scraper Module (Day 3–4, ~4 hours)

Goal: a standalone Node.js script in `scraper/` that can run independently of the web app.

### Structure
```
scraper/
  package.json          # { "type": "module" }
  run.js                # entry point — orchestrates the whole job
  lib/
    supabase.js         # Supabase client (service role key)
    fetch-searches.js   # load active searches from DB
    build-url.js        # construct Gumtree search URL from search params
    fetch-page.js       # HTTP GET with retries + backoff
    parse-listings.js   # parse HTML → array of listing objects
    dedupe.js           # upsert listings, return only new ones
    match.js            # check listing against search filters
    notify.js           # send email via Resend, write notification_log
    log-run.js          # write scrape_run record (start/finish/error)
```

### `parse-listings.js` — the most fragile part
- Use `cheerio` to parse Gumtree HTML
- Target listing cards by stable CSS selectors (data attributes preferred over class names — they change less)
- Extract: `source_listing_id`, `title`, `price`, `location_text`, `url`, `posted_at`
- Return raw HTML snippet as `raw_json.html` for debugging
- **Isolate all selectors in one object at the top of the file** — when Gumtree changes markup, you fix it in one place

### `run.js` flow
```
1. start scrape_run record
2. load all active searches from DB
3. group searches by canonical Gumtree URL (dedup equivalent queries)
4. for each unique URL:
   a. fetch page (with retry)
   b. parse listings
   c. upsert listings (INSERT ... ON CONFLICT DO UPDATE last_seen_at)
   d. for each truly new listing:
      - run match() against all searches sharing this URL
      - insert search_match rows (ON CONFLICT DO NOTHING)
      - queue notifications
5. send queued notifications
6. mark scrape_run finished
```

### Dependencies
```json
{
  "cheerio": "^1.0.0",
  "@supabase/supabase-js": "^2",
  "resend": "^3"
}
```

---

## Phase 5 — Email Notifications (Day 4, ~1.5 hours)

Goal: user gets an email when a new match is found.

- [ ] Create free [Resend](https://resend.com) account, get API key
- [ ] In `notify.js`: send a simple HTML email with listing title, price, location, and direct Gumtree link
- [ ] Write a row to `notification_logs` with `status: 'sent'` or `status: 'failed'` + `error_message`
- [ ] One email per match — do not re-notify if `notification_status = 'sent'` already

**Email template (minimal):**
```
Subject: New Gumtree match: {title} — £{price}

You saved a search for "{query}".
A new listing was just found:

{title}
£{price} · {location}

View listing → {url}
```

No HTML framework needed — plain text email works perfectly for MVP.

---

## Phase 6 — GitHub Actions Cron Job (Day 4–5, ~1 hour)

Goal: scraper runs automatically every 5 minutes.

### `.github/workflows/scrape.yml`
```yaml
name: Scrape Gumtree

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:          # manual trigger from Actions tab

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 4        # fail fast, don't overlap runs
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd scraper && npm ci
      - name: Run scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
        run: cd scraper && node run.js
```

### Secrets to add in GitHub repo settings
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

**Note:** GitHub Actions free tier allows 2,000 minutes/month. At 5-min intervals that's ~8,928 runs/month × ~30s each ≈ ~4,500 minutes — this will exceed the free tier. Options:
- Run every 15 minutes instead (fits comfortably in free tier)
- Use a private repo (free tier minutes are for public repos too, but usage is the same)
- Accept the small cost (~$0.008/min overage) for personal use

---

## Phase 7 — Alerts Feed UI (Day 5, ~2 hours)

Goal: user can see all matched listings in the app.

### `/dashboard/alerts` page
- Server component — query `search_matches` joined with `listings` and `searches` for the current user
- Display as a card list: listing title, price, location, matched search name, time found, link to Gumtree
- Filter by search (dropdown)
- Show `notification_status` badge (pending / sent / failed)
- Paginate — 20 per page

### `/dashboard/alerts/[id]` detail page
- Full listing info
- Raw JSON debug view (collapsible, for power users)
- Link back to the matched search

---

## Phase 8 — Admin Panel (Day 5–6, ~2 hours)

Goal: you can see job health without going into the Supabase dashboard.

Protect with a simple check: `if (user.email !== process.env.ADMIN_EMAIL) redirect('/')`.

### `/admin` pages

| Route | Shows |
|---|---|
| `/admin` | Last 50 scrape_runs with status, duration, listings found |
| `/admin/runs/[id]` | Full run detail + error_message |
| `/admin/parser` | Paste raw Gumtree HTML, run parser, see extracted listings |

The parser diagnostic page (`/admin/parser`) is the most useful — it lets you test selector changes without running a full job.

---

## Phase 9 — Polish & Pre-launch Checks (Day 6, ~2 hours)

- [ ] Add loading states and error boundaries to all pages
- [ ] Add toast notifications (already have `sonner`) for form actions
- [ ] Validate all form inputs server-side (don't trust client)
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel environment variables
- [ ] Confirm RLS is working: log in as two different users, verify search isolation
- [ ] Test the full flow end-to-end:
  1. Sign up → create search → wait for next cron → check alerts feed → check email inbox
- [ ] Add a `robots.txt` that disallows everything (no reason to be indexed)
- [ ] Review Gumtree ToS before sharing with friends

---

## Chronological Build Order (Summary)

```
Day 1   Phase 0 (repo setup) → Phase 1 (Supabase schema + auth)
Day 2   Phase 2 (Next.js auth) → Phase 3 (search CRUD start)
Day 3   Phase 3 (search CRUD finish) → Phase 4 (scraper start)
Day 4   Phase 4 (scraper finish) → Phase 5 (email) → Phase 6 (GitHub Actions)
Day 5   Phase 7 (alerts UI) → Phase 8 (admin start)
Day 6   Phase 8 (admin finish) → Phase 9 (polish + test)
```

**Total: ~6 focused days of work.**

---

## Key Decisions & Rationale

| Decision | Why |
|---|---|
| Scraper in `scraper/` separate from `web/` | Scraper runs in GitHub Actions, not on Vercel. Keeping it separate avoids bundling Node-only libraries (cheerio) into the Next.js build. |
| Service role key only in scraper + GitHub Actions secrets | Never exposed to the browser. Anon key is fine for client-side Supabase calls — RLS handles the rest. |
| Resend for email | Free tier is 3,000 emails/month, simple API, no SMTP config. |
| No OAuth / social login | Fewer moving parts for personal use. Add later if needed. |
| `ON CONFLICT DO NOTHING` for matches | Makes the scraper fully idempotent — safe to re-run anytime. |
| Cheerio not Playwright | Gumtree search results render server-side. Cheerio is 100× faster and has no memory overhead. Swap to Playwright only if they move to client-side rendering. |

---

## Environment Variables Reference

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js client | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js client | Safe to expose, RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | Scraper only | Never in Next.js, never in git |
| `SUPABASE_URL` | Scraper | Same URL as above |
| `RESEND_API_KEY` | Scraper | Never in Next.js |
| `ADMIN_EMAIL` | Next.js server | Your email, for admin route guard |
