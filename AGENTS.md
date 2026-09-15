# Cameron Family Recipes - Agent Instructions

Use this file when asking another coding agent to update the Cameron Family
Recipes website.

Read `PRODUCT_REQUIREMENTS.md` before changing product behavior. It is the
human-readable source of truth for the product's purpose, current requirements,
experience standards, constraints, and release acceptance criteria.

## Project

- Repository: `https://github.com/stanca88/CameronRecipes`
- Production site: `https://cameron-recipes.vercel.app`
- Production branch: `main`
- Runtime: Node.js 22.13 or newer
- Framework: React/Next.js application built with Vinext/Vite
- Data: shared recipes use Supabase; some planning state is also stored in the
  browser's local storage

Never put Supabase keys, access tokens, passwords, or other secrets in source
code, commits, pull requests, screenshots, or chat messages.

## Access and Authentication

The system has three separate services:

- **GitHub** (`stanca88/CameronRecipes`) stores the source code and pull
  requests.
- **Vercel** hosts and deploys the production site.
- **Supabase** stores shared application data.

Do not ask the user to paste credentials into chat. The user or account owner
must authenticate the working environment through the official service or add
the maintainer as a collaborator.

Before attempting GitHub writes, verify the active account and repository
access:

```bash
gh auth status
gh repo view stanca88/CameronRecipes
```

If GitHub is not authenticated, ask the user to complete `gh auth login`.
Authentication does not grant repository permissions by itself; the signed-in
account must also have write access. Work through a feature branch and pull
request rather than pushing directly to `main`.

Routine releases do not require an interactive Vercel login because Vercel
deploys automatically after a pull request is merged into `main`. Vercel
project access is needed only to change project settings, manage environment
variables, or inspect deployment details unavailable from the GitHub status.

Supabase dashboard access is needed only for schema, policy, or project-setting
changes. Use a separately authorized collaborator account. For normal app
development, use locally configured environment variables and never reveal or
commit their values.

## Copyable Request for an Agent

Attach this file to the agent and provide the requested change after this
prompt:

> Work on the Cameron Family Recipes repository and implement the update I
> describe below. Read and follow `PRODUCT_REQUIREMENTS.md` and `AGENTS.md`.
> Inspect the existing implementation before editing, preserve unrelated
> behavior, and match the current visual style. Verify the change with the
> repository's existing checks. Create a focused commit and pull request, merge
> it only after the checks pass, and confirm the Vercel deployment on `main`
> succeeds before saying the update is live.
>
> Requested update: [DESCRIBE THE CHANGE HERE]

## Important Files

- `app/page.tsx`: primary website interface and most UI/state behavior
- `app/layout.tsx`: page structure and metadata
- `app/api/import/route.ts`: imports recipe details from public recipe URLs
- `app/api/recipes/`: shared recipe API routes
- `app/api/plans/`, `app/api/shopping/`, and `app/api/history/`: planning,
  shopping-list, and history API routes
- `app/lib/supabase.ts`: Supabase browser client setup
- `package.json`: supported development, build, lint, and test commands
- `public/`: static images and other public assets

Search for existing helpers and UI patterns before adding new ones. In
particular, ingredient text shown in recipe details and shopping lists should
continue to use the same formatting logic.

## Local Setup

From the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server, usually
`http://localhost:5173`.

The optional Supabase configuration uses these environment variable names:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Use locally supplied or hosting-platform values only. Do not invent, publish,
or commit their values. If they are unavailable, the local site may not show
the production recipe collection. Validate data-dependent behavior on the
deployed preview or production site after deployment.

## Change Guidelines

1. Start from the latest `main` branch and work on a separate branch.
2. Inspect the relevant code before making changes; do not rewrite unrelated
   areas.
3. Preserve recipe importing, recipe persistence, weekly planning, shopping
   lists, and browser local-storage behavior unless the request explicitly
   changes them.
4. Keep layouts responsive. Check both desktop and a phone-sized viewport.
5. Keep mobile ingredients, directions, and shopping-list text easy to read and
   touch targets easy to use.
6. Use clear, complete unit names in ingredient phrases, such as `cups`,
   `tablespoons`, and `teaspoons`. Do not display ambiguous quantities.
7. Do not silently ignore failures. Show or log errors using the patterns
   already present in the project.
8. Do not commit generated output, local runtime data, dependency directories,
   or environment files.

## Verification

Run the smallest checks that cover the change. For normal UI or application
changes, run:

```bash
npm run build
```

When the changed behavior has existing test coverage, run:

```bash
npm test
```

For broader TypeScript or source changes, also run:

```bash
npm run lint
```

Resolve failures caused by the change before opening or merging a pull request.
Do not hide build or type errors.

## Publish Updates

1. Commit only the intended files with a descriptive commit message.
2. Push the feature branch and open a pull request targeting `main`.
3. Wait for required checks to pass, then merge the pull request.
4. Vercel should deploy automatically from `main`.
5. Confirm the latest `main` commit reports a successful Vercel status:

   ```bash
   gh api repos/stanca88/CameronRecipes/commits/main/status \
     --jq '{state, sha, statuses: [.statuses[] | {context, state, description, target_url}]}'
   ```

6. Open `https://cameron-recipes.vercel.app` and verify the exact changed
   behavior, including the mobile layout when relevant.

Do not tell the user an update is live while the Vercel status is pending,
failed, or rate-limited. If deployment is rate-limited, report that clearly and
wait for the limit to reset before triggering another deployment.
