-- Production authorization and durable introduction workflow persistence.

create or replace function public.current_identity_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.trusted_identities where user_id = auth.uid() limit 1
$$;

create or replace function public.has_role(required_role public.user_role_name, scoped_community_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where identity_id = public.current_identity_id()
      and role = required_role
      and (community_id is null or scoped_community_id is null or community_id = scoped_community_id)
  )
$$;

create or replace function public.is_steward_or_admin(scoped_community_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('steward', scoped_community_id) or public.has_role('admin', scoped_community_id)
$$;

grant execute on function public.current_identity_id() to authenticated;
grant execute on function public.has_role(public.user_role_name, uuid) to authenticated;
grant execute on function public.is_steward_or_admin(uuid) to authenticated;

alter table public.helper_capabilities enable row level security;
alter table public.match_suggestions enable row level security;

create policy trusted_identities_read_self_or_operator on public.trusted_identities
for select to authenticated using (id = public.current_identity_id() or public.is_steward_or_admin());
create policy trusted_identities_update_self on public.trusted_identities
for update to authenticated using (id = public.current_identity_id()) with check (id = public.current_identity_id());

create policy communities_read_authenticated on public.communities
for select to authenticated using (true);
create policy communities_manage_admin on public.communities
for all to authenticated using (public.has_role('admin', id)) with check (public.has_role('admin', id));

create policy user_roles_read_self_or_operator on public.user_roles
for select to authenticated using (identity_id = public.current_identity_id() or public.is_steward_or_admin(community_id));
create policy user_roles_manage_admin on public.user_roles
for all to authenticated using (public.has_role('admin', community_id)) with check (public.has_role('admin', community_id));

create policy invitations_read_operator_or_inviter on public.invitations
for select to authenticated using (inviter_identity_id = public.current_identity_id() or public.is_steward_or_admin(community_id));
create policy invitations_create_operator on public.invitations
for insert to authenticated with check (inviter_identity_id = public.current_identity_id() and public.is_steward_or_admin(community_id));
create policy invitations_update_operator on public.invitations
for update to authenticated using (inviter_identity_id = public.current_identity_id() or public.is_steward_or_admin(community_id))
with check (inviter_identity_id = public.current_identity_id() or public.is_steward_or_admin(community_id));

create policy affiliations_read_self_or_operator on public.affiliations
for select to authenticated using (identity_id = public.current_identity_id() or public.is_steward_or_admin(community_id));
create policy affiliations_write_self on public.affiliations
for insert to authenticated with check (identity_id = public.current_identity_id());
create policy affiliations_update_self on public.affiliations
for update to authenticated using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());
create policy affiliations_delete_self on public.affiliations
for delete to authenticated using (identity_id = public.current_identity_id());

create policy privacy_settings_read_self_or_operator on public.privacy_settings
for select to authenticated using (identity_id = public.current_identity_id() or public.is_steward_or_admin());
create policy privacy_settings_insert_self on public.privacy_settings
for insert to authenticated with check (identity_id = public.current_identity_id());
create policy privacy_settings_update_self on public.privacy_settings
for update to authenticated using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy audit_events_read_operator on public.audit_events
for select to authenticated using (public.is_steward_or_admin(community_id));

create policy job_seeker_requests_read_owner_or_operator on public.job_seeker_requests
for select to authenticated using (identity_id = public.current_identity_id() or public.is_steward_or_admin());
create policy job_seeker_requests_insert_owner on public.job_seeker_requests
for insert to authenticated with check (identity_id = public.current_identity_id());
create policy job_seeker_requests_update_owner on public.job_seeker_requests
for update to authenticated using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy helper_capabilities_read_owner_or_operator on public.helper_capabilities
for select to authenticated using (identity_id = public.current_identity_id() or public.is_steward_or_admin());
create policy helper_capabilities_insert_owner on public.helper_capabilities
for insert to authenticated with check (identity_id = public.current_identity_id());
create policy helper_capabilities_update_owner on public.helper_capabilities
for update to authenticated using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());
create policy helper_capabilities_delete_owner on public.helper_capabilities
for delete to authenticated using (identity_id = public.current_identity_id());

