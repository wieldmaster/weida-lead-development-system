alter table public.lead_email_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_email_templates'
      and policyname = 'anon users can manage lead email templates'
  ) then
    create policy "anon users can manage lead email templates"
    on public.lead_email_templates for all
    to anon
    using (true)
    with check (true);
  end if;
end;
$$;

notify pgrst, 'reload schema';
