-- MVP matching, introduction, and outcome schema.
-- Additive only: introduces new enums and tables without altering existing tables.

create type public.job_seeker_request_status as enum ('draft', 'open', 'paused', 'matched', 'closed', 'withdrawn');
create type public.helper_availability_status as enum ('available', 'limited', 'unavailable');
create type public.match_suggestion_status as enum ('proposed', 'in_review', 'approved', 'rejected', 'expired', 'converted');
create type public.steward_match_review_status as enum ('pending', 'approved', 'rejected', 'needs_info');
create type public.introduction_status as enum ('draft', 'pending_consent', 'sent', 'responded', 'completed', 'declined', 'canceled');
create type public.introduction_follow_up_status as enum ('pending', 'sent', 'skipped', 'canceled');
create type public.introduction_outcome_status as enum ('pending', 'positive', 'neutral', 'negative', 'no_response', 'unknown');

create table public.job_seeker_requests (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  community_id uuid references public.communities (id) on delete set null,
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
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_seeker_requests_headline_not_blank check (length(btrim(headline)) > 0),
  constraint job_seeker_requests_target_role_not_blank check (length(btrim(target_role)) > 0),
  constraint job_seeker_requests_closed_consistency check (
    (status in ('closed', 'withdrawn') and closed_at is not null)
    or (status not in ('closed', 'withdrawn'))
  )
);

create trigger set_job_seeker_requests_updated_at
before update on public.job_seeker_requests
for each row
execute function public.set_updated_at();

create table public.helper_capabilities (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  community_id uuid references public.communities (id) on delete set null,
  categories text[] not null default '{}'::text[],
  availability_status public.helper_availability_status not null default 'limited',
  weekly_intro_capacity integer not null default 1,
  next_available_at timestamptz,
  industries text[] not null default '{}'::text[],
  geographies text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  private_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helper_capabilities_identity_community_key unique nulls not distinct (identity_id, community_id),
  constraint helper_capabilities_categories_present check (array_length(categories, 1) > 0),
  constraint helper_capabilities_capacity_range check (weekly_intro_capacity >= 0 and weekly_intro_capacity <= 20),
  constraint helper_capabilities_availability_capacity check (
    (availability_status = 'unavailable' and weekly_intro_capacity = 0)
    or (availability_status <> 'unavailable' and weekly_intro_capacity > 0)
  )
);

create trigger set_helper_capabilities_updated_at
before update on public.helper_capabilities
for each row
execute function public.set_updated_at();

create table public.match_suggestions (
  id uuid primary key default gen_random_uuid(),
  job_seeker_request_id uuid not null references public.job_seeker_requests (id) on delete cascade,
  helper_capability_id uuid references public.helper_capabilities (id) on delete set null,
  helper_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  suggested_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  community_id uuid references public.communities (id) on delete set null,
  status public.match_suggestion_status not null default 'proposed',
  score numeric(5,2),
  rationale text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  converted_introduction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_suggestions_distinct_participants check (helper_identity_id <> suggested_by_identity_id or suggested_by_identity_id is null),
  constraint match_suggestions_score_range check (score is null or (score >= 0 and score <= 100)),
  constraint match_suggestions_request_helper_key unique (job_seeker_request_id, helper_identity_id)
);

create trigger set_match_suggestions_updated_at
before update on public.match_suggestions
for each row
execute function public.set_updated_at();

create table public.steward_match_reviews (
  id uuid primary key default gen_random_uuid(),
  match_suggestion_id uuid not null references public.match_suggestions (id) on delete cascade,
  steward_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  subject_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  status public.steward_match_review_status not null default 'pending',
  decision_reason text,
  decided_at timestamptz,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint steward_match_reviews_suggestion_steward_key unique (match_suggestion_id, steward_identity_id),
  constraint steward_match_reviews_decision_consistency check (
    (status in ('approved', 'rejected') and decided_at is not null)
    or (status not in ('approved', 'rejected') and decided_at is null)
  )
);

create trigger set_steward_match_reviews_updated_at
before update on public.steward_match_reviews
for each row
execute function public.set_updated_at();

