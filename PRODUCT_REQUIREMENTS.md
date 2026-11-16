# Cameron Family Recipes - Product Requirements

**Status:** Source of truth for the current product  
**Last updated:** November 15, 2026
**Production site:** https://cameron-recipes.vercel.app

## 1. Purpose

Cameron Family Recipes is a simple shared family tool for keeping favorite
recipes, planning meals for the current or following week, and turning those
plans into one practical shopping list.

The product should reduce the effort between answering "What are we cooking?"
and knowing "What do we need to buy?" It should feel warm, calm, and easy enough
to use while standing in a kitchen or grocery store with a phone.

## 2. Source-of-Truth Rules

This document defines the intended product behavior and experience.

- `PRODUCT_REQUIREMENTS.md` defines what the product should do and how it
  should feel.
- `docs/EXPERIENCE_ARCHITECTURE.md` records the established screen hierarchy,
  navigation, control placement, interaction patterns, and layout invariants.
- `AGENTS.md` defines how coding agents should work on, verify, and publish the
  product.
- The application code defines the current implementation.
- A new explicit direction from the product owner overrides older wording.
  Update the PRD and experience architecture together when a requested change
  alters product behavior or an established experience invariant.
- A request to change one feature is not permission to redesign neighboring
  screens, move existing controls, or change navigation. Preserve the current
  experience unless the product owner explicitly requests a structural change.

Agents should not treat brainstormed ideas as requirements unless they are
added to this document under Current Requirements.

## 3. Product Principles

1. **Simple before clever.** Prefer clear phrases, familiar controls, and
   obvious actions over dense or novel interfaces.
2. **Designed for real family use.** The app should help multiple family
   members coordinate recipes, cooking assignments, and shopping.
3. **Mobile cooking comes first.** Ingredients, directions, and shopping items
   must be easy to read and operate on a phone.
4. **One action should do useful work.** Adding a recipe to a plan should also
   contribute its scaled ingredients to the shopping list.
5. **No ambiguous food information.** Ingredient quantities and units must be
   understandable without guessing.
6. **Preserve trust.** Shared recipes and plans should not disappear because of
   a refresh, device change, or routine site update.

## 4. Users and Core Jobs

### Primary users

Members of the Cameron family who plan meals, cook recipes, or shop for
groceries.

### Core jobs

- Save a recipe from the web or enter a family recipe manually.
- Find a saved recipe quickly.
- Choose meals for this week or next week.
- Record when a meal will be cooked and who will cook it.
- Adjust servings for the number of people eating.
- Follow a recipe comfortably from a phone while cooking.
- Shop from one categorized, checkable list.
- Look back at meals from completed weeks.

## 5. Current Product Requirements

### FR-1: Recipe collection

The product must provide a shared recipe collection.

- Display saved recipes as visual cards with a title and image when available.
- Allow a user to open a complete recipe view.
- Allow a user to add, edit, and delete recipes.
- Confirm deletion before permanently removing a recipe.
- Deleting a recipe must remove it from active plans and generated shopping
  lists, while preserving already archived history.
- Allow recipes to be searched by recipe name or inferred cuisine.
- Give each recipe a visible tag, using an inferred cuisine or `Family recipe`
  when no tag is set.
- Let users manually edit a recipe's tag and click a tag to filter the recipe
  collection.
- Show a link to the original recipe when a source URL is available.

### FR-2: Add recipes from a URL

The product must allow a user to paste a public recipe URL and attempt to import
its structured details.

- Import the title, ingredients, directions, image, and source name when those
  fields are available.
- Show the imported information in an editable review step before saving.
- Provide understandable errors when a page cannot be opened or does not
  contain readable recipe data.
- Always provide manual entry as an alternative.
- Saving a newly imported recipe must add it to the selected planning week.

Importing is best effort. Some publishers may block automated retrieval or use
unsupported markup.

### FR-3: Manual recipe entry and editing

The product must support recipes that do not come from a website.

- Require a recipe title.
- Accept an optional image URL.
- Accept one ingredient per line.
- Accept one direction per line.
- Let users edit all saved recipe fields later.
- Keep the recipe's existing Edit control in the toolbar; activating it makes
  details, ingredients, and directions editable in place.
- Keep the Back button at the same top-left position in the recipe collection
  and recipe detail views; opening a recipe must not shift it.
- Keep Edit in its established toolbar position. In edit mode, show one global
  Save and Cancel pair in that same toolbar area; do not move or duplicate
  these actions elsewhere.
- Provide separate inline editors for recipe details, ingredients, and
  directions, with one global Save and Cancel action pair shown in the toolbar.
- In the directions editor, edit each step independently and keep its optional
  image URL directly with that step; allow users to add and remove steps.
