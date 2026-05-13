-- ============================================================
-- Migration: 0002_storage.sql
-- Private bucket for permit documents + RLS policies
-- ============================================================

-- Create the bucket (private = not publicly accessible)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'permit-docs',
  'permit-docs',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Users can upload to their own folder: {user_id}/{request_id}/{doc_type}
create policy "permit-docs: user upload"
  on storage.objects for insert
  with check (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Users can read their own files
create policy "permit-docs: user read"
  on storage.objects for select
  using (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Admins can read all files
create policy "permit-docs: admin read"
  on storage.objects for select
  using (
    bucket_id = 'permit-docs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Users can delete their own files
create policy "permit-docs: user delete"
  on storage.objects for delete
  using (
    bucket_id = 'permit-docs'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
