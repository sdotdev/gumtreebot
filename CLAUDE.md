# CLAUDE.md

Guidance for Claude Code when working on Gumtreebot — a Gumtree listing alert system. Users create saved searches via web app; a Node.js scraper polls Gumtree every 15 minutes, deduplicates listings, matches them against searches, and emails users via Resend.

## ⚠️ Critical: Next.js 16 + React 19

This project has **breaking changes** from earlier Next.js versions. Before writing any code:
- Read `web/node_modules/next/dist/docs/` for the Next.js 16 migration guide
- Do NOT rely on training-data assumptions about APIs, conventions, or file structure
- Check deprecation notices in the docs

---

## Project Structure

Two independent sub-projects share one Supabase database:

| Sub-project | Dir | Runtime | Deploy |
|---|---|---|---|
| Web app | `web/` | Next.js 16 + React 19 (TypeScript) | Vercel |
| Scraper | `scraper/` | Node.js ESM | GitHub Actions (every 15 min) |

No monorepo tool — independent `package.json` in each.

---

## Commands

### Web (`web/`)
```bash
npm run dev        # Development server on localhost:3000
npm run build      # Production build
npm run lint       # ESLint 9 (flat config in eslint.config.mjs)
npx tsc --noEmit   # Type check (no npm script for this)
```

### Scraper (`scraper/`)
```bash
npm run start:local    # Run with .env.local (requires Node 20+ for --env-file)
npm run start          # Run with existing env vars
node demo.js           # Demo the pipeline without sending emails
node test-supabase.js  # Test Supabase connection
```

**Important:** There are zero tests in this codebase. No jest, no vitest, no test framework.

---

## Architecture

### Web App (`web/`)

**Routing & Auth:**
- **`app/`** — App Router. Route groups: `(auth)` (public login/signup), `(dashboard)` (protected user area), `admin` (protected admin-only).
- **`app/(auth)/login`** — Form submits to `loginAction()` (Server Action)
- **`app/(dashboard)`** — Protected routes (searches, profile, etc.)
- **`app/admin`** — Admin panel (email gated via `layout.tsx`)
- **`app/auth/callback/route.ts`** — Supabase OAuth callback handler

**Data Flow:**
- No API routes for mutations — all go through Server Actions (`'use server'`)
- Every action re-validates session via `supabase.auth.getUser()` before touching data
- Row-level security enforced by always `.eq('user_id', user.id)` on user-owned tables
- RLS policies prevent unauthorized access even if auth check fails

**Supabase Clients (`lib/supabase/`):**

| File | Function | Auth Key | Usage |
|---|---|---|---|
| `client.ts` | `createBrowserClient` | Anon | Browser components (use sparingly) |
| `server.ts` | `createServerClient` | Anon | RSC, Server Actions (preferred) |
| `admin.ts` | `createClient` | Service role | Admin pages (`/admin/*`), public API routes (`/api/*` with token verification) |

All clients use `cookieEncoding: 'base64url'` (non-default `@supabase/ssr` setting).

**Admin client usage:** Service-role key allows bypassing auth checks. Use only for:
- Admin-protected routes (email verification)
- Public API endpoints that verify tokens before mutating (e.g., unsubscribe)
- Scraper operations that need full DB access

**UI & Styling:**
- Components in `components/` — shadcn/ui components + custom
- **Tailwind CSS v4** — CSS-first config, NO `tailwind.config.ts` file
- shadcn/ui style: `radix-nova` (not `new-york`)

### Scraper (`scraper/`)

**Pipeline** (`run.js`):
```
1. fetch-searches.js      — load all active searches from Supabase
2. build-url.js           — construct Gumtree search URL from params
3. fetch-page.js          — HTTP fetch Gumtree page (via cheerio)
4. parse-listings.js      — extract listings from HTML
5. dedupe.js              — upsert into DB, return only new ones
6. match.js               — filter new listings by include/exclude keywords + price range
7. notify.js              — email matches via Resend (checks user_settings.email_enabled)
8. log-run.js             — write run status/stats to scrape_runs table
9. cleanup-expired.js     — remove listings older than 30 days (runs once per cycle)
```

**Optimizations:**
- Groups identical Gumtree URLs together to avoid redundant fetches
- Deduplicates across runs via `source_listing_id` and `last_seen_at`
- Runs every 15 minutes via `.github/workflows/scrape.yml`

**Supabase Client:** `lib/supabase.js` with `ws` package (Node 18+ lacks native WebSocket) and service-role key.

---

## Database Schema

**`searches`** — User-defined searches
- `id` uuid (pk)
- `user_id` uuid (fk → profiles)
- `query_text` text (required, e.g., "iphone 13")
- `location_text` text (nullable, e.g., "Sydney")
- `min_price`, `max_price` numeric (nullable)
- `radius_km` integer (nullable)
- `category` text (nullable, e.g., "mobiles")
- `include_keywords` text[] (keywords to match)
- `exclude_keywords` text[] (keywords to exclude)
- `active` boolean (default true)
- `created_at`, `updated_at` timestamp (auto)

**`listings`** — All Gumtree listings ever scraped
- `id` uuid (pk)
- `source` text (always 'gumtree')
- `source_listing_id` text (unique across runs)
- `title`, `price`, `location_text`, `url` text
- `posted_at` timestamp (when posted on Gumtree)
- `first_seen_at`, `last_seen_at` timestamp (tracking)
- `raw_json` jsonb (full parsed data)

**`search_matches`** — Junction: searches × listings
- `id` uuid (pk)
- `search_id` uuid (fk → searches)
- `listing_id` uuid (fk → listings)
- `matched_at`, `notified_at` timestamp
- `notification_status` text ('pending', 'sent', 'failed')

**`scrape_runs`** — Scraper execution logs
- `id` uuid (pk)
- `search_id` uuid (fk → searches, nullable if bulk run)
- `started_at`, `finished_at` timestamp
- `status` text ('running', 'success', 'error')
- `error_message` text (nullable)
- `listings_found` integer

**`notification_logs`** — Email send tracking
- `id` uuid (pk)
- `user_id` uuid (fk → profiles)
- `match_id` uuid (fk → search_matches)
- `channel` text (always 'email')
- `status` text ('pending', 'sent', 'failed')
- `sent_at` timestamp
- `error_message` text

**`profiles`** — User metadata
- `id` uuid (pk, fk → auth.users)
- `display_name` text
- `created_at` timestamp

**`user_settings`** — User notification preferences
- `user_id` uuid (pk, fk → profiles)
- `email_enabled` boolean (default true, controls email notifications)
- `updated_at` timestamp

---

## Server Action Pattern

All mutations in `app/actions/` follow this pattern:

```typescript
'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function myAction(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Re-validate session (required even with auth guard)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  // 2. Filter by user_id for user-owned tables (RLS enforcement)
  const { error } = await supabase
    .from('searches')
    .update({ ... })
    .eq('id', id)
    .eq('user_id', user.id)  // Always filter user-owned rows
  
  if (error) return { error: error.message }
  
  // 3. Revalidate cache and redirect
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
```

**Key rules:**
- Re-validate session via `supabase.auth.getUser()` even if auth guard exists (defense in depth)
- Always filter user-owned rows by `.eq('user_id', user.id)` in addition to RLS
- Return `{ error: string } | null` or redirect, never throw
- Use `revalidatePath()` before redirect to bust Next.js cache

---

## Admin Guard Pattern

File: `app/admin/layout.tsx`

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user?.email || user.email !== process.env.ADMIN_EMAIL) {
  redirect('/dashboard')
}
```

Email must match `ADMIN_EMAIL` env var exactly. No database roles — purely email-based.

---

## API Routes & Public Endpoints

**`/api/unsubscribe`** — Unsubscribe from email notifications

- **Method:** GET with `token` query parameter
- **Auth:** Token-based (base64-encoded `user_id:email`)
- **Action:** Disables email notifications by upserting `user_settings` with `email_enabled: false`
- **Client:** Uses `admin.ts` (service role) for auth-free token verification
- **Response:** Redirects to login with success/error message

Pattern: Public routes that modify user data should use admin client for token verification, then validate user identity before updating `user_settings`.

---

## Environment Variables

**`web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ADMIN_EMAIL=your-admin-email@example.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**`scraper/.env.local`**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@example.com
```

**⚠️ GOTCHA:** `FROM_EMAIL` is required by `scraper/lib/notify.js` but MISSING from `.env.example`

---

## Key Gotchas & Conventions

1. **`database.sql` is reference-only** — Not a runnable migration. Schema exists in Supabase only.

2. **Web `.gitignore` quirk** — Ignores all `.env*` files, but `.env.local` must be recreated after clone (not tracked).

3. **Root `.gitignore` coverage** — Only covers `scraper/node_modules/` and `.env*`. Web app has its own `.gitignore`.

4. **Scraper Node version** — `--env-file` flag requires Node 20+. Use `npm run start:local` (which uses `--env-file`) only on Node 20+.

5. **WebSocket transport** — Scraper uses `ws` package for Supabase realtime (Node.js lacks native WebSocket support).

6. **No TypeScript in scraper** — Scraper is pure JavaScript (ESM). Type checking only on web app.

7. **Zero test coverage** — No test framework, no test files. Rely on manual testing and linting.

8. **Tailwind CSS v4** — CSS-first config. Do NOT create `tailwind.config.ts` — it would break the setup.

9. **RLS is foundational** — Server Actions rely on RLS policies as the primary security layer. Always verify that tables have correct policies.

10. **Deduplication by `source_listing_id`** — Listings are deduplicated across scraper runs via this field (Gumtree's internal listing ID).

11. **Listing lifecycle & cleanup** — Listings are automatically deleted if `first_seen_at` is older than 30 days. Cleanup runs once per scrape cycle. Always verify `last_seen_at` is current before matching.

12. **Email notification gating** — Scraper checks `user_settings.email_enabled` before sending notifications. Users can unsubscribe via email link or disable in settings. Always upsert `user_settings` with explicit `email_enabled` value when managing preferences.

---

## Development Workflow

1. **Create a feature branch** from `main` (or use the designated dev branch)
2. **Write code** following patterns above (Server Actions, auth checks, RLS enforcement)
3. **Test locally** — Web: `npm run dev` in web/. Scraper: `npm run start:local` in scraper/
4. **Run linter** — `npm run lint` in web/
5. **Type check web** — `npx tsc --noEmit` in web/ (no npm script)
6. **Commit & push** to feature branch
7. **Create PR** and request review

---

## Supabase & Deployment

- **Web** deploys to Vercel (connected to GitHub)
- **Scraper** runs on GitHub Actions schedule (`.github/workflows/scrape.yml`, every 15 min)
- **Database** is shared Supabase project (production data flows through both services)

Before schema changes: Use Supabase Studio UI or migrations. Verify RLS policies are in place.

---

## Common Tasks

**Add a new user search field:**
1. Add column to `searches` table in Supabase
2. Update `buildSearchPayload()` in `app/actions/searches.ts`
3. Update form schema if needed
4. Test create/update via web UI

**Debug scraper failures:**
1. Check GitHub Actions logs (`.github/workflows/scrape.yml`)
2. Check scraper run logs in Supabase (`scrape_runs` table)
3. Check `scraper/.env.local` is set up (especially `FROM_EMAIL`)
4. Try `npm run start:local` locally with test search

**Add an admin feature:**
1. Create route under `app/admin/`
2. Add auth check in layout.tsx (email vs `ADMIN_EMAIL`)
3. Use `admin.ts` client (service-role key)
4. Remember: admin is email-gated only, no role-based access control

**Manage email notification preferences:**
1. Check `user_settings.email_enabled` in `scraper/lib/notify.js` before sending emails
2. Provide unsubscribe links in emails (encoded token: base64(`user_id:email`))
3. Unsubscribe endpoint (`/api/unsubscribe`) sets `email_enabled: false` in `user_settings`
4. Users can re-enable notifications via dashboard settings (upsert with `email_enabled: true`)

---

## Reading Further

- **Next.js 16 docs:** `web/node_modules/next/dist/docs/`
- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Row-Level Security:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **shadcn/ui:** https://ui.shadcn.com/
- **Tailwind CSS v4:** https://tailwindcss.com/docs/v4