- Surface save failures rather than pretending the recipe was saved.
- Present recipe creation as a dedicated full-page experience rather than a
  modal dialog, with large labeled fields and touch-friendly controls for
  mobile use. Keep the saved recipe visible while each section is edited in
  place.

### FR-4: Ingredient understanding and display

Ingredient information must be clear and consistent wherever it appears.

- Parse common whole numbers, decimals, fractions, and Unicode fractions.
- Scale quantities when the user changes servings.
- Display common fractions in a readable form when possible.
- Spell out `cup`, `cups`, `tablespoon`, `tablespoons`, `teaspoon`, and
  `teaspoons`; do not use unclear one-letter abbreviations such as `c`.
- Do not invent a quantity for an ingredient that was saved without one.
- Display each ingredient as one clean, left-aligned phrase in uniform dark
  text.
- Wrapped ingredient text must continue from the left edge of the phrase, not
  from a separate quantity column.
- Use the same phrase-formatting behavior in recipe details and shopping lists.

Examples:

- `2 cups flour`
- `3 cloves garlic`
- `3 large eggs`
- `Kosher salt` when no quantity was provided

### FR-5: Weekly meal planning

The product must support separate plans for this week and next week.

- Let users add and remove recipes from either week.
- Show the number of selected meals in the Plan navigation.
- Let users add a free-form date or day for each meal using the placeholder
  `Add date`.
- Let users select a weekday (Sunday through Saturday) from a dropdown for
  each planned meal.
- Let users add the cook's name using the placeholder `Add chef name`.
- Let users select Rory, Maria, Emma, or Maya as the cook for each planned meal.
- Order planned recipe cards by recognized weekday after the day field is
  committed, without moving a card while the user is typing.
- Let users open a planned recipe directly from its card.
- Preserve each recipe's servings, date, and chef assignment for that week.
- Let users mark a planned dinner done and move it from `To make` to `Done`
  for that week, with a way to move it back. Keep completed dinners in the
  weekly plan and shopping-list calculations until they are removed.
- On each planned meal card, place the day and cook selectors above a green
  `Mark as done` action at the bottom. Keep the day and cook placeholder text
  the same color.
- Synchronize each week's completed dinners across devices.

### FR-6: Servings

The recipe detail view must let a user change how many people the recipe will
serve.

- Servings must never go below one.
- Ingredient quantities and shopping-list totals must scale with servings.
- On mobile, the "Cooking for" control must appear below the recipe title and
  must not cover it.

### FR-7: Cooking view

The recipe detail view must be usable while cooking.

- Provide a consistent green Back button whose text remains white on hover.
- Show Ingredients and Directions as distinct sections.
- Present Ingredients and Directions as a two-tab pivot in the recipe view.
- In the Ingredients tab, keep the ingredient list visible without an outer
  title or collapse control. Use large text-only `To use` and `Used` headings
  without a colored background; align them with the ingredient rows and keep
  their hover background padded to the left. The subsections may still collapse.
- Let users check off ingredients they have used while cooking, with checked
  ingredients remaining visibly marked.
- Organize recipe ingredients into collapsible `To use` and `Used` sections,
  moving ingredients between them when checked or unchecked.
- Present direction steps as compact checkable rows.
- Let users tap a direction step to mark it complete or incomplete.
- Show a completion message when every direction is checked.
- When a recipe is already planned, label its detail action with the week start,
  for example, `Added to Nov 15th week`.
- Do not display the removed instructional sentence, "Tap a step when you
  finish it to check it off while you cook."

### FR-8: Generated shopping list

The product must automatically generate a shopping list from recipes selected
for the active week.

- Let users add and remove shared global items for ingredients they already
  keep on hand.
- Exclude a generated recipe ingredient from the weekly categories when it
  matches a global item, while keeping the global item visible in its own
  section.
- Separate the shopping view into `From meals` and `Global` tabs.
- In `Global`, separate items to get from completed items and let users move
  an item between those sections by checking or unchecking it.
- Let users add free-form global shopping tasks.

- Combine matching ingredients across selected recipes.
- Scale totals according to each meal's servings.
- Treat canned tomato products, including crushed tomatoes, as Canned & Jarred
  Goods rather than Vegetables.
- Treat onion powder and garlic powder as Spices & Seasonings rather than dry
  goods.
- Treat fresh lemon juice as Vegetables because it requires fresh lemons.
- Combine salt variants such as kosher salt and sea salt into one `salt`
  shopping item, and combine pepper variants into one `pepper` item. Leave
  descriptors such as freshly ground or coarsely ground for recipe
  instructions rather than showing them in shopping-list ingredient names.
- Apply the same shopping-list normalization to preparation descriptors such
  as chopped, minced, diced, sliced, shredded, grated, or peeled, while
  keeping the original ingredient wording in the recipe.
- Keep water available in recipe ingredients without adding plain water to the
 shopping list; sparkling water remains a shoppable ingredient.
