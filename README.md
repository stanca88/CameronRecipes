# Cameron Family Recipes

A family recipe collection, weekly meal planner, and automatically generated shopping list.

## Current site

The working site is available at:

https://cameron-family-recipes.mariacam88.chatgpt.site

The `main` branch contains the source used by the live site. The GitHub Actions build runs automatically after every push so broken changes are caught before deployment.

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
