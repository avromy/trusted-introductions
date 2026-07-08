create type public.introduction_status as enum ('drafted', 'sent', 'accepted', 'declined', 'closed');

create table if not exists public.introductions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.job_seeker_requests(id) on delete cascade,
  match_suggestion_id uuid not null references public.match_suggestions(id) on delete restrict,
  requester_identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  helper_identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  steward_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  steward_review_id uuid not null,
  status public.introduction_status not null default 'drafted',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, helper_identity_id),
  unique (match_suggestion_id),
  check (requester_identity_id <> helper_identity_id),
  check (char_length(coalesce(message, '')) <= 2000)
);

create index if not exists introductions_request_id_created_at_idx
  on public.introductions (request_id, created_at desc);

create index if not exists introductions_helper_identity_status_idx
  on public.introductions (helper_identity_id, status);

create trigger set_introductions_updated_at
  before update on public.introductions
  for each row execute function public.set_updated_at();
