alter table public.lead_import_batches
  add column if not exists batch_name text,
  add column if not exists original_filename text,
  add column if not exists valid_rows integer not null default 0 check (valid_rows >= 0),
  add column if not exists skipped_rows integer not null default 0 check (skipped_rows >= 0),
  add column if not exists mapping_confidence numeric(5, 4) not null default 0,
  add column if not exists import_summary_json jsonb not null default '{}'::jsonb;

alter table public.leads
  add column if not exists normalized_company_name text,
  add column if not exists normalized_phone text,
  add column if not exists fax text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists product_keywords text,
  add column if not exists customer_type text,
  add column if not exists source_type text,
  add column if not exists source_detail text,
  add column if not exists development_level text not null default 'C',
  add column if not exists priority_score integer not null default 0 check (priority_score >= 0 and priority_score <= 100),
  add column if not exists status text not null default '待开发';

alter table public.lead_import_rows
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists sheet_name text,
  add column if not exists raw_row_json jsonb not null default '{}'::jsonb,
  add column if not exists mapped_row_json jsonb not null default '{}'::jsonb,
  add column if not exists mapping_confidence numeric(5, 4) not null default 0,
  add column if not exists import_status text not null default 'skipped';

create index if not exists idx_leads_normalized_company_name on public.leads(normalized_company_name) where normalized_company_name is not null;
create index if not exists idx_leads_source_type on public.leads(source_type) where source_type is not null;
create index if not exists idx_leads_development_level on public.leads(development_level);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_lead_import_rows_import_status on public.lead_import_rows(import_status);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_import_batches'
      and policyname = 'anon users can manage lead import batches'
  ) then
    create policy "anon users can manage lead import batches"
    on public.lead_import_batches for all
    to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'anon users can manage leads'
  ) then
    create policy "anon users can manage leads"
    on public.leads for all
    to anon
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_import_rows'
      and policyname = 'anon users can manage lead import rows'
  ) then
    create policy "anon users can manage lead import rows"
    on public.lead_import_rows for all
    to anon
    using (true)
    with check (true);
  end if;
end;
$$;
