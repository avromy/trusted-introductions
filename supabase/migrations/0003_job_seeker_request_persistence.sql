-- Persist job seeker requests owned by trusted identities.

create type public.job_seeker_request_status as enum (
  'draft',
  'open',
  'paused',
  'matched',
  'closed',
  'withdrawn'
);

create table public.job_seeker_requests (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  status public.job_seeker_request_status not null default 'draft',
  headline text not null,
  target_role text not null,
  target_companies text[] not null default '{}'::text[],
  target_locations text[] not null default '{}'::text[],
  remote_preference text,
  salary_expectation text,
  work_authorization text,
  notes text,
  resume_url text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_seeker_requests_headline_not_blank check (length(btrim(headline)) > 0),
  constraint job_seeker_requests_target_role_not_blank check (length(btrim(target_role)) > 0),
  constraint job_seeker_requests_opened_consistency check (status <> 'open' or opened_at is not null),
  constraint job_seeker_requests_closed_consistency check (
    (status in ('closed', 'withdrawn') and closed_at is not null)
    or (status not in ('closed', 'withdrawn'))
  )
);

create trigger set_job_seeker_requests_updated_at
before update on public.job_seeker_requests
for each row
execute function public.set_updated_at();

create index job_seeker_requests_identity_id_created_at_idx on public.job_seeker_requests (identity_id, created_at desc);
create index job_seeker_requests_status_idx on public.job_seeker_requests (status);

alter table public.job_seeker_requests enable row level security;
