create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.lead_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  source_type text not null default 'manual_upload',
  status text not null default 'draft' check (status in ('draft', 'uploaded', 'mapping', 'validating', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  field_mapping jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.lead_import_batches(id) on delete set null,
  company_name text not null,
  contact_name text,
  job_title text,
  email text,
  phone text,
  whatsapp text,
  website text,
  country text,
  region text,
  industry text,
  source text,
  source_url text,
  company_size text,
  lead_status text not null default 'new' check (lead_status in ('new', 'qualified', 'contacted', 'negotiating', 'won', 'lost', 'paused')),
  tier text not null default 'unassigned' check (tier in ('A', 'B', 'C', 'unassigned')),
  tags text[] not null default array[]::text[],
  raw_payload jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_research (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  research_status text not null default 'not_started' check (research_status in ('not_started', 'in_progress', 'completed', 'needs_review')),
  summary text,
  website_snapshot jsonb not null default '{}'::jsonb,
  business_scope text,
  product_interest text,
  risk_notes text,
  source_links text[] not null default array[]::text[],
  researched_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lead_import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'duplicate', 'error', 'needs_review')),
  error_message text,
  matched_lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  task_type text not null default 'follow_up' check (task_type in ('research', 'email', 'call', 'quote', 'follow_up', 'other')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',
  language_code text not null default 'zh-CN',
  subject text not null,
  body text not null,
  variables text[] not null default array[]::text[],
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  template_id uuid references public.lead_email_templates(id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'phone', 'whatsapp', 'meeting', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  subject text,
  content text,
  communication_status text not null default 'draft' check (communication_status in ('draft', 'sent', 'received', 'failed')),
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_field_mappings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null default 'csv',
  mapping jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_import_batches_status on public.lead_import_batches(status);
create index if not exists idx_leads_company_name on public.leads(company_name);
create index if not exists idx_leads_email on public.leads(email) where email is not null;
create index if not exists idx_leads_website on public.leads(website) where website is not null;
create index if not exists idx_leads_status_tier on public.leads(lead_status, tier);
create index if not exists idx_leads_owner_next_follow_up on public.leads(owner_id, next_follow_up_at);
create index if not exists idx_lead_research_lead_id on public.lead_research(lead_id);
create index if not exists idx_lead_import_rows_batch_status on public.lead_import_rows(batch_id, validation_status);
create index if not exists idx_lead_tasks_status_due_date on public.lead_tasks(status, due_date);
create index if not exists idx_lead_tasks_lead_id on public.lead_tasks(lead_id);
create index if not exists idx_lead_communications_lead_id on public.lead_communications(lead_id);
create index if not exists idx_lead_email_templates_active on public.lead_email_templates(is_active);
create index if not exists idx_lead_field_mappings_default on public.lead_field_mappings(is_default);

drop trigger if exists set_lead_import_batches_updated_at on public.lead_import_batches;
create trigger set_lead_import_batches_updated_at
before update on public.lead_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_research_updated_at on public.lead_research;
create trigger set_lead_research_updated_at
before update on public.lead_research
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_tasks_updated_at on public.lead_tasks;
create trigger set_lead_tasks_updated_at
before update on public.lead_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_email_templates_updated_at on public.lead_email_templates;
create trigger set_lead_email_templates_updated_at
before update on public.lead_email_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_field_mappings_updated_at on public.lead_field_mappings;
create trigger set_lead_field_mappings_updated_at
before update on public.lead_field_mappings
for each row execute function public.set_updated_at();

alter table public.lead_import_batches enable row level security;
alter table public.leads enable row level security;
alter table public.lead_research enable row level security;
alter table public.lead_import_rows enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.lead_communications enable row level security;
alter table public.lead_email_templates enable row level security;
alter table public.lead_field_mappings enable row level security;

create policy "authenticated users can read lead import batches"
on public.lead_import_batches for select
to authenticated
using (true);

create policy "authenticated users can manage lead import batches"
on public.lead_import_batches for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read leads"
on public.leads for select
to authenticated
using (true);

create policy "authenticated users can manage leads"
on public.leads for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead research"
on public.lead_research for select
to authenticated
using (true);

create policy "authenticated users can manage lead research"
on public.lead_research for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead import rows"
on public.lead_import_rows for select
to authenticated
using (true);

create policy "authenticated users can manage lead import rows"
on public.lead_import_rows for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead tasks"
on public.lead_tasks for select
to authenticated
using (true);

create policy "authenticated users can manage lead tasks"
on public.lead_tasks for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead communications"
on public.lead_communications for select
to authenticated
using (true);

create policy "authenticated users can manage lead communications"
on public.lead_communications for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead email templates"
on public.lead_email_templates for select
to authenticated
using (true);

create policy "authenticated users can manage lead email templates"
on public.lead_email_templates for all
to authenticated
using (true)
with check (true);

create policy "authenticated users can read lead field mappings"
on public.lead_field_mappings for select
to authenticated
using (true);

create policy "authenticated users can manage lead field mappings"
on public.lead_field_mappings for all
to authenticated
using (true)
with check (true);

insert into public.lead_email_templates (name, category, language_code, subject, body, variables)
values
  (
    '首次开发邮件',
    'new_lead',
    'zh-CN',
    'WEIDA 产品合作咨询',
    '您好，{{contact_name}}：我们是 WEIDA 团队，想了解贵司是否有相关产品采购计划。',
    array['contact_name']
  ),
  (
    '报价后跟进',
    'quote_follow_up',
    'zh-CN',
    '关于上一封产品方案的跟进',
    '您好，想跟进确认您是否收到我们整理的产品方案。如需不同规格或包装，请告诉我们。',
    array[]::text[]
  )
on conflict do nothing;

insert into public.lead_field_mappings (name, source_type, mapping, is_default)
values
  (
    '通用客户表',
    'csv',
    '{
      "company_name": ["company", "company_name", "公司", "公司名称"],
      "contact_name": ["contact", "contact_name", "联系人"],
      "email": ["email", "mail", "邮箱"],
      "phone": ["phone", "telephone", "电话"],
      "country": ["country", "国家"],
      "website": ["website", "url", "网站"]
    }'::jsonb,
    true
  )
on conflict do nothing;
