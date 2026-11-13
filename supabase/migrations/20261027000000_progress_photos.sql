-- Private bucket for challenge progress photos. Each user reads and writes only their own folder: {user_id}/{photo_id}.jpg
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict (id) do nothing;

create policy "own progress photos: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own progress photos: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own progress photos: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
