-- M2 invite-only onboarding foundation: additive domain schema only.
-- This migration intentionally avoids UI, business logic, matching, and introduction workflow tables.

create type public.trusted_identity_status as enum ('pending', 'active', 'suspended', 'archived');
create type public.user_role_name as enum ('member', 'steward', 'admin');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.invite_redemption_status as enum ('not_redeemed', 'redeemed', 'blocked');
create type public.affiliation_type as enum ('member', 'alumni', 'employee', 'volunteer', 'partner', 'other');
create type public.privacy_visibility as enum ('private', 'community', 'stewards');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.trusted_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  primary_email text not null,
  display_name text,
  legal_name text,
  phone text,
  status public.trusted_identity_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trusted_identities_primary_email_key unique (primary_email),
  constraint trusted_identities_primary_email_format check (primary_email = lower(primary_email) and position('@' in primary_email) > 1)
);

create trigger set_trusted_identities_updated_at
before update on public.trusted_identities
for each row
execute function public.set_updated_at();

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  created_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_slug_key unique (slug),
  constraint communities_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

create trigger set_communities_updated_at
before update on public.communities
for each row
execute function public.set_updated_at();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  role public.user_role_name not null,
  granted_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_identity_community_role_key unique nulls not distinct (identity_id, community_id, role)
);

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_updated_at();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities (id) on delete cascade,
  inviter_identity_id uuid references public.trusted_identities (id) on delete set null,
  invitee_email text not null,
  token_hash text not null,
  status public.invitation_status not null default 'pending',
  redemption_status public.invite_redemption_status not null default 'not_redeemed',
  redeemed_by_identity_id uuid references public.trusted_identities (id) on delete set null,
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_token_hash_key unique (token_hash),
  constraint invitations_invitee_email_format check (invitee_email = lower(invitee_email) and position('@' in invitee_email) > 1),
  constraint invitations_redeemed_consistency check (
    (redemption_status = 'redeemed' and redeemed_at is not null and redeemed_by_identity_id is not null)
    or (redemption_status <> 'redeemed' and redeemed_at is null)
  )
);

create trigger set_invitations_updated_at
before update on public.invitations
for each row
execute function public.set_updated_at();

create table public.affiliations (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  affiliation_type public.affiliation_type not null default 'member',
  title text,
  organization text,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliations_identity_community_type_key unique (identity_id, community_id, affiliation_type),
  constraint affiliations_date_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create trigger set_affiliations_updated_at
before update on public.affiliations
for each row
execute function public.set_updated_at();

create table public.privacy_settings (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  profile_visibility public.privacy_visibility not null default 'community',
  contact_visibility public.privacy_visibility not null default 'private',
  resume_visibility public.privacy_visibility not null default 'private',
  allow_ai_summary boolean not null default false,
  public_meet_page_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_settings_identity_id_key unique (identity_id)
);

create trigger set_privacy_settings_updated_at
before update on public.privacy_settings
for each row
execute function public.set_updated_at();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_identity_id uuid references public.trusted_identities (id) on delete set null,
  community_id uuid references public.communities (id) on delete set null,
  event_type text not null,
  subject_table text not null,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index trusted_identities_user_id_idx on public.trusted_identities (user_id);
create index trusted_identities_primary_email_idx on public.trusted_identities (primary_email);
create index communities_slug_idx on public.communities (slug);
create index user_roles_identity_id_idx on public.user_roles (identity_id);
create index user_roles_community_id_idx on public.user_roles (community_id);
create index invitations_token_hash_idx on public.invitations (token_hash);
create index invitations_invitee_email_idx on public.invitations (invitee_email);
create index invitations_community_id_idx on public.invitations (community_id);
create index affiliations_identity_id_idx on public.affiliations (identity_id);
create index affiliations_community_id_idx on public.affiliations (community_id);
create index privacy_settings_identity_id_idx on public.privacy_settings (identity_id);
create index audit_events_actor_identity_id_idx on public.audit_events (actor_identity_id);
create index audit_events_community_id_created_at_idx on public.audit_events (community_id, created_at desc);
create index audit_events_subject_idx on public.audit_events (subject_table, subject_id);
create index audit_events_created_at_idx on public.audit_events (created_at desc);

alter table public.trusted_identities enable row level security;
alter table public.communities enable row level security;
alter table public.user_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.affiliations enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.audit_events enable row level security;
