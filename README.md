# Gumbotree

Gumbotree monitors Gumtree listings and emails you when new ones match your saved searches.

## Architecture

Two independent sub-projects share one Supabase database:

| Sub-project | Dir | Runtime | Deploy |
|---|---|---|---|
| Web app | `web/` | Next.js 16 + React 19 | Vercel |
| Scraper | `scraper/` | Node.js ESM | GitHub Actions |

The scraper polls Gumtree search results every 15 minutes, deduplicates listings, matches them against user searches, and sends email notifications via Resend.

## Quick start

```bash
# Web app
cd web
cp .env.example .env.local   # fill in Supabase + admin email
npm install
npm run dev                   # localhost:3000

# Scraper (separate terminal)
cd scraper
cp .env.example .env.local   # fill in Supabase + Resend
npm install
npm run start:local           # single scrape run
```

## More

See [`AGENTS.md`](AGENTS.md) for detailed commands, Supabase client variants, and project gotchas.
