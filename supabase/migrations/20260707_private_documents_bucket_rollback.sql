-- ROLLBACK de 20260707_private_documents_bucket.sql
-- Restaura o bucket público e as policies amplas originais.
-- ATENÇÃO: também é preciso reverter o app para getPublicUrl (o rollback
-- do código está no histórico do git do commit correspondente).

update storage.buckets set public = true where id = 'hospital-documents';

drop policy if exists "hospital_docs_select" on storage.objects;
drop policy if exists "hospital_docs_insert" on storage.objects;
drop policy if exists "hospital_docs_delete" on storage.objects;

create policy "Allow authenticated select" on storage.objects
    for select to authenticated using (bucket_id = 'hospital-documents');
create policy "Allow authenticated uploads" on storage.objects
    for insert to authenticated with check (bucket_id = 'hospital-documents');
create policy "Allow authenticated delete" on storage.objects
    for delete to authenticated using (bucket_id = 'hospital-documents');
