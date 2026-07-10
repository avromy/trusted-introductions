-- Add notification preferences and privacy-preserving unsubscribe controls.

create type public.notification_unsubscribe_scope as enum (
  'follow_up_reminders',
  'outcome_prompts',
  'all_optional'
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  operational_invites_enabled boolean not null default true,
  introduction_coordination_enabled boolean not null default true,
  follow_up_reminders_enabled boolean not null default false,
  outcome_prompts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_identity_id_key unique (identity_id),
  constraint notification_preferences_required_categories_enabled check (
    operational_invites_enabled = true and introduction_coordination_enabled = true
  )
);

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

create table public.notification_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities (id) on delete cascade,
  token_hash text not null,
  scope public.notification_unsubscribe_scope not null default 'all_optional',
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_unsubscribes_token_hash_key unique (token_hash),
  constraint notification_unsubscribes_token_hash_not_plaintext check (length(token_hash) = 64 and token_hash ~ '^[0-9a-f]+$')
);

create index notification_preferences_identity_id_idx on public.notification_preferences (identity_id);
create index notification_unsubscribes_token_hash_idx on public.notification_unsubscribes (token_hash);
create index notification_unsubscribes_identity_id_created_at_idx on public.notification_unsubscribes (identity_id, created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_unsubscribes enable row level security;
