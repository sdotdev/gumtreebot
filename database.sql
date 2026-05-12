-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source text DEFAULT 'gumtree'::text,
  source_listing_id text NOT NULL,
  title text,
  price numeric,
  location_text text,
  url text,
  posted_at timestamp with time zone,
  first_seen_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now(),
  raw_json jsonb,
  CONSTRAINT listings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  match_id uuid,
  channel text DEFAULT 'email'::text,
  status text DEFAULT 'pending'::text,
  sent_at timestamp with time zone,
  error_message text,
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notification_logs_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.search_matches(id)
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text,
    created_at timestamp
    with
        time zone DEFAULT now(),
        CONSTRAINT profiles_pkey PRIMARY KEY (id),
        CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id)
);

CREATE TABLE public.scrape_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  search_id uuid,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  status text DEFAULT 'running'::text,
  error_message text,
  listings_found integer DEFAULT 0,
  CONSTRAINT scrape_runs_pkey PRIMARY KEY (id),
  CONSTRAINT scrape_runs_search_id_fkey FOREIGN KEY (search_id) REFERENCES public.searches(id)
);

CREATE TABLE public.search_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  search_id uuid,
  listing_id uuid,
  matched_at timestamp with time zone DEFAULT now(),
  notified_at timestamp with time zone,
  notification_status text DEFAULT 'pending'::text,
  CONSTRAINT search_matches_pkey PRIMARY KEY (id),
  CONSTRAINT search_matches_search_id_fkey FOREIGN KEY (search_id) REFERENCES public.searches(id),
  CONSTRAINT search_matches_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id)
);

CREATE TABLE public.searches (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL,
    query_text text NOT NULL,
    location_text text,
    min_price numeric,
    max_price numeric,
    radius_km integer,
    category text,
    include_keywords ARRAY,
    exclude_keywords ARRAY,
    active boolean DEFAULT true,
    created_at timestamp
    with
        time zone DEFAULT now(),
        updated_at timestamp
    with
        time zone DEFAULT now(),
        CONSTRAINT searches_pkey PRIMARY KEY (id),
        CONSTRAINT searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id)
);