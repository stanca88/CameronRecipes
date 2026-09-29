alter table public.weekly_plans
  add column if not exists done_recipes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_plans'::regclass
      and conname = 'weekly_plans_done_array'
  ) then
    alter table public.weekly_plans
      add constraint weekly_plans_done_array
      check (jsonb_typeof(done_recipes) = 'array');
  end if;
end;
$$;
