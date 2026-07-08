-- MVP introduction records and follow-up reminders without notification infrastructure.

alter table public.privacy_settings
add column if not exists helper_activity_visible boolean not null default true;

create type public.introduction_status as enum ('pending', 'accepted', 'declined', 'completed', 'canceled');
create type public.introduction_follow_up_status as enum ('pending', 'completed', 'skipped');

create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities (id) on delete set null,
  requester_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  helper_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  recipient_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  status public.introduction_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introductions_distinct_participants check (
    requester_identity_id <> helper_identity_id
    and requester_identity_id <> recipient_identity_id
    and helper_identity_id <> recipient_identity_id
  )
);

create trigger set_introductions_updated_at
before update on public.introductions
for each row
execute function public.set_updated_at();

create table public.introduction_follow_ups (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions (id) on delete cascade,
  due_at timestamptz not null,
  status public.introduction_follow_up_status not null default 'pending',
  note text,
  created_by_identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  completed_at timestamptz,
  completed_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  skipped_at timestamptz,
  skipped_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_follow_ups_status_consistency check (
    (status = 'pending' and completed_at is null and completed_by_identity_id is null and skipped_at is null and skipped_by_identity_id is null)
    or (status = 'completed' and completed_at is not null and completed_by_identity_id is not null and skipped_at is null and skipped_by_identity_id is null)
    or (status = 'skipped' and skipped_at is not null and skipped_by_identity_id is not null and completed_at is null and completed_by_identity_id is null)
  )
);

create trigger set_introduction_follow_ups_updated_at
before update on public.introduction_follow_ups
for each row
execute function public.set_updated_at();

create index introductions_requester_identity_id_idx on public.introductions (requester_identity_id);
create index introductions_helper_identity_id_idx on public.introductions (helper_identity_id);
create index introductions_recipient_identity_id_idx on public.introductions (recipient_identity_id);
create index introductions_community_id_idx on public.introductions (community_id);
create index introduction_follow_ups_introduction_id_idx on public.introduction_follow_ups (introduction_id);
create index introduction_follow_ups_due_pending_idx on public.introduction_follow_ups (due_at) where status = 'pending';

alter table public.introductions enable row level security;
alter table public.introduction_follow_ups enable row level security;
