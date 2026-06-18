create extension if not exists "pgcrypto";

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  subscription_id text unique,
  user_agent text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_url text,
  target_type text not null default 'all',
  status text not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.push_devices enable row level security;
alter table public.push_campaigns enable row level security;

create policy "Allow anonymous device registration"
  on public.push_devices
  for insert
  to anon
  with check (true);

create policy "Allow anonymous device updates by subscription"
  on public.push_devices
  for update
  to anon
  using (subscription_id is not null)
  with check (subscription_id is not null);
