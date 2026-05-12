# AGENTS.md

## Two projects, one DB

| Project | Dir | Runtime |
|---|---|---|
| Web app | `web/` | Next.js 16 + React 19 (TypeScript) |
| Scraper | `scraper/` | Node.js ESM |

No monorepo tool — independent `package.json` in each, no workspaces.

## Commands

### Web (`web/`)
- `npm run dev` — :3000
- `npm run build` — production build
- `npm run lint` — ESLint 9 flat config (`eslint.config.mjs`)
- **No `npm run typecheck`** — run `npx tsc --noEmit` if needed
- **No test framework** — there are zero tests

### Scraper (`scraper/`)
- `npm run start:local` — `node --env-file=.env.local run.js`
- `npm run start` — `node run.js` (env must already be set)

## Next.js 16 + React 19 quirks

Read `web/node_modules/next/dist/docs/` before writing code — breaking changes from earlier versions.
- shadcn/ui style: `radix-nova` (not `new-york`)
- Tailwind CSS v4 CSS-first config — **no `tailwind.config.ts`**
- All Supabase clients use `cookieEncoding: 'base64url'` (non-default `@supabase/ssr`)

## Supabase clients (`web/lib/supabase/`)

| File | Function | Key | Used in |
|---|---|---|---|
| `client.ts` | `createBrowserClient` | Anon | Browser components |
| `server.ts` | `createServerClient` | Anon | RSC, Server Actions |
| `admin.ts` | `createClient` | Service role | Admin pages only |

Scraper has its own at `scraper/lib/supabase.js` with `ws` transport + service role key.

## Server Action pattern (`web/app/actions/`)

No API routes for mutations. Every `'use server'` action:
1. Calls `supabase.auth.getUser()` to re-validate session
2. Filters user-owned rows by `.eq('user_id', user.id)`
3. Returns `{ error: string } | null` or redirects

## Admin guard

`web/app/admin/layout.tsx` redirects to `/dashboard` if `user.email !== process.env.ADMIN_EMAIL`

## Scraper pipeline (`scraper/run.js`)

fetch-searches → build-url → fetch-page → parse-listings → dedupe → match → notify → log-run

Groups searches by identical Gumtree URL to avoid redundant fetches. Runs in GitHub Actions every 15 min (`.github/workflows/scrape.yml`).

## Gotchas

- **`FROM_EMAIL`** is required by `scraper/lib/notify.js` but missing from `scraper/.env.example`
- **`database.sql`** at root is reference-only — NOT a runnable migration
- **Web `.gitignore`** ignores all `.env*` but `.env.local` is tracked after setup — recreate after clone
- **Root `.gitignore`** only covers `scraper/node_modules/` and `.env*` — web has its own
- Scraper uses `ws` package for Supabase realtime transport (Node 18+ lacks native WebSocket)
- Scraper `--env-file` flag requires Node 20+
