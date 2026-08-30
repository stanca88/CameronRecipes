# Cameron Family Recipes

A shared family recipe box: save recipes (manually or by pasting a link),
plan meals for this week and next week, assign a chef and a day to each
meal, and get one combined shopping list. Everything is shared live across
every signed-in family member via [Supabase](https://supabase.com)
(auth + Postgres), and the app runs as a plain Node server so it can be
hosted on GoDaddy (or any Node host).

## Stack

- **Client**: React 19 + Vite, Tailwind CSS v4, shadcn/radix-ui components
- **Server**: Express (`server.js`) — serves the built client and a
  `/api/import` endpoint that fetches a recipe URL and extracts its
  `schema.org/Recipe` structured data
- **Data**: Supabase (Postgres + Auth + Realtime) — recipes, weekly plans,
  and meal-week history all live in shared tables, gated by a family
  invite code

## Prerequisites

- Node.js `>=20`
- A Supabase project (this app is currently pointed at an existing one —
  see `src/lib/supabase.ts` and `server.js` for the URL/key, and
  `supabase/migrations/` for the schema it expects)

## Local development

```bash
npm install
npm run dev
```

This runs the Vite dev server (with hot reload) and `server.js` together;
`/api/*` requests are proxied from Vite to the Express server. Open the
printed `http://localhost:5173` URL.

## Building and running for production (GoDaddy Node hosting)

```bash
npm install
npm run build   # builds the client into dist/
npm start       # node server.js — serves dist/ and the /api routes
```

`server.js` listens on `process.env.PORT` (defaults to `3000`). On GoDaddy's
Node hosting, point the app's entry point at `server.js` and set the `PORT`
environment variable it provides; the server will pick it up automatically.

Point your GoDaddy domain's DNS at wherever the Node app is actually
running (GoDaddy's own Node hosting, or another host, with GoDaddy just
managing the domain).

## Supabase setup

The app expects these tables to already exist (created by the original
version of this app): `cameron_recipes`, `cameron_family_members`,
`cameron_profiles`, and a `join_cameron_family(p_code, p_display_name)` RPC
used for the family invite-code flow.

Run `supabase/migrations/0002_weekly_plans_and_recipe_fields.sql` in the
Supabase SQL editor to add what today's UI needs on top of that: a few new
recipe columns (`emoji`, `time_label`, `source_name`), the
`cameron_weekly_plans` and `cameron_weekly_history` tables for shared
weekly planning and saved-week history, row-level security policies
scoped to family members, and realtime enabled on all three tables.

The client and server both use Supabase's **publishable** key
(`sb_publishable_...`), which is safe to ship to the browser — access is
controlled by Row Level Security, not by keeping that key secret. Nothing
in this app uses a Supabase service-role key.

## Diagnostic commands

- `npm run dev`: start the Vite dev server + Express API together
- `npm run build`: build the production client into `dist/`
- `npm start`: run the production server (`node server.js`)
- `npm test`: build, then run the smoke tests in `tests/`
- `npm run lint`: run ESLint
