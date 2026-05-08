drop policy if exists "profiles delete team managers" on public.user_profiles;

create policy "profiles delete team managers"
on public.user_profiles for delete
to authenticated
using (
  public.is_team_manager()
  and user_id <> auth.uid()
);
