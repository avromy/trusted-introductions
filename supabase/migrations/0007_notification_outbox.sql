-- A2 durable notification outbox: additive persistence for provider-neutral delivery work.

create type public.notification_outbox_channel as enum ('email', 'sms', 'push', 'webhook');
create type public.notification_outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'canceled');
create type public.notification_failure_classification as enum ('transient', 'permanent', 'provider', 'rate_limited', 'unknown');

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  recipient_identity_id uuid references public.trusted_identities (id) on delete set null,
  channel public.notification_outbox_channel not null,
  destination_ref text not null,
  template_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status public.notification_outbox_status not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  failure_classification public.notification_failure_classification,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_category_present check (length(btrim(category)) > 0),
  constraint notification_outbox_destination_ref_present check (length(btrim(destination_ref)) > 0),
  constraint notification_outbox_idempotency_key_present check (length(btrim(idempotency_key)) > 0),
  constraint notification_outbox_attempt_count_nonnegative check (attempt_count >= 0),
  constraint notification_outbox_template_payload_object check (jsonb_typeof(template_payload) = 'object'),
  constraint notification_outbox_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint notification_outbox_sent_consistency check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create unique index notification_outbox_idempotency_key_key
  on public.notification_outbox (idempotency_key);

create index notification_outbox_pending_claim_idx
  on public.notification_outbox (status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

create index notification_outbox_recipient_identity_id_created_at_idx
  on public.notification_outbox (recipient_identity_id, created_at desc);

create index notification_outbox_category_created_at_idx
  on public.notification_outbox (category, created_at desc);

create trigger set_notification_outbox_updated_at
before update on public.notification_outbox
for each row
execute function public.set_updated_at();

alter table public.notification_outbox enable row level security;

create policy notification_outbox_no_user_select
on public.notification_outbox
for select
to authenticated
using (false);

create policy notification_outbox_no_user_insert
on public.notification_outbox
for insert
to authenticated
with check (false);

create policy notification_outbox_no_user_update
on public.notification_outbox
for update
to authenticated
using (false)
with check (false);

create policy notification_outbox_no_user_delete
on public.notification_outbox
for delete
to authenticated
using (false);
