create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  email text,
  role text not null default 'sales' check (role in ('admin', 'manager', 'sales')),
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_active on public.user_profiles(is_active);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name, display_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    new.email,
    case when lower(new.email) = 'elan.xing@wieldmaster.com' then 'admin' else 'sales' end
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
    role = case
      when lower(excluded.email) = 'elan.xing@wieldmaster.com' then 'admin'
      else public.user_profiles.role
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.user_profiles (user_id, full_name, display_name, email, role)
select
  users.id,
  nullif(users.raw_user_meta_data ->> 'full_name', ''),
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), users.email),
  users.email,
  case when lower(users.email) = 'elan.xing@wieldmaster.com' then 'admin' else 'sales' end
from auth.users
on conflict (user_id) do update
set
  email = excluded.email,
  full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
  display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
  role = case
    when lower(excluded.email) = 'elan.xing@wieldmaster.com' then 'admin'
    else public.user_profiles.role
  end;

update auth.users
set
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Elan', 'role', 'admin'),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = 'elan.xing@wieldmaster.com';

update public.user_profiles
set
  full_name = coalesce(full_name, 'Elan'),
  display_name = coalesce(display_name, 'Elan'),
  role = 'admin',
  is_active = true
where lower(email) = 'elan.xing@wieldmaster.com';

alter table public.leads
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_name text,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists claim_status text not null default '公海' check (claim_status in ('公海', '已分配', '跟进中', '已成交', '暂缓', '无效')),
  add column if not exists last_activity_at timestamptz,
  add column if not exists next_followup_at timestamptz;

update public.leads
set
  owner_user_id = coalesce(owner_user_id, owner_id),
  claim_status = case
    when coalesce(owner_user_id, owner_id) is null then '公海'
    when claim_status is null or claim_status = '公海' then '已分配'
    else claim_status
  end,
  next_followup_at = coalesce(next_followup_at, next_follow_up_at),
  last_activity_at = coalesce(last_activity_at, last_contacted_at)
where owner_user_id is null
  or claim_status is null
  or next_followup_at is null
  or last_activity_at is null;

alter table public.lead_tasks
  add column if not exists task_title text,
  add column if not exists task_description text,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_name text,
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_user_name text,
  add column if not exists completed_by uuid references auth.users(id) on delete set null;

update public.lead_tasks
set
  assigned_user_id = coalesce(assigned_user_id, owner_user_id, assigned_to),
  assigned_user_name = coalesce(assigned_user_name, owner_name),
  completed_by = case when status = 'completed' then coalesce(completed_by, assigned_user_id, owner_user_id, assigned_to) else completed_by end,
  completed_at = case when status = 'completed' then coalesce(completed_at, updated_at, now()) else completed_at end
where assigned_user_id is null
  or assigned_user_name is null
  or (status = 'completed' and completed_at is null);

alter table public.lead_tasks
  drop constraint if exists lead_tasks_priority_check;

alter table public.lead_tasks
  alter column priority set default '普通',
  add constraint lead_tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent', '低', '普通', '高', '紧急'));

alter table public.lead_communications
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists user_name text,
  add column if not exists contact_method text,
  add column if not exists contact_result text,
  add column if not exists next_action text,
  add column if not exists next_followup_at timestamptz;

update public.lead_communications
set
  user_id = coalesce(user_id, created_by),
  contact_method = coalesce(contact_method, channel)
where user_id is null
  or contact_method is null;

create index if not exists idx_leads_owner_user_id on public.leads(owner_user_id);
create index if not exists idx_leads_claim_status on public.leads(claim_status);
create index if not exists idx_leads_next_followup_at on public.leads(next_followup_at);
create index if not exists idx_leads_last_activity_at on public.leads(last_activity_at);
create index if not exists idx_lead_tasks_assigned_user_id on public.lead_tasks(assigned_user_id);
create index if not exists idx_lead_tasks_completed_by on public.lead_tasks(completed_by);
create index if not exists idx_lead_communications_user_id on public.lead_communications(user_id);
create index if not exists idx_lead_communications_next_followup_at on public.lead_communications(next_followup_at);

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role from public.user_profiles where user_id = auth.uid() and is_active = true limit 1),
    'sales'
  );
