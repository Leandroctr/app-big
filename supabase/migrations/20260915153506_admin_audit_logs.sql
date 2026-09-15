-- Canonical shared migration for the PWA-WL Supabase project.
-- Apply exactly once from app-big. Do not duplicate this migration in other PWAs.

begin;

do $$
begin
  if to_regclass('public.admin_users') is null then
    raise exception 'public.admin_users must exist before public.admin_audit_logs';
  end if;
end
$$;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  source_tenant_domain text not null,
  target_tenant_domain text null,
  actor_admin_user_id uuid null
    references public.admin_users(id)
    on delete set null,
  actor_auth_user_id uuid null,
  actor_email_snapshot text not null,
  actor_role_snapshot text not null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  outcome text not null
    constraint admin_audit_logs_outcome_check
    check (outcome in ('attempt', 'success', 'failure', 'partial')),
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  source_commit_sha text null,
  source_deployment_id text null
);

create index if not exists admin_audit_logs_source_tenant_occurred_idx
  on public.admin_audit_logs (source_tenant_domain, occurred_at desc);

create index if not exists admin_audit_logs_target_tenant_occurred_idx
  on public.admin_audit_logs (target_tenant_domain, occurred_at desc)
  where target_tenant_domain is not null;

create index if not exists admin_audit_logs_actor_occurred_idx
  on public.admin_audit_logs (actor_admin_user_id, occurred_at desc);

create index if not exists admin_audit_logs_entity_occurred_idx
  on public.admin_audit_logs (entity_type, entity_id, occurred_at desc);

create index if not exists admin_audit_logs_correlation_idx
  on public.admin_audit_logs (correlation_id);

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from public, anon, authenticated, service_role;
grant select, insert on table public.admin_audit_logs to service_role;

revoke all on sequence public.admin_audit_logs_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;

comment on table public.admin_audit_logs is
  'Append-only administrative mutation audit trail shared by the PWA-WL tenants.';

-- CREATE TABLE/INDEX IF NOT EXISTS makes a safe rerun possible. These checks ensure
-- that an incompatible pre-existing object is never silently accepted.
do $$
declare
  missing_or_incompatible_columns text;
begin
  select string_agg(expected.column_name, ', ' order by expected.ordinality)
    into missing_or_incompatible_columns
  from (
    values
      ('id', 'bigint', 'NO', 1),
      ('correlation_id', 'uuid', 'NO', 2),
      ('occurred_at', 'timestamp with time zone', 'NO', 3),
      ('source_tenant_domain', 'text', 'NO', 4),
      ('target_tenant_domain', 'text', 'YES', 5),
      ('actor_admin_user_id', 'uuid', 'YES', 6),
      ('actor_auth_user_id', 'uuid', 'YES', 7),
      ('actor_email_snapshot', 'text', 'NO', 8),
      ('actor_role_snapshot', 'text', 'NO', 9),
      ('action', 'text', 'NO', 10),
      ('entity_type', 'text', 'NO', 11),
      ('entity_id', 'text', 'YES', 12),
      ('outcome', 'text', 'NO', 13),
      ('before_json', 'jsonb', 'NO', 14),
      ('after_json', 'jsonb', 'NO', 15),
      ('metadata_json', 'jsonb', 'NO', 16),
      ('source_commit_sha', 'text', 'YES', 17),
      ('source_deployment_id', 'text', 'YES', 18)
  ) as expected(column_name, data_type, is_nullable, ordinality)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = 'admin_audit_logs'
   and actual.column_name = expected.column_name
  where actual.column_name is null
     or actual.data_type <> expected.data_type
     or actual.is_nullable <> expected.is_nullable;

  if missing_or_incompatible_columns is not null then
    raise exception
      'public.admin_audit_logs has missing or incompatible columns: %',
      missing_or_incompatible_columns;
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_logs'
  ) <> 18 then
    raise exception 'public.admin_audit_logs has unexpected extra columns';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_logs'
      and column_name = 'id'
      and is_identity = 'YES'
      and identity_generation = 'ALWAYS'
  ) then
    raise exception 'public.admin_audit_logs.id must be GENERATED ALWAYS AS IDENTITY';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (actor_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL'
  ) then
    raise exception 'public.admin_audit_logs actor foreign key is incompatible';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like
        '%outcome%attempt%success%failure%partial%'
  ) then
    raise exception 'public.admin_audit_logs outcome constraint is incompatible';
  end if;
end
$$;

commit;
