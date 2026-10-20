-- 0236: KYC real (bucket privado + RLS) e restrição de serviços ao cadastro

-- ===== Storage privado para documentos de verificação =====
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('verification-documents', 'verification-documents', false)
    on conflict (id) do nothing;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    begin
      create policy "verification_docs_storage_insert" on storage.objects for insert to authenticated
        with check (
          bucket_id = 'verification-documents'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    exception when duplicate_object then null;
    end;

    begin
      create policy "verification_docs_storage_select" on storage.objects for select to authenticated
        using (
          bucket_id = 'verification-documents'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    exception when duplicate_object then null;
    end;

    begin
      create policy "verification_docs_storage_delete" on storage.objects for delete to authenticated
        using (
          bucket_id = 'verification-documents'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ===== RLS da tabela de documentos =====
alter table verification_documents enable row level security;

drop policy if exists "verification_docs_select_own" on verification_documents;
create policy "verification_docs_select_own" on verification_documents
  for select to authenticated
  using (provider_id = auth.uid());

drop policy if exists "verification_docs_insert_own" on verification_documents;
create policy "verification_docs_insert_own" on verification_documents
  for insert to authenticated
  with check (provider_id = auth.uid());

-- ===== Serviços só nas categorias do cadastro =====
create or replace function enforce_provider_service_category()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
      from provider_profiles pp
     where pp.profile_id = new.provider_id
       and (
         pp.primary_category_id = new.category_id
         or exists (
           select 1 from provider_categories pc
            where pc.provider_id = pp.profile_id
              and pc.category_id = new.category_id
         )
       )
  ) then
    raise exception 'O serviço tem de pertencer a uma categoria do cadastro do mestre.';
  end if;

  if not exists (
    select 1 from categories c where c.id = new.category_id and c.is_active
  ) then
    raise exception 'Categoria inválida ou inactiva.';
  end if;

  return new;
end $$;

drop trigger if exists trg_provider_services_category on provider_services;
create trigger trg_provider_services_category
  before insert or update of provider_id, category_id on provider_services
  for each row execute function enforce_provider_service_category();
