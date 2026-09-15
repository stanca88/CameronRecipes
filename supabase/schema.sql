-- Cameron Family Recipes
-- Supabase schema required by the current application.
--
-- Run this in Supabase Dashboard > SQL Editor for a new project.
-- Review docs/SUPABASE.md before applying it to an existing project.

create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id text primary key,
  title text not null,
  emoji text not null default '🍽️',
  time text not null default 'Family recipe',
  serves integer not null default 4 check (serves >= 1),
  author text not null default 'Family',
  ingredients jsonb not null default '[]'::jsonb,
  directions jsonb not null default '[]'::jsonb,
  image text,
  source_url text,
  source_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_ingredients_array check (jsonb_typeof(ingredients) = 'array'),
  constraint recipes_directions_array check (jsonb_typeof(directions) = 'array')
);

create table if not exists public.weekly_plans (
  week_key text primary key,
  selected_recipes jsonb not null default '[]'::jsonb,
  servings jsonb not null default '{}'::jsonb,
  chefs jsonb not null default '{}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_plans_selected_array check (jsonb_typeof(selected_recipes) = 'array'),
  constraint weekly_plans_servings_object check (jsonb_typeof(servings) = 'object'),
  constraint weekly_plans_chefs_object check (jsonb_typeof(chefs) = 'object'),
  constraint weekly_plans_days_object check (jsonb_typeof(days) = 'object')
);

create table if not exists public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  week_key text not null,
  ingredient_key text not null,
  ingredient_name text not null,
  ingredient_amount double precision not null default 0,
  ingredient_unit text not null default '',
  ingredient_category text not null default 'Pantry',
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, ingredient_key)
);

create table if not exists public.meal_history (
  id text primary key,
  label text not null,
  saved_at timestamptz not null default now(),
  meals jsonb not null default '[]'::jsonb,
  constraint meal_history_meals_array check (jsonb_typeof(meals) = 'array')
);

create index if not exists shopping_list_week_key_idx
  on public.shopping_list (week_key);

create index if not exists meal_history_saved_at_idx
  on public.meal_history (saved_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

drop trigger if exists weekly_plans_set_updated_at on public.weekly_plans;
create trigger weekly_plans_set_updated_at
before update on public.weekly_plans
for each row execute function public.set_updated_at();

drop trigger if exists shopping_list_set_updated_at on public.shopping_list;
create trigger shopping_list_set_updated_at
before update on public.shopping_list
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.shopping_list enable row level security;
alter table public.meal_history enable row level security;

-- The current product has no sign-in. Its public application therefore needs
-- read and write access through the Supabase anon role. See docs/SUPABASE.md
-- for the security implications before changing or reusing these policies.
drop policy if exists "Family app can manage recipes" on public.recipes;
create policy "Family app can manage recipes"
on public.recipes for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Family app can manage weekly plans" on public.weekly_plans;
create policy "Family app can manage weekly plans"
on public.weekly_plans for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Family app can manage shopping lists" on public.shopping_list;
create policy "Family app can manage shopping lists"
on public.shopping_list for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Family app can manage meal history" on public.meal_history;
create policy "Family app can manage meal history"
on public.meal_history for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.recipes,
  public.weekly_plans,
  public.shopping_list,
  public.meal_history
to anon, authenticated;
