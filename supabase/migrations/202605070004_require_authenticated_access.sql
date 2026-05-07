do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'lead_import_batches',
    'leads',
    'lead_research',
    'lead_import_rows',
    'lead_tasks',
    'lead_communications',
    'lead_email_templates',
    'lead_field_mappings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and 'anon' = any(roles)
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
    end loop;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = format('authenticated users can use %s', table_name)
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        format('authenticated users can use %s', table_name),
        table_name
      );
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
