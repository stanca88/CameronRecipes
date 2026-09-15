# Supabase Setup and Data Model

Supabase stores the shared data for Cameron Family Recipes. This document and
`supabase/schema.sql` are the source of truth for the database expected by the
application.

## Access

Use a Supabase account that the project owner has added as a collaborator. Do
not share the owner's password, access token, recovery code, or browser session
with an agent.

The application uses the public project URL and anon key:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The anon key is designed for browser use, but it must only provide access
allowed by Row Level Security policies. Never use or expose the Supabase
`service_role` key in this application.

## Local Configuration

1. Copy `.env.example` to `.env.local`.
2. In Supabase, open **Project Settings > API**.
3. Put the project URL and anon key into `.env.local`.
4. Keep `.env.local` untracked. Never commit its values.

Production values belong in the Vercel project's Environment Variables
settings, not in GitHub or source code.

## Create a New Database

1. Create or select the Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Review `supabase/schema.sql`.
4. Run the script.
5. Configure the two environment variables locally and in Vercel.
6. Start the app and verify that a recipe can be created, edited, and deleted;
   a weekly plan can be saved; and a shopping item can be checked.

For an existing production project, inspect its schema and back up its data
before running schema changes. `create table if not exists` does not reconcile
different existing column types or constraints.

## Tables

| Table | Purpose | Record identity |
|---|---|---|
| `recipes` | Shared recipe content and source details | Text recipe ID |
| `weekly_plans` | Recipes, servings, chefs, and dates for a Monday-based week | `YYYY-MM-DD` Monday key |
| `shopping_list` | Generated categorized ingredients and checked state | UUID plus unique week/item key |
| `meal_history` | Archived completed weeks | Text history ID |

Ingredients and directions are JSON arrays. Weekly-plan selections are a JSON
array, while servings, chefs, and days are JSON objects keyed by recipe ID.
Archived meals are stored as a JSON array so history remains intact if a live
recipe is later deleted.

## Current Access Model

The current product has no sign-in screen or household membership system.
Consequently, `supabase/schema.sql` grants the `anon` role read and write access
to all four application tables through permissive Row Level Security policies.
This matches the current application, whose API routes are publicly reachable.

This means anyone who can reach the application or discover its public
Supabase configuration could potentially read or modify family data. The anon
key is not a secret and must not be treated as an authorization boundary.

Do not tighten these policies without adding an authentication flow and
updating every affected API and client operation. Conversely, do not reuse
these permissive policies for sensitive, private, financial, medical, or
otherwise confidential information.

## Schema Changes

For every future database change:

1. Update `supabase/schema.sql` or add a reviewed migration before changing
   production.
2. Update this document and `PRODUCT_REQUIREMENTS.md` if product behavior or the
   data model changes.
3. Back up production data before destructive or type-changing SQL.
4. Apply the change to a non-production project first when possible.
5. Verify existing recipe, plan, shopping-list, and history flows.
6. Never delete production tables or columns merely to make a migration pass.

## Application Mapping

- `app/api/recipes/` reads and writes `recipes`.
- `app/api/plans/[weekKey]/route.ts` reads and writes `weekly_plans`.
- `app/api/shopping/` reads and writes `shopping_list`.
- `app/api/history/route.ts` reads and writes `meal_history`.
- `app/lib/supabase.ts` constructs the Supabase client.
- `app/lib/realtime.ts` currently synchronizes by periodic polling.
