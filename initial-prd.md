# Technical PRD: Gumtree Deal Finder

## 1. Overview

Build a web app that lets users create Gumtree searches and get fast alerts when new listings matching their criteria appear. The product should help users find underpriced or newly posted items before other buyers do.

## 2. Product goal

The system should continuously monitor Gumtree search results, detect new relevant listings, deduplicate them, match them against user-saved searches, and notify users quickly.

## 3. Primary user stories

* As a user, I can sign up and log in.
* As a user, I can create a saved search with keywords, excluded keywords, location, radius, and price limits.
* As a user, I can see my alerts and listing history.
* As a user, I can pause, edit, or delete a search.
* As a user, I get notified when a new Gumtree listing matches my search.
* As an admin, I can view job runs, failures, and system health.

## 4. Suggested stack

### Frontend

* Next.js App Router
* Tailwind CSS
* Deploy on Vercel

### Backend / data

* Supabase Auth
* Supabase Postgres
* Supabase Row Level Security
* Supabase Storage only if needed later

### Scraping / scheduled jobs

* GitHub Actions for scheduled polling jobs
* Optional Supabase Edge Functions for API-like tasks or notification helpers

### Notifications

* Start with email and in-app alerts
* Optional Telegram or Discord later

## 5. System architecture

```text
User -> Next.js frontend -> Supabase
                     -> saved search created

GitHub Actions schedule
    -> loads active searches from Supabase
    -> fetches Gumtree search pages
    -> parses listing cards
    -> deduplicates by Gumtree listing ID
    -> stores new listings in Supabase
    -> matches listings to saved searches
    -> creates alert records
    -> sends notifications
```

## 6. Core workflow

### 6.1 Search creation

1. User enters a keyword query.
2. User optionally adds:

   * location
   * radius
   * min/max price
   * included keywords
   * excluded keywords
   * category
3. System stores the search in `searches`.
4. Search becomes active and is included in the next polling run.

### 6.2 Polling loop

1. A scheduled job runs on a fixed interval.
2. The job loads all active searches that are due.
3. For each unique search, it requests the matching Gumtree search URL.
4. It parses the page and extracts listing cards.
5. It deduplicates by Gumtree listing ID or stable listing URL.
6. It inserts only new listings into `listings`.
7. It matches each listing against saved searches.
8. It writes matches to `search_matches`.
9. It creates notification rows and sends alerts.

### 6.3 Listing confirmation

When needed, the system may visit the listing detail page to collect extra fields like ad ID, exact title, posted time, and full description. This should only happen for new or uncertain results, not every record.

## 7. Technical requirements

### 7.1 Performance

* Polling should be lightweight and avoid unnecessary requests.
* One search should be scraped once per run, then fanned out to all matching users.
* The system should not scrape separately per user.
* The parser should be fast enough to finish within scheduled job limits.

### 7.2 Reliability

* Scrape jobs must be idempotent.
* Re-running a job should not create duplicate listings or duplicate alerts.
* Failed jobs must be logged with error messages.
* Jobs should retry safely.

### 7.3 Data integrity

* Use unique constraints on Gumtree listing ID or canonical URL.
* Use foreign keys between users, searches, listings, and alerts.
* Store raw payloads when helpful for debugging.

### 7.4 Security

* Use Supabase Auth for login.
* Enforce Row Level Security so users can only access their own searches and alerts.
* Keep scraping credentials, if any, server-side only.

## 8. Data model

### profiles

* id (uuid, pk, references auth.users)
* display_name
* created_at

### searches

* id (uuid, pk)
* user_id (uuid, fk profiles.id)
* query_text
* location_text
* min_price
* max_price
* radius_km
* category
* include_keywords
* exclude_keywords
* active (boolean)
* created_at
* updated_at

### listings

* id (uuid, pk)
* source (text, default `gumtree`)
* source_listing_id (text, unique)
* title
* price
* location_text
* url
* posted_at
* first_seen_at
* last_seen_at
* raw_json (jsonb)

### search_matches

* id (uuid, pk)
* search_id (uuid, fk searches.id)
* listing_id (uuid, fk listings.id)
* matched_at
* notified_at
* notification_status

### scrape_runs

* id (uuid, pk)
* search_id (uuid, fk searches.id)
* started_at
* finished_at
* status
* error_message
* listings_found

### notification_logs

* id (uuid, pk)
* user_id (uuid, fk profiles.id)
* match_id (uuid, fk search_matches.id)
* channel
* status
* sent_at
* error_message

## 9. Matching rules

A listing is a match if:

* it contains all required keywords, if any are specified
* it does not contain excluded keywords
* its price is within range, if provided
* its location is within radius, if provided
* it belongs to the chosen category, if provided

Matching should be case-insensitive and normalize whitespace and punctuation.

## 10. Scraping rules

* Scrape Gumtree search results pages only.
* Do not scrape every user independently.
* Use the search page first, then open detail pages only for new listings.
* Parse stable fields from the rendered HTML.
* Treat Gumtree listing ID or ad reference number as the primary dedupe key.
* Add backoff and rate limiting.
* Add a parser abstraction so Gumtree markup changes can be fixed in one place.

## 11. Scheduling strategy

Use GitHub Actions scheduled workflows for the polling job.

Recommended schedule:

* Every 5 minutes for MVP
* Use jitter or batching if needed to spread requests

The job should:

1. read active searches from Supabase
2. group equivalent searches to avoid duplicate fetches
3. scrape each unique query once
4. process results
5. write alerts

## 12. API / app pages

### Public

* Landing page
* Pricing page if needed
* Login / signup

### Authenticated

* Dashboard
* Saved searches list
* Create/edit search form
* Alerts feed
* Alert detail page
* Settings page

### Admin

* Job logs
* Failed runs
* Manual re-run button
* Parser diagnostics

## 13. Notification behavior

* Notify only once per new listing per matching search, unless the listing changes materially.
* Record every send attempt.
* Allow user notification preferences later.

## 14. Non-goals for MVP

* Browser automation fleet
* Captcha solving
* Multi-marketplace support
* Mobile app
* AI ranking
* User-to-user messaging

## 15. Risks and constraints

* Gumtree HTML may change.
* Gumtree may rate-limit or block automated access.
* The product should remain useful even if scraping frequency must be reduced.
* The system should include a clear path to swap in a third-party API or proxy layer later.
* Check Gumtree terms before launch, because automated scraping may be restricted.

## 16. Acceptance criteria

The build is complete when:

* a user can sign up and create a search
* the scheduler runs automatically
* new Gumtree listings are stored without duplicates
* matching listings create alerts
* the UI shows alert history
* job failures are visible in admin logs
* repeated runs do not create duplicate notifications

## 17. Implementation guidance for Claude Code

1. Scaffold Next.js with Tailwind.
2. Set up Supabase auth and DB client.
3. Create SQL migrations for all tables and RLS policies.
4. Build search CRUD UI.
5. Build a pure parser module for Gumtree HTML.
6. Build a scheduled GitHub Action that runs the scraper.
7. Upsert listings and create matches.
8. Add notification delivery and logs.
9. Add admin logs and health views.
10. Write tests for parser, dedupe, and matching rules.

## 18. Definition of done

* The app can run end-to-end from search creation to alert delivery.
* New Gumtree listings are detected within the polling interval.
* The codebase is structured so the scraper can be updated without rewriting the UI or database.