$$;

create or replace function public.is_team_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager');
$$;

alter table public.user_profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.lead_communications enable row level security;
alter table public.lead_import_batches enable row level security;
alter table public.lead_import_rows enable row level security;

do $$
declare
  policy_record record;
  target_table text;
begin
  foreach target_table in array array[
    'user_profiles',
    'leads',
    'lead_tasks',
    'lead_communications',
    'lead_import_batches',
    'lead_import_rows'
  ]
  loop
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;
  end loop;
end;
$$;

create policy "profiles select own or team"
on public.user_profiles for select
to authenticated
using (user_id = auth.uid() or public.is_team_manager());

create policy "profiles insert own"
on public.user_profiles for insert
to authenticated
with check (
  public.is_team_manager()
  or (
    user_id = auth.uid()
    and role = case
      when lower(coalesce(email, '')) = 'elan.xing@wieldmaster.com' then 'admin'
      else 'sales'
    end
  )
);

create policy "profiles update own basic or team"
on public.user_profiles for update
to authenticated
using (user_id = auth.uid() or public.is_team_manager())
with check (
  public.is_team_manager()
  or (
    user_id = auth.uid()
    and role = public.current_user_role()
  )
);

create policy "leads select by ownership"
on public.leads for select
to authenticated
using (
  public.is_team_manager()
  or owner_user_id = auth.uid()
  or owner_user_id is null
  or claim_status = '公海'
);

create policy "leads insert authenticated"
on public.leads for insert
to authenticated
with check (
  public.is_team_manager()
  or owner_user_id = auth.uid()
  or owner_user_id is null
  or claim_status = '公海'
);

create policy "leads update by ownership"
on public.leads for update
to authenticated
using (
  public.is_team_manager()
  or owner_user_id = auth.uid()
  or owner_user_id is null
  or claim_status = '公海'
)
with check (
  public.is_team_manager()
  or owner_user_id = auth.uid()
  or owner_user_id is null
  or claim_status = '公海'
);

create policy "leads delete team only"
on public.leads for delete
to authenticated
using (public.is_team_manager());

create policy "tasks select by assignee or lead owner"
on public.lead_tasks for select
to authenticated
using (
  public.is_team_manager()
  or assigned_user_id = auth.uid()
  or owner_user_id = auth.uid()
  or exists (
    select 1 from public.leads
    where leads.id = lead_tasks.lead_id
      and leads.owner_user_id = auth.uid()
  )
);

create policy "tasks insert by assignee"
on public.lead_tasks for insert
to authenticated
with check (
  public.is_team_manager()
  or assigned_user_id = auth.uid()
  or assigned_user_id is null
);

create policy "tasks update by assignee or lead owner"
on public.lead_tasks for update
to authenticated
using (
  public.is_team_manager()
  or assigned_user_id = auth.uid()
  or owner_user_id = auth.uid()
  or exists (
    select 1 from public.leads
    where leads.id = lead_tasks.lead_id
      and leads.owner_user_id = auth.uid()
  )
)
with check (
  public.is_team_manager()
  or assigned_user_id = auth.uid()
  or assigned_user_id is null
);

create policy "tasks delete team only"
on public.lead_tasks for delete
to authenticated
using (public.is_team_manager());

create policy "communications select by ownership"
on public.lead_communications for select
to authenticated
using (
  public.is_team_manager()
  or user_id = auth.uid()
  or exists (
    select 1 from public.leads
    where leads.id = lead_communications.lead_id
      and (
        leads.owner_user_id = auth.uid()
        or leads.owner_user_id is null
        or leads.claim_status = '公海'
      )
  )
);

create policy "communications insert current user"
on public.lead_communications for insert
to authenticated
with check (
  public.is_team_manager()
  or user_id = auth.uid()
);

create policy "communications update own or team"
on public.lead_communications for update
to authenticated
using (public.is_team_manager() or user_id = auth.uid())
with check (public.is_team_manager() or user_id = auth.uid());

create policy "import batches authenticated"
on public.lead_import_batches for all
to authenticated
using (true)
with check (true);

create policy "import rows authenticated"
on public.lead_import_rows for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