create policy match_suggestions_read_operator on public.match_suggestions
for select to authenticated using (public.is_steward_or_admin());
create policy steward_reviews_read_operator on public.steward_reviews
for select to authenticated using (steward_identity_id = public.current_identity_id() or public.is_steward_or_admin());
create policy steward_reviews_write_operator on public.steward_reviews
for all to authenticated using (steward_identity_id = public.current_identity_id() or public.is_steward_or_admin())
with check (steward_identity_id = public.current_identity_id() or public.is_steward_or_admin());
create policy introductions_read_participant_or_operator on public.introductions
for select to authenticated using (
  requester_identity_id = public.current_identity_id()
  or helper_identity_id = public.current_identity_id()
  or created_by_identity_id = public.current_identity_id()
  or public.is_steward_or_admin()
);
create policy introductions_update_participant_or_operator on public.introductions
for update to authenticated using (
  requester_identity_id = public.current_identity_id()
  or helper_identity_id = public.current_identity_id()
  or created_by_identity_id = public.current_identity_id()
  or public.is_steward_or_admin()
) with check (
  requester_identity_id = public.current_identity_id()
  or helper_identity_id = public.current_identity_id()
  or created_by_identity_id = public.current_identity_id()
  or public.is_steward_or_admin()
);

create type public.follow_up_status as enum ('scheduled', 'completed', 'skipped', 'canceled');
create table public.introduction_follow_ups (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions(id) on delete cascade,
  created_by_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  recipient_identity_ids uuid[] not null default '{}',
  remind_at timestamptz not null,
  status public.follow_up_status not null default 'scheduled',
  private_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_follow_ups_recipients_present check (cardinality(recipient_identity_ids) > 0),
  constraint introduction_follow_ups_note_length check (private_note is null or length(private_note) <= 500),
  constraint introduction_follow_ups_completion_consistency check ((status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null))
);
create index introduction_follow_ups_due_idx on public.introduction_follow_ups(status, remind_at) where status = 'scheduled';
create index introduction_follow_ups_introduction_idx on public.introduction_follow_ups(introduction_id, created_at desc);
create trigger set_introduction_follow_ups_updated_at before update on public.introduction_follow_ups for each row execute function public.set_updated_at();
alter table public.introduction_follow_ups enable row level security;
create policy follow_ups_read_participant_or_operator on public.introduction_follow_ups
for select to authenticated using (
  created_by_identity_id = public.current_identity_id()
  or public.current_identity_id() = any(recipient_identity_ids)
  or exists (select 1 from public.introductions i where i.id = introduction_id and (i.requester_identity_id = public.current_identity_id() or i.helper_identity_id = public.current_identity_id()))
  or public.is_steward_or_admin()
);
create policy follow_ups_write_participant_or_operator on public.introduction_follow_ups
for all to authenticated using (created_by_identity_id = public.current_identity_id() or public.is_steward_or_admin())
with check (created_by_identity_id = public.current_identity_id() or public.is_steward_or_admin());

create type public.introduction_outcome_type as enum ('connected', 'meeting_scheduled', 'interview', 'offer', 'hired', 'not_a_fit', 'no_response', 'other');
create table public.introduction_outcomes (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions(id) on delete cascade,
  reporter_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  outcome public.introduction_outcome_type not null,
  private_note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_outcomes_note_length check (private_note is null or length(private_note) <= 1000)
);
create index introduction_outcomes_introduction_idx on public.introduction_outcomes(introduction_id, occurred_at desc);
create trigger set_introduction_outcomes_updated_at before update on public.introduction_outcomes for each row execute function public.set_updated_at();
alter table public.introduction_outcomes enable row level security;
create policy outcomes_read_participant_or_operator on public.introduction_outcomes
for select to authenticated using (
  reporter_identity_id = public.current_identity_id()
  or exists (select 1 from public.introductions i where i.id = introduction_id and (i.requester_identity_id = public.current_identity_id() or i.helper_identity_id = public.current_identity_id()))
  or public.is_steward_or_admin()
);
create policy outcomes_insert_participant_or_operator on public.introduction_outcomes
for insert to authenticated with check (
  reporter_identity_id = public.current_identity_id()
  and (
    exists (select 1 from public.introductions i where i.id = introduction_id and (i.requester_identity_id = public.current_identity_id() or i.helper_identity_id = public.current_identity_id() or i.created_by_identity_id = public.current_identity_id()))
    or public.is_steward_or_admin()
  )
);

create policy private_resumes_insert_owner on storage.objects
for insert to authenticated with check (
  bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text
);
create policy private_resumes_read_owner_or_operator on storage.objects
for select to authenticated using (
  bucket_id = 'private-resumes' and ((storage.foldername(name))[1] = public.current_identity_id()::text or public.is_steward_or_admin())
);
create policy private_resumes_update_owner on storage.objects
for update to authenticated using (
  bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text
) with check (
  bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text
);
create policy private_resumes_delete_owner on storage.objects
for delete to authenticated using (
  bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text
);
