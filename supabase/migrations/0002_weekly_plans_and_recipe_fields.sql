-- Adds what today's UI needs on top of the existing Cameron Family Table
-- schema (cameron_recipes, cameron_family_members, cameron_profiles, and
-- the join_cameron_family RPC, all created by the original GoDaddy/Node
-- version of this app).
--
-- Assumptions about the existing schema, based on the original app code:
--   cameron_recipes(id uuid pk default gen_random_uuid(), name text,
--     servings int, image_url text, source_url text, ingredients jsonb,
--     directions jsonb, created_by uuid references auth.users(id),
--     created_at timestamptz default now(), updated_at timestamptz)
--   cameron_family_members(user_id uuid references auth.users(id))
--   cameron_profiles(user_id uuid references auth.users(id), display_name text)
--   join_cameron_family(p_code text, p_display_name text) RPC
-- If your live schema differs, adjust the column/table names below before
-- running this in the Supabase SQL editor.

-- 1. Recipe fields the current UI displays that the original schema didn't have.
alter table public.cameron_recipes
  add column if not exists emoji text,
  add column if not exists time_label text,
  add column if not exists source_name text;

-- Allow seeding starter recipes with no owning user.
alter table public.cameron_recipes alter column created_by drop not null;

-- 2. Shared weekly plan state: one row per week ("This week" / "Next week"),
-- holding which recipes are selected, servings, chef assignments, day
-- labels, and shopping-list checkmarks -- all shared across the family.
create table if not exists public.cameron_weekly_plans (
  week_key date primary key,
  selected jsonb not null default '[]'::jsonb,
  servings jsonb not null default '{}'::jsonb,
  chefs jsonb not null default '{}'::jsonb,
  days jsonb not null default '{}'::jsonb,
  checked jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- 3. Saved week history ("Save this week" snapshots).
create table if not exists public.cameron_weekly_history (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  meals jsonb not null default '[]'::jsonb,
  saved_by uuid references auth.users(id),
  saved_at timestamptz not null default now()
);

alter table public.cameron_weekly_plans enable row level security;
alter table public.cameron_weekly_history enable row level security;

drop policy if exists "Family members can read weekly plans" on public.cameron_weekly_plans;
create policy "Family members can read weekly plans" on public.cameron_weekly_plans
  for select using (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

drop policy if exists "Family members can insert weekly plans" on public.cameron_weekly_plans;
create policy "Family members can insert weekly plans" on public.cameron_weekly_plans
  for insert with check (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

drop policy if exists "Family members can update weekly plans" on public.cameron_weekly_plans;
create policy "Family members can update weekly plans" on public.cameron_weekly_plans
  for update using (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

drop policy if exists "Family members can read weekly history" on public.cameron_weekly_history;
create policy "Family members can read weekly history" on public.cameron_weekly_history
  for select using (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

drop policy if exists "Family members can insert weekly history" on public.cameron_weekly_history;
create policy "Family members can insert weekly history" on public.cameron_weekly_history
  for insert with check (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

drop policy if exists "Family members can delete weekly history" on public.cameron_weekly_history;
create policy "Family members can delete weekly history" on public.cameron_weekly_history
  for delete using (exists (select 1 from public.cameron_family_members m where m.user_id = auth.uid()));

-- 4. Turn on realtime so every family member's device sees changes live.
alter publication supabase_realtime add table public.cameron_recipes;
alter publication supabase_realtime add table public.cameron_weekly_plans;
alter publication supabase_realtime add table public.cameron_weekly_history;

-- 5. Seed the three starter recipes once, if the table is still empty.
insert into public.cameron_recipes (name, emoji, time_label, servings, ingredients, directions, created_by)
select * from (values
  ('Italian Pasta Salad','🥗','25 min',6,
   '["1 lb rotini pasta","2 cups cherry tomatoes","1 cucumber","1 red bell pepper","8 oz mozzarella pearls","1 cup Italian dressing"]'::jsonb,
   '["Cook the pasta until al dente, then drain and rinse under cold water.","Chop the vegetables and combine them with the pasta and mozzarella.","Toss with Italian dressing and chill before serving."]'::jsonb,
   null::uuid),
  ('Lemon Herb Chicken','🍋','40 min',4,
   '["4 chicken breasts","2 lemons","4 garlic cloves","3 tbsp olive oil","1.5 lb baby potatoes"]'::jsonb,
   '["Heat the oven to 425°F.","Coat the chicken and potatoes with lemon, garlic, olive oil, salt, and herbs.","Roast for 30–35 minutes, until the chicken is cooked through."]'::jsonb,
   null::uuid),
  ('Weeknight Turkey Tacos','🌮','20 min',4,
   '["1 lb ground turkey","1 packet taco seasoning","12 corn tortillas","2 cups shredded lettuce","1 cup shredded cheese","1 jar salsa"]'::jsonb,
   '["Brown the turkey in a skillet over medium heat.","Add taco seasoning and water, then simmer for 5 minutes.","Warm the tortillas and serve with the toppings."]'::jsonb,
   null::uuid)
) as seed(name, emoji, time_label, servings, ingredients, directions, created_by)
where not exists (select 1 from public.cameron_recipes);