create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  match_suggestion_id uuid references public.match_suggestions (id) on delete set null,
  job_seeker_request_id uuid not null references public.job_seeker_requests (id) on delete cascade,
  helper_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  seeker_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  introduced_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  community_id uuid references public.communities (id) on delete set null,
  status public.introduction_status not null default 'draft',
  subject text,
  message text,
  consent_requested_at timestamptz,
  consented_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introductions_distinct_participants check (helper_identity_id <> seeker_identity_id),
  constraint introductions_sent_consistency check (status <> 'sent' or sent_at is not null),
  constraint introductions_completed_consistency check (status <> 'completed' or completed_at is not null),
  constraint introductions_canceled_consistency check (status <> 'canceled' or canceled_at is not null)
);

create trigger set_introductions_updated_at
before update on public.introductions
for each row
execute function public.set_updated_at();

alter table public.match_suggestions
  add constraint match_suggestions_converted_introduction_id_fkey
  foreign key (converted_introduction_id) references public.introductions (id) on delete set null;

create table public.introduction_follow_ups (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions (id) on delete cascade,
  assigned_to_identity_id uuid references public.trusted_identities (id) on delete set null,
  status public.introduction_follow_up_status not null default 'pending',
  sequence_number integer not null default 1,
  due_at timestamptz not null,
  sent_at timestamptz,
  skipped_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_follow_ups_sequence_positive check (sequence_number > 0),
  constraint introduction_follow_ups_sent_consistency check (status <> 'sent' or sent_at is not null),
  constraint introduction_follow_ups_unique_sequence unique (introduction_id, sequence_number)
);

create trigger set_introduction_follow_ups_updated_at
before update on public.introduction_follow_ups
for each row
execute function public.set_updated_at();

create table public.introduction_outcomes (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions (id) on delete cascade,
  reported_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  status public.introduction_outcome_status not null default 'pending',
  met_at timestamptz,
  outcome_summary text,
  next_steps text,
  success_score integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_outcomes_success_score_range check (success_score is null or (success_score >= 1 and success_score <= 5))
);

create trigger set_introduction_outcomes_updated_at
before update on public.introduction_outcomes
for each row
execute function public.set_updated_at();

create index job_seeker_requests_identity_id_idx on public.job_seeker_requests (identity_id);
create index job_seeker_requests_community_status_idx on public.job_seeker_requests (community_id, status);
create index job_seeker_requests_created_at_idx on public.job_seeker_requests (created_at desc);
create index helper_capabilities_identity_id_idx on public.helper_capabilities (identity_id);
create index helper_capabilities_community_availability_idx on public.helper_capabilities (community_id, availability_status);
create index match_suggestions_request_status_idx on public.match_suggestions (job_seeker_request_id, status);
create index match_suggestions_helper_status_idx on public.match_suggestions (helper_identity_id, status);
create index match_suggestions_community_status_idx on public.match_suggestions (community_id, status);
create index steward_match_reviews_suggestion_status_idx on public.steward_match_reviews (match_suggestion_id, status);
create index steward_match_reviews_steward_status_idx on public.steward_match_reviews (steward_identity_id, status);
create index introductions_request_status_idx on public.introductions (job_seeker_request_id, status);
create index introductions_helper_status_idx on public.introductions (helper_identity_id, status);
create index introductions_seeker_status_idx on public.introductions (seeker_identity_id, status);
create index introduction_follow_ups_due_status_idx on public.introduction_follow_ups (due_at, status);
create index introduction_follow_ups_introduction_id_idx on public.introduction_follow_ups (introduction_id);
create index introduction_outcomes_introduction_id_idx on public.introduction_outcomes (introduction_id);
create index introduction_outcomes_status_idx on public.introduction_outcomes (status);

alter table public.job_seeker_requests enable row level security;
alter table public.helper_capabilities enable row level security;
alter table public.match_suggestions enable row level security;
alter table public.steward_match_reviews enable row level security;
alter table public.introductions enable row level security;
alter table public.introduction_follow_ups enable row level security;
alter table public.introduction_outcomes enable row level security;
