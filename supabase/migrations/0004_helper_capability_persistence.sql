create table if not exists public.helper_capabilities (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.trusted_identities(id) on delete cascade,
  categories text[] not null default '{}',
  availability_status text not null default 'limited' check (availability_status in ('available', 'limited', 'unavailable')),
  weekly_intro_capacity integer not null default 1 check (weekly_intro_capacity >= 0 and weekly_intro_capacity <= 20),
  next_available_at timestamptz,
  industries text[] not null default '{}',
  geographies text[] not null default '{}',
  languages text[] not null default '{}',
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helper_capabilities_identity_unique unique (identity_id)
);

create index if not exists helper_capabilities_availability_idx
  on public.helper_capabilities (availability_status, updated_at desc);
