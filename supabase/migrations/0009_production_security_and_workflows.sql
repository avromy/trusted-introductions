-- Production security and durable introduction workflow hardening.

create or replace function public.current_identity_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.trusted_identities where user_id = auth.uid() limit 1
$$;

create or replace function public.current_identity_has_role(required_roles public.user_role_name[], scoped_community_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.identity_id = public.current_identity_id()
      and r.role = any(required_roles)
      and (r.community_id is null or scoped_community_id is null or r.community_id = scoped_community_id)
  )
$$;

create or replace function public.identities_share_community(left_identity_id uuid, right_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.affiliations a
    join public.affiliations b on b.community_id = a.community_id
    where a.identity_id = left_identity_id and b.identity_id = right_identity_id
  )
$$;

alter table public.helper_capabilities enable row level security;
alter table public.match_suggestions enable row level security;

create policy trusted_identities_read_self on public.trusted_identities for select to authenticated
using (id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy trusted_identities_update_self on public.trusted_identities for update to authenticated
using (id = public.current_identity_id()) with check (id = public.current_identity_id());

create policy communities_read_authenticated on public.communities for select to authenticated using (true);
create policy communities_admin_write on public.communities for all to authenticated
using (public.current_identity_has_role(array['admin']::public.user_role_name[], id))
with check (public.current_identity_has_role(array['admin']::public.user_role_name[], id));

create policy user_roles_read_self_or_admin on public.user_roles for select to authenticated
using (identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[], community_id));
create policy user_roles_admin_write on public.user_roles for all to authenticated
using (public.current_identity_has_role(array['admin']::public.user_role_name[], community_id))
with check (public.current_identity_has_role(array['admin']::public.user_role_name[], community_id));

create policy invitations_read_scoped on public.invitations for select to authenticated
using (inviter_identity_id = public.current_identity_id() or redeemed_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[], community_id));

create policy affiliations_read_scoped on public.affiliations for select to authenticated
using (identity_id = public.current_identity_id() or public.identities_share_community(identity_id, public.current_identity_id()) or public.current_identity_has_role(array['steward','admin']::public.user_role_name[], community_id));
create policy affiliations_owner_write on public.affiliations for all to authenticated
using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy privacy_settings_owner_read on public.privacy_settings for select to authenticated using (identity_id = public.current_identity_id());
create policy privacy_settings_owner_write on public.privacy_settings for all to authenticated
using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy audit_events_operator_read on public.audit_events for select to authenticated
using (public.current_identity_has_role(array['steward','admin']::public.user_role_name[], community_id));

create policy job_seeker_requests_owner_read on public.job_seeker_requests for select to authenticated
using (identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy job_seeker_requests_owner_write on public.job_seeker_requests for all to authenticated
using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy helper_capabilities_owner_read on public.helper_capabilities for select to authenticated
using (identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy helper_capabilities_owner_write on public.helper_capabilities for all to authenticated
using (identity_id = public.current_identity_id()) with check (identity_id = public.current_identity_id());

create policy match_suggestions_operator_read on public.match_suggestions for select to authenticated
using (
  public.current_identity_has_role(array['steward','admin']::public.user_role_name[])
  or helper_identity_id = public.current_identity_id()
  or exists (select 1 from public.job_seeker_requests r where r.id = request_id and r.identity_id = public.current_identity_id())
);

create policy steward_reviews_operator_read on public.steward_reviews for select to authenticated
using (steward_identity_id = public.current_identity_id() or subject_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy steward_reviews_operator_write on public.steward_reviews for all to authenticated
using (steward_identity_id = public.current_identity_id() or public.current_identity_has_role(array['admin']::public.user_role_name[]))
with check (steward_identity_id = public.current_identity_id() or public.current_identity_has_role(array['admin']::public.user_role_name[]));

create policy introductions_participant_read on public.introductions for select to authenticated
using (requester_identity_id = public.current_identity_id() or helper_identity_id = public.current_identity_id() or created_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy introductions_operator_write on public.introductions for all to authenticated
using (created_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['admin']::public.user_role_name[]))
with check (created_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['admin']::public.user_role_name[]));

create type public.introduction_follow_up_status as enum ('scheduled','completed','skipped','canceled');
create table public.introduction_follow_ups (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions(id) on delete cascade,
  created_by_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  recipient_identity_ids uuid[] not null default '{}',
  remind_at timestamptz not null,
  status public.introduction_follow_up_status not null default 'scheduled',
  private_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introduction_follow_ups_future check (remind_at > created_at),
  constraint introduction_follow_ups_recipients check (cardinality(recipient_identity_ids) > 0)
);
create index introduction_follow_ups_due_idx on public.introduction_follow_ups(status, remind_at) where status = 'scheduled';
create trigger set_introduction_follow_ups_updated_at before update on public.introduction_follow_ups for each row execute function public.set_updated_at();
alter table public.introduction_follow_ups enable row level security;
create policy introduction_follow_ups_participant_read on public.introduction_follow_ups for select to authenticated
using (created_by_identity_id = public.current_identity_id() or public.current_identity_id() = any(recipient_identity_ids) or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));
create policy introduction_follow_ups_creator_write on public.introduction_follow_ups for all to authenticated
using (created_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]))
with check (created_by_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));

create type public.introduction_outcome_status as enum ('connected','meeting_scheduled','interview','offer','hired','not_a_fit','no_response','other');
create table public.introduction_outcomes (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid not null references public.introductions(id) on delete cascade,
  reporter_identity_id uuid not null references public.trusted_identities(id) on delete restrict,
  outcome public.introduction_outcome_status not null,
  private_note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (introduction_id, reporter_identity_id, outcome, occurred_at)
);
create index introduction_outcomes_introduction_idx on public.introduction_outcomes(introduction_id, occurred_at desc);
create trigger set_introduction_outcomes_updated_at before update on public.introduction_outcomes for each row execute function public.set_updated_at();
alter table public.introduction_outcomes enable row level security;
create policy introduction_outcomes_participant_read on public.introduction_outcomes for select to authenticated
using (reporter_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]) or exists (select 1 from public.introductions i where i.id = introduction_id and public.current_identity_id() in (i.requester_identity_id, i.helper_identity_id, i.created_by_identity_id)));
create policy introduction_outcomes_reporter_write on public.introduction_outcomes for all to authenticated
using (reporter_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]))
with check (reporter_identity_id = public.current_identity_id() or public.current_identity_has_role(array['steward','admin']::public.user_role_name[]));

-- Private resume storage: owners use identity-prefixed paths; stewards/admins can review.
create policy private_resumes_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text);
create policy private_resumes_owner_read on storage.objects for select to authenticated
using (bucket_id = 'private-resumes' and ((storage.foldername(name))[1] = public.current_identity_id()::text or public.current_identity_has_role(array['steward','admin']::public.user_role_name[])));
create policy private_resumes_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'private-resumes' and (storage.foldername(name))[1] = public.current_identity_id()::text);
