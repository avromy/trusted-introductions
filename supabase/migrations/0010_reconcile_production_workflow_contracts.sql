-- Reconcile the canonical 0009 production RLS/workflow migration with application contracts.
-- This migration is intentionally forward-only and assumes 0009_production_rls_and_workflow_persistence.sql ran first.

-- Security-definer helpers must not remain executable by PUBLIC.
revoke all on function public.current_identity_id() from public;
revoke all on function public.has_role(public.user_role_name, uuid) from public;
revoke all on function public.is_steward_or_admin(uuid) from public;
grant execute on function public.current_identity_id() to authenticated;
grant execute on function public.has_role(public.user_role_name, uuid) to authenticated;
grant execute on function public.is_steward_or_admin(uuid) to authenticated;

-- Keep durable workflow enums compatible with the application vocabulary.
alter type public.follow_up_status add value if not exists 'sent';
alter type public.introduction_outcome_type add value if not exists 'in_conversation';
alter type public.introduction_outcome_type add value if not exists 'opportunity_created';

-- Protect reminder integrity without recreating the workflow table.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'introduction_follow_ups_future'
      and conrelid = 'public.introduction_follow_ups'::regclass
  ) then
    alter table public.introduction_follow_ups
      add constraint introduction_follow_ups_future
      check (remind_at > created_at) not valid;
  end if;
end
$$;

alter table public.introduction_follow_ups
  validate constraint introduction_follow_ups_future;

-- Permit the matched helper and request owner to read their suggestion while preserving operator access.
create policy match_suggestions_read_participants on public.match_suggestions
for select to authenticated using (
  helper_identity_id = public.current_identity_id()
  or exists (
    select 1
    from public.job_seeker_requests request
    where request.id = request_id
      and request.identity_id = public.current_identity_id()
  )
);

comment on type public.follow_up_status is
  'Durable follow-up lifecycle. Application values: scheduled, sent, completed, skipped, canceled.';
comment on type public.introduction_outcome_type is
  'Durable introduction outcomes. Legacy and current application values are retained for forward compatibility.';
