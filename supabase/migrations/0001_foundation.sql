-- M1 foundation: enable core Supabase surfaces without business-domain tables.
create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-resumes',
  'private-resumes',
  false,
  10485760,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
