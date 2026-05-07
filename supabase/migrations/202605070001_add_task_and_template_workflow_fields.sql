alter table public.lead_tasks
  add column if not exists task_title text,
  add column if not exists task_description text,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_name text;

alter table public.lead_email_templates
  add column if not exists template_name text,
  add column if not exists customer_type text,
  add column if not exists development_stage text,
  add column if not exists language text not null default 'en';

update public.lead_tasks
set
  task_title = coalesce(task_title, title),
  task_description = coalesce(task_description, notes),
  owner_user_id = coalesce(owner_user_id, assigned_to)
where task_title is null
  or task_description is null
  or owner_user_id is null;

update public.lead_email_templates
set
  template_name = coalesce(template_name, name),
  customer_type = coalesce(customer_type, category),
  development_stage = coalesce(development_stage, category),
  language = coalesce(language, language_code, 'en')
where template_name is null
  or customer_type is null
  or development_stage is null
  or language is null;

alter table public.lead_tasks
  alter column task_title set default '',
  alter column task_description set default '';

alter table public.lead_email_templates
  alter column template_name set default '',
  alter column customer_type set default '',
  alter column development_stage set default '';

alter table public.lead_tasks
  drop constraint if exists lead_tasks_status_check,
  drop constraint if exists lead_tasks_task_type_check,
  drop constraint if exists lead_tasks_priority_check;

alter table public.lead_tasks
  add constraint lead_tasks_status_check check (status in ('pending', 'in_progress', 'completed', 'paused', 'invalid', 'skipped')),
  add constraint lead_tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent'));

create index if not exists idx_lead_tasks_status on public.lead_tasks(status);
create index if not exists idx_lead_tasks_lead_id on public.lead_tasks(lead_id);
create index if not exists idx_lead_email_templates_active on public.lead_email_templates(is_active);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_tasks'
      and policyname = 'anon users can manage lead tasks'
  ) then
    create policy "anon users can manage lead tasks"
    on public.lead_tasks for all
    to anon
    using (true)
    with check (true);
  end if;

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
