-- Storage buckets: private ID cards, public avatars
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('id-cards', 'id-cards', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars',  'avatars',  true,  2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy idcards_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
create policy idcards_read on storage.objects for select to authenticated
  using (bucket_id = 'id-cards' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy idcards_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'id-cards' and is_admin());

create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime (RLS is enforced on these streams)
alter publication supabase_realtime add table request_inbox, bunk_requests, matches, messages, profiles;

-- Expiry job: requests (10 min), availability, stale matches
create extension if not exists pg_cron;
select cron.schedule('bunk-expire-stale', '* * * * *', $$select public.expire_stale()$$);