- Group items into practical grocery-aisle categories: Fruit, Vegetables, Meat &
 Seafood, Dairy & Eggs, Bakery, Pantry / Dry Goods, Canned & Jarred Goods,
 Soups, Broths & Stocks, Condiments & Sauces, Spices &
 Seasonings, Frozen, Snacks, Beverages, and Household / Other.
- Combine equivalent ingredient wording, including reordered quantity
  descriptors such as `1 clove garlic` and `1 garlic clove`, into one item.
- Display category cards in balanced responsive columns: one on phones, two on
  medium screens, and three on large screens.
- Keep category cards aligned from the top and allow each category to collapse
  or expand.
- Display shopping items as the same clean phrases used in recipe ingredients.
- Use checkboxes instead of ingredient bullets.
- Preserve checked state when the generated list is refreshed.
- Keep checked state synchronized across connected users/devices.

### FR-9: History

The product must preserve completed meal plans as history.

- Automatically archive a past week when it contains planned meals.
- Show the archived week range and save date.
- Show each meal's title, number of people, and optional day and chef.
- Deleting a current recipe must not rewrite previously saved history.

### FR-10: Sharing and synchronization

The product must support family members seeing shared recipe and planning data.

- Recipes, weekly plans, generated shopping lists, and history are shared
  through Supabase.
- Changes should become visible on other open clients through the current
  polling-based synchronization.
- The app should periodically refresh shared data and also provide a visible
  manual refresh control.
- A recipe detail or shopping view may be represented in the URL so it can be
  reopened or shared.
- Device-local state may be cached in browser local storage, but it must not be
  treated as the only copy of shared recipes and plans.

### FR-11: Empty states

Empty states must explain the next useful action without excessive decoration.

- An empty plan should invite the user to choose recipes.
- An empty shopping list should invite the user to add meals.
- Empty states should remain visually light and should not use a large
  background illustration.

## 6. Experience and Visual Requirements

### Brand and tone

- Product name: **Cameron Family Table** in the in-app header.
- Browser/site title: **Cameron Family Recipes**.
- Use a simple chef-hat favicon in the product's fresh lime and ink palette.
- The visual tone should feel fresh, bright, calm, and family-oriented.
- Primary colors are crisp white and cool blue-gray surfaces, bright lime
  accents, and ink-black text and actions, with light blue and soft peach as
  secondary accents.
- Recipe imagery may rotate in the header along with short family-oriented
  taglines.
- Use serif typography for meal titles and rotating family taglines; all other
  interface text uses sans-serif typography.

### Layout stability

- Preserve the established screen hierarchy, navigation, action order, and
  control locations when making a focused change.
- Keep the Back button anchored at the same top-left position when navigating
  between the recipe collection and a recipe detail.
- Do not move, reorder, rename, hide, or remove an existing control or feature
  unless the product owner explicitly requests it.
- Keep visual polish local to the requested area. A visual refresh is not
  permission to change how users navigate or where they find existing actions.
- When a requested feature cannot fit without changing an established layout
  or interaction, ask the product owner before making that structural change.
- Update `docs/EXPERIENCE_ARCHITECTURE.md` whenever an explicitly approved
  change alters the established experience.

### Control treatment

- Use pill-shaped styling for action buttons, including toolbar controls;
  icon-only controls remain circular and text-only actions stay visually quiet.
- Use a fully rounded pill shape for the Ingredients/Directions pivot and the
  collapsible global-list section headings. Show the collapsible `To use` and
  `Used` ingredient headings as large text without a colored background. Use
  the same rounded treatment for the Cooking for servings control.
- Keep the app background white. The shared-header week selector uses a
  borderless lime surface, and the Recipes action keeps its prominent book icon.
- Use fully rounded pill shapes for the week selector, Plan/Shop navigation,
  and planned-meal day and chef selectors.
- Keep Plan/Shop controls content-sized, with the selected pill filling the
  navigation control's full height.
- Use varied lime, peach, and pale blue surfaces for recipe cards in the
  collection and weekly plan, without an outer border.
- Keep the recipe detail background neutral. Reuse each recipe card's control
  palette for the servings control. Use a consistent light-green hover surface
  for interactive controls inside the recipe and for direction steps. The
  Ingredients/Directions pivot uses the active recipe's lighter control color
  for its track and darker theme color for the selected pill. Keep ingredient
  ingredient and direction checkboxes with the active recipe's lighter control
  tint when unchecked and darker theme color when checked.
- Keep recipe-card actions and selectors borderless, and theme dropdown
  surfaces and highlighted options to match their card. Tint each recipe tag
  with a darker shade of its card surface. Use the same all-caps, regular-weight
  style for recipe tags at 10px on mobile and 11px on desktop, with tight
  letter spacing. The `Mark as done` checkbox uses the card's
  tinted control color, has no border, and its hover uses a light,
  darker-than-card shade.
