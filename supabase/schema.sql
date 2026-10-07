-- nimi-router Supabase schema
-- Run this in your Supabase project's SQL Editor (once).
-- All access uses the service_role key server-side; never expose it to browsers.

create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  api_keys text[] not null default '{}',
  models text[] not null default '{*}',
  priority int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists request_logs (
  id bigint generated always as identity primary key,
  time timestamptz not null default now(),
  model text not null,
  provider text not null,
  key_masked text not null default '',
  success boolean not null,
  latency_ms int not null default 0,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  error text
);

-- Helpful indexes for the dashboard queries
create index if not exists idx_request_logs_time on request_logs (time desc);
create index if not exists idx_request_logs_provider on request_logs (provider);

-- Optional: prune old logs (keep 30 days). Run manually or via pg_cron.
-- delete from request_logs where time < now() - interval '30 days';
