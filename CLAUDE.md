# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js Version Warning

This project runs **Next.js 16 + React 19** — breaking changes exist from earlier versions. Before writing any Next.js code, read the relevant guide in `web/node_modules/next/dist/docs/`. Do not rely on training-data assumptions about Next.js APIs, conventions, or file structure.

---

## Project Overview

A Gumtree listing alert system. Users create saved searches via the web app; a separate Node.js scraper periodically fetches Gumtree, stores new listings, matches them against saved searches, and emails users via Resend.

Two independent sub-projects share one Supabase database:

| Sub-project | Dir | Runtime |
|---|---|---|
| Web frontend | `web/` | Next.js 16 (TypeScript) |
| Scraper | `scraper/` | Node.js ESM |

---

## Commands

### Web (`web/`)
```bash
npm run dev      # development server on :3000
npm run build    # production build
npm run lint     # ESLint
```

### Scraper (`scraper/`)
```bash
npm run start:local   # run a scrape job with .env.local
npm run start         # run without env file (use when env is already set)
```

---

## Architecture

### Web App (`web/`)

- **`app/`** — Next.js App Router. Route groups: `(auth)` (login/signup), `(dashboard)` (main user area), `admin` (admin-only).
- **`app/actions/`** — Server Actions for all mutations (auth, searches, admin). No API routes for mutations.
- **`app/auth/callback/route.ts`** — Supabase OAuth callback handler.
- **`middleware.ts`** — Auth guard: redirects unauthenticated users away from `/dashboard`, authenticated users away from `/login`/`/signup`.
- **`lib/supabase/`** — Three Supabase client variants: `client.ts` (browser), `server.ts` (RSC/Server Actions), `admin.ts` (service-role, for admin routes only).

All mutations go through Server Actions (`'use server'`). Every action re-validates the user session via `supabase.auth.getUser()` before touching data. Row-level security is enforced by always `.eq('user_id', user.id)` on user-owned tables.

UI is built with shadcn/ui components (see `components/`) and Tailwind CSS v4.

### Scraper (`scraper/`)

Pipeline in `run.js`:
1. `fetch-searches.js` — loads all active searches from Supabase
2. `build-url.js` — constructs Gumtree search URL from search params
3. `fetch-page.js` — HTTP fetches the Gumtree page
4. `parse-listings.js` — Cheerio parses listings from HTML
5. `dedupe.js` — upserts listings into DB, returns only new ones
6. `match.js` — filters new listings against each search's include/exclude keywords and price range
7. `notify.js` — sends email via Resend for each match
8. `log-run.js` — writes run status/stats to DB

Groups searches by identical URL before scraping to avoid redundant fetches.

### Supabase Schema (inferred)

Key tables: `searches` (user_id, query_text, location_text, min_price, max_price, radius_km, category, include_keywords[], exclude_keywords[], active), `listings`, `search_matches` (search_id, listing_id, notification_status), scraper run log table.

---

## Environment Variables

**`web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_EMAIL=          # email address granted access to /admin
SUPABASE_SERVICE_ROLE_KEY=
```

**`scraper/.env.local`**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```
