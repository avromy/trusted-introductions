do $$
begin
  create type public.steward_review_status as enum ('pending', 'approved', 'rejected', 'needs_info');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.introduction_status as enum ('draft', 'ready', 'completed', 'canceled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.steward_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_seeker_requests(id) on delete cascade,
  steward_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  subject_identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  match_suggestion_id uuid references public.match_suggestions(id) on delete set null,
  status public.steward_review_status not null default 'pending',
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint steward_reviews_unique_match unique nulls not distinct (request_id, match_suggestion_id)
);

create index if not exists steward_reviews_request_id_created_at_idx
  on public.steward_reviews (request_id, created_at desc);

create trigger set_steward_reviews_updated_at
before update on public.steward_reviews
for each row
execute function public.set_updated_at();

alter table public.steward_reviews enable row level security;

create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_seeker_requests(id) on delete cascade,
  match_id uuid not null references public.match_suggestions(id) on delete restrict,
  steward_review_id uuid not null references public.steward_reviews(id) on delete restrict,
  requester_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  helper_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  created_by_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  status public.introduction_status not null default 'draft',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introductions_unique_review unique (steward_review_id),
  constraint introductions_context_object check (jsonb_typeof(context) = 'object')
);

create index introductions_request_id_idx on public.introductions (request_id);
create index introductions_helper_identity_id_idx on public.introductions (helper_identity_id);

create trigger set_introductions_updated_at
before update on public.introductions
for each row
execute function public.set_updated_at();

alter table public.introductions enable row level security;
