# Cameron Recipes — Family Table

A small shared family recipe and grocery-planning app.

## What it does

- Family members sign up with email/password and a private family invite code.
- Add recipes manually or import recipe URLs, then review before saving.
- Scale each selected recipe to a chosen serving count (default 4).
- Generate one aggregated grocery list grouped by store-friendly categories.
- Grocery checkboxes persist across devices and reloads.
- Add/edit/remove ad-hoc grocery items.
- Rename trips, clear checkmarks, remove checked items, and keep shopping history snapshots.
- Search recipes and save personal favorites.

## Architecture

- **Hosting:** Node.js / Express (designed for GoDaddy Node.js Hosting)
- **Source:** GitHub
- **Auth + Database:** Supabase with Row Level Security
- **Recipe URL import:** server-side `/api/import` endpoint

## GoDaddy deployment

1. Create or open a GoDaddy **Node.js Hosting** app.
2. Connect this GitHub repository and select the `main` branch.
3. Build/install command: `npm install`
4. Start command: `npm start`
5. Node version: 20 or newer.
6. GoDaddy supplies `PORT`; the app reads it automatically.
7. After GoDaddy gives you the live URL, add that URL to Supabase Auth redirect URLs so email confirmations return to the deployed app.

No private database secret is stored in this repository. The browser uses a Supabase publishable key; access to shared tables is protected by Supabase authentication, family membership, and RLS policies.
