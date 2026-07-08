create table if not exists public.match_suggestions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_seeker_requests(id) on delete cascade,
  helper_identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  helper_capability_id uuid not null references public.helper_capabilities(id) on delete cascade,
  rank integer not null check (rank > 0),
  score integer not null check (score >= 0 and score <= 100),
  reasons text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, helper_identity_id),
  unique (request_id, rank)
);

create index if not exists match_suggestions_request_id_rank_idx
  on public.match_suggestions (request_id, rank);

create trigger set_match_suggestions_updated_at
  before update on public.match_suggestions
  for each row execute function public.set_updated_at();
