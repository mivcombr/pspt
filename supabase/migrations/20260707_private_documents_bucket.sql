-- Bucket de documentos privado + acesso com escopo — 2026-07-07
-- Rollback: 20260707_private_documents_bucket_rollback.sql
--
-- Antes: bucket `hospital-documents` público e com policies que davam a
-- QUALQUER usuário autenticado SELECT/INSERT/DELETE sobre os arquivos de
-- TODOS os hospitais. O app passou a usar URLs assinadas (createSignedUrl)
-- em vez de getPublicUrl, então o bucket pode ser privado.

-- 1. Torna o bucket privado (URLs públicas deixam de funcionar; só URL assinada)
update storage.buckets set public = false where id = 'hospital-documents';

-- 2. Remove as policies amplas (davam acesso cross-hospital a todo autenticado)
drop policy if exists "Allow authenticated select"  on storage.objects;
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated delete"  on storage.objects;

-- 3. Recria com escopo: admin vê tudo; demais só a pasta do próprio hospital.
--    O caminho do arquivo é `<hospital_id>/<arquivo>`, então a 1a pasta é o hospital.
create policy "hospital_docs_select" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'hospital-documents'
        and (public.is_admin_like() or (storage.foldername(name))[1] = public.get_my_hospital_id()::text)
    );

create policy "hospital_docs_insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'hospital-documents'
        and (public.is_admin_like() or (storage.foldername(name))[1] = public.get_my_hospital_id()::text)
    );

create policy "hospital_docs_delete" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'hospital-documents' and public.is_admin_like()
    );