- Stretch the From meals/Global selector across the available width, matching
  the Ingredients/Directions pivot. Global's To get/Completed groups use the
  same card, full-width header, and item-row styling as From meals category
  groups.
- Style the Global Add a task action like Plan's Add another recipe control.
  Activating it reveals a task field with embedded checkmark and cancel
  controls. The cancel control sits to the checkmark's right, and both icons
  use the same color. Enter adds the item; Escape or Cancel dismisses the field.
- Plan/Shop, Ingredients/Directions, and From meals/Global pivots use a sliding
  black selected pill that glides in both directions; respect reduced-motion
  preferences.
- Form fields use rounded white surfaces, soft blue-gray borders, restrained
  1px borders, no drop shadows, and a visible lime focus ring. Error and disabled states remain
  distinct and legible.
- Visible control borders are 1px; controls do not use resting drop shadows.
- Ingredient, direction-step, and meal-completion checkboxes use the same
  24px circular control, 16px checkmark, and checked-state treatment.
- Switching between Ingredients and Directions slides the content horizontally;
  respect reduced-motion preferences.
- Hover and pressed states may add subtle shadow or scale feedback, but must
  not change control order, placement, or dimensions. Respect reduced-motion
  preferences.
- Keep the Cameron Family Table palette; examples supplied for a control
  refresh guide shape and interaction treatment, not a brand-color change.

### Responsive behavior

- The complete experience must work on phone and desktop layouts.
- Mobile is the priority for recipe reading and grocery shopping.
- Ingredients, directions, and shopping-list phrases use larger text on mobile
  than on wider screens.
- Mobile checkboxes, step controls, navigation controls, and recipe actions must
  have comfortable touch targets.
- Controls must not overlap recipe titles or other essential content.
- Long titles and ingredient phrases must wrap or truncate intentionally
  without breaking the layout.

### Accessibility

- Interactive controls must have visible focus behavior and accessible names.
- Keyboard users must be able to activate clickable empty states and controls.
- Color must retain sufficient contrast, including hover, completed, and
  disabled states.
- Images must have meaningful alternative text unless they are decorative.
- Completed directions and shopping items must remain understandable beyond
  color alone.

## 7. Data and Persistence

### Shared data

The current product uses Supabase tables for:

- `recipes`
- `weekly_plans`
- `shopping_list`
- `meal_history`

The application expects:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The values are deployment secrets/configuration and must never be committed.

### Browser-local data

The app uses the `cameron-family-table` local-storage key as a local cache and
for device-specific state. The `resetLocal=1` query parameter clears this local
cache once and then removes itself from the URL.

### Week definition

- A planning week runs Sunday through Saturday.
- Week records use the Sunday date as a `YYYY-MM-DD` key.
- The product exposes the current and following week for active planning.

## 8. Operational Requirements

- Production is deployed from `main` to Vercel.
- Production URL: https://cameron-recipes.vercel.app
- A change is not live until the Vercel status for the latest `main` commit is
  successful.
- GitHub Pages is not the production host because static hosting cannot run the
  recipe import and persistence API routes.
- The supported local runtime is Node.js 22.13 or newer.
- Changes must pass the existing build and relevant tests before release.
- Secrets and environment files must not be committed.

## 9. Current Constraints

- Recipe URL import depends on third-party page structure and access rules, so
  not every URL can be imported.
- Synchronization currently uses periodic polling rather than push-based
  realtime subscriptions.
- The current product has no sign-in or per-user account experience; it is a
  shared family application.
- Local development without Supabase environment values cannot display or
  modify the production recipe collection. Use `?mockRecipes=1` on localhost
  to preview sample recipes and a sample weekly plan without saving them.
- Ingredient parsing is intentionally practical rather than a complete
  culinary-language parser.

## 10. Out of Scope Unless Explicitly Requested

- Public social profiles, followers, ratings, or recipe comments
- Payments, subscriptions, or advertising
- Nutrition calculations
- Grocery delivery integrations
- Native iOS or Android applications
- Complex household roles and permissions
- Guaranteed import support for every recipe website

These are not rejected ideas; they simply are not current requirements and
should not be added incidentally.

## 11. Release Acceptance Checklist

Before calling a product update complete:

1. The requested behavior matches this PRD or the PRD was updated to reflect an
   approved change.
2. Existing recipe, plan, servings, shopping-list, and history flows still work.
3. Relevant error and empty states remain understandable.
4. The changed interface works at phone and desktop widths.
5. Mobile cooking and shopping text remains easy to read.
6. The production build and relevant existing tests pass.
7. The pull request is merged into `main`.
8. Vercel reports a successful deployment for the latest `main` commit.
9. The exact changed behavior is confirmed on the production site.
