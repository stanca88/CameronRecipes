# Cameron Family Recipes

A family recipe collection, weekly meal planner, and automatically generated shopping list.

## Current site

The production site is available at:

https://cameron-recipes.vercel.app

The `main` branch contains the source used by the live site. The GitHub Actions build runs automatically after every push so broken changes are caught before deployment.

## Hosting and shared data

- **Source code:** GitHub repository
  [`stanca88/CameronRecipes`](https://github.com/stanca88/CameronRecipes).
- **Hosting:** Vercel deploys the production application from the `main` branch.
  A change is live only after the latest `main` commit has a successful Vercel
  deployment.
- **Database:** Supabase stores the shared recipes, weekly plans, shopping
  lists, and meal history used by the family.
- **Local cache:** The browser also stores local planning state under the
  `cameron-family-table` local-storage key.

The application expects these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Configure their values in the local environment or Vercel project settings.
Never commit keys, tokens, passwords, or `.env` files to the repository. Without
the Supabase configuration, a local copy may run but will not show or update the
shared production recipe collection.

## Account access for maintainers and coding agents

An agent can edit local files without logging in, but it needs authorized
account access to clone private content, push a branch, open or merge a pull
request, inspect Vercel, or administer Supabase.

1. **GitHub:** Sign in to a GitHub account that has write access to
   `stanca88/CameronRecipes`. When using GitHub CLI, the account owner should
   authenticate the environment with `gh auth login`, then confirm access with
   `gh auth status`. Clone with:

   ```bash
   gh repo clone stanca88/CameronRecipes
   ```

2. **Vercel:** Add the maintainer's own Vercel account to the CameronRecipes
   project when deployment settings or logs need attention. Normal deployments
   happen automatically after changes merge into `main`, so a Vercel login is
   not required for routine code changes.
3. **Supabase:** Add the maintainer's own Supabase account to the project only
   when database tables, policies, or project settings must change. Normal
   application development uses environment variables and does not require
   sharing the owner's Supabase login.

Never send an agent a password, personal access token, API key, session cookie,
or recovery code in a prompt. The account owner should sign in through the
official service or provide access through that service's collaborator/team
settings. Use the minimum permissions needed and remove access when it is no
longer required.

## Product and agent documentation

- [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) is the human-readable
  source of truth for product behavior and experience.
- [`AGENTS.md`](AGENTS.md) explains how another coding agent should update,
  verify, and publish the site.

## Features

- Add recipes from a URL or enter them manually
- Extract recipe titles, ingredients, directions, images, and source links
- Plan meals for this week or next week
- Set servings, cooking day, and chef for each meal
- Generate a responsive shopping list from planned recipes
- Archive completed weeks automatically
- Keep local recipe and planning state in the browser

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm
- Linux, macOS, or Windows with a compatible shell environment

### Setup

```bash
npm ci
npm run dev
```

Open the local address printed by the development server.

### Production build

```bash
npm run build
```

## Important hosting note

GitHub stores and validates the source code, but this application is not a GitHub Pages site. It includes a server route for importing recipes from URLs, so it needs a host that can run the application rather than static-file hosting alone.

A GoDaddy domain can point to the deployed application after the hosting target is connected. Do not enable GitHub Pages for this repository; Pages cannot run the recipe-import route.
