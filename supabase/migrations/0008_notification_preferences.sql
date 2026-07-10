create type public.notification_preference_category as enum ('invite_delivery', 'introduction_coordination', 'follow_up_reminder', 'outcome_prompt');

create table public.notification_preferences (
  identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  category public.notification_preference_category not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (identity_id, category)
);

create table public.notification_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  category public.notification_preference_category not null,
  token_hash text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint notification_unsubscribe_token_hash_present check (length(btrim(token_hash)) > 0)
);

create trigger set_notification_preferences_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_unsubscribes enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
for select to authenticated using (identity_id = public.current_identity_id());
create policy notification_preferences_insert_own on public.notification_preferences
for insert to authenticated with check (identity_id = public.current_identity_id());
create policy notification_preferences_update_own on public.notification_preferences
for update to authenticated using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy notification_unsubscribes_no_user_select on public.notification_unsubscribes for select to authenticated using (false);
create policy notification_unsubscribes_no_user_insert on public.notification_unsubscribes for insert to authenticated with check (false);
create policy notification_unsubscribes_no_user_update on public.notification_unsubscribes for update to authenticated using (false) with check (false);
create policy notification_unsubscribes_no_user_delete on public.notification_unsubscribes for delete to authenticated using (false);
