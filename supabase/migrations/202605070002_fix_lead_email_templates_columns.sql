alter table public.lead_email_templates
  add column if not exists template_name text,
  add column if not exists customer_type text,
  add column if not exists development_stage text,
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists language text not null default 'en',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.lead_email_templates
set
  template_name = coalesce(template_name, name, ''),
  customer_type = coalesce(customer_type, category, ''),
  development_stage = coalesce(development_stage, category, ''),
  language = coalesce(language, language_code, 'en')
where template_name is null
  or customer_type is null
  or development_stage is null
  or language is null;

alter table public.lead_email_templates
  alter column template_name set default '',
  alter column customer_type set default '',
  alter column development_stage set default '',
  alter column language set default 'en',
  alter column is_active set default true;

notify pgrst, 'reload schema';
