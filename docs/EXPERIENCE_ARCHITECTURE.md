# Cameron Family Table - Experience Architecture

**Status:** Baseline for preserving the current user experience
**Last updated:** November 15, 2026
**Related requirements:** [`PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md)

## Purpose

This document records where existing features live, how users move between
them, and which interaction and layout decisions must remain stable. Read it
with `PRODUCT_REQUIREMENTS.md` before changing the interface.

The requirements document defines product behavior. This document defines the
established experience and its placement. A focused feature request does not
authorize a redesign of adjacent areas. When the product owner explicitly
approves a structural change, update both documents in the same change.

## Information architecture

```mermaid
flowchart TD
    Collection["Recipes collection"] --> Detail["Recipe detail"]
    Collection --> Add["Add recipe"]
    Detail --> Edit["Inline recipe editing"]
    Detail -->|"Add to selected week"| Plan["Weekly plan"]
    Plan -->|"Open planned recipe"| Detail
    Plan --> Shop["Shopping list"]
    Shell["Shared app header"] --> Plan
    Shell --> Shop
    Shell --> History["History, through week selector"]
    Shell -->|"Recipes action"| Collection
```

### Global navigation

- The Recipes collection is its own full-page view. The shared photo/tagline
  header is not shown in this view.
- In the shared header, the circular **Recipes** action returns to the
  collection. **Plan** and **Shop** are the two tabs beside the week selector.
- The week selector chooses **This week**, **Next week**, or **History**.
  History is reached through this selector, not by adding another primary
  navigation tab.
- The Plan tab shows a selected-meal count when the current plan is not empty.
- A fixed refresh action remains at the bottom-right of the main app views.
- A selected recipe and supported view state can be represented in the URL.
  Preserve existing deep-link and browser-navigation behavior.

## Screen and control placement

### Recipes collection

- The collection toolbar places **Back** at the leading edge and the
  **Add recipe** and **Search** actions together at the trailing edge.
- Keep Back at the same top-left anchor in the collection and recipe detail
  views. Opening a recipe must not create a vertical or horizontal jump.
- Search and tag filtering narrow the existing collection; they do not replace
  or hide its primary toolbar.
- Recipe cards show the meal image, title, tag, and available source link.
  The card's meal title is serif; supporting content and actions are sans-serif.
- Selecting a recipe opens its detail view. Planned recipe cards use the same
  recipe identity and also open that detail view.

### Recipe detail

The content order is deliberate:

1. A toolbar above the recipe content, aligned to the collection toolbar:
   **Back** on the left; **Add to week**,
   **Edit**, and **Delete** grouped on the right, in that order.
2. The recipe's primary image.
3. Recipe tag and source link.
4. The serif meal title, with the **Cooking for** servings control alongside
   it on wider screens and below it on narrow screens.
5. A divider, then the **Ingredients** / **Directions** tab pivot.
6. The selected tab's content.

The toolbar is the stable home for recipe actions. Do not move Edit to the
title, image, page footer, or a separate menu. On mobile, controls may use
compact icon treatments, but their meaning, order, and toolbar location remain
the same.

#### Recipe editing

- Activating **Edit** makes recipe details, ingredients, and directions
  editable in place; it does not open a separate editor page or modal.
- Keep the toolbar action group in place. Replace Edit with exactly one global
  **Save** and **Cancel** pair in that same area. Keep **Back** and
  **Add to week** in their existing positions; keep **Delete** in the toolbar.
- Details, ingredients, and directions remain in their corresponding sections.
  Do not combine them into one editor section or move them to another screen.
- Directions are a list of independent step cards. Each step's text and
  optional image URL belong together. Adding or removing a step must not
  separate its image from its text.
- Save failures remain visible in the recipe view. Cancel discards the
  unsaved draft and returns the recipe to read mode.

#### Cooking view

- Ingredients and Directions remain two tabs, not separate top-level routes or
  navigation destinations.
- The Ingredients tab has a visible section heading and no outer
  collapse/expand control. Its `To use` and `Used` subsections remain
  individually collapsible and move ingredients when they are checked or
  unchecked.
- Directions remain ordered, checkable steps with any associated step image.
  Completion feedback stays with the directions experience.
- Preserve the servings control's position below the title on mobile; it must
  not overlap or push recipe actions into a different region.

### Add recipe

- Adding a recipe is a dedicated full-page flow, not a modal.
- It starts with a recipe URL import option and a manual-entry alternative.
- Import review presents the extracted recipe as editable fields before save.
  Manual entry uses the same recipe fields.
- The Save action remains after the editable content. Errors are shown with the
  form, and successful saves add the recipe to the selected week.
- Direction text and its optional image URL remain paired by step during
  import, editing, and saving.

### Weekly plan

- The shared header remains above the planning content, with the week selector
  and Plan/Shop navigation in its lower control row.
- Planned meals are grouped under **To make** and **Done**. Completion moves a
  meal between these groups without removing it from the week's plan.
- Each meal card retains its date/day, cook, servings, and completion actions.
- **Add another recipe** opens recipe picking within the plan flow. Choosing
  a recipe should not change the location of the week selector or primary
  navigation.
- The empty plan invites the user to choose recipes without adding a new
  navigation path.

### Shopping list

- The shared header and selected planning week stay visible above the list.
- The shopping view has exactly two source tabs: **From meals** and
  **Global**.
- **From meals** displays generated ingredients grouped by grocery category.
  Category cards keep their rounded lime headers, checkboxes, and existing
  collapse controls. On wider screens, columns are balanced and aligned from
  the top.
- **Global** keeps the add-item input first, followed by the collapsible
  **To get** and **Completed** sections. Checking an item moves it between
  these sections; removal stays beside the item.
- Keep the empty shopping state's action connected to adding meals.

### History

- History is selected from the week selector in the shared header.
- Each saved week card keeps its week range and save date at the top, followed
  by its meal cards and available date/cook details.
- History is read-only with respect to the current recipe collection; deleting
  a current recipe does not rewrite archived meals.

## Shared visual language

- Use the bright, fresh palette: cool blue-gray page surfaces, white cards,
  bright lime section accents, ink-dark text/actions, and soft peach for
  destructive/error emphasis. Do not revert to the former cream palette unless
  requested.
- Keep the existing rounded card and lime section-header treatment.
- Use a simple chef-hat favicon on a rounded lime tile, with a white hat and
  ink outline.
- Use serif only for meal/recipe titles and the rotating family tagline. All
  navigation, labels, descriptions, section headings, forms, and other
  interface copy use sans-serif.
- Keep photographs attached to the recipe or direction step they describe;
  do not substitute unrelated imagery.
- Keep mobile text, checkboxes, and primary controls comfortable to read and
  tap. Responsive changes may compact controls but must not change their
  hierarchy or move them to unrelated areas.

## Persistence and state boundaries

- Shared recipes, weekly plans, generated and global shopping lists, and meal
  history are persisted through the existing Supabase-backed APIs.
- Browser-local state is a cache or device-specific state, not the authoritative
  copy of shared data.
- The local `?mockRecipes=1` preview is temporary and explicitly indicates
  that edits are not saved. Do not let mock preview behavior leak into normal
  production flows.
- Preserve refresh, synchronization, selected-week, and supported URL state
  when changing view components.

## Change-safety contract

For every future UI change:

1. Identify the existing screen and control that owns the requested feature.
   Change that area only; reuse its established interaction pattern.
2. Preserve navigation labels and hierarchy, screen order, toolbar locations,
   action order, and existing feature availability unless the user explicitly
   requests a change to them.
   In particular, keep the recipe collection/detail Back button anchored at
   the same top-left position.
3. Do not move, reorder, hide, remove, or duplicate controls as an incidental
   cleanup, visual refresh, responsive tweak, or implementation convenience.
4. Keep desktop and mobile layouts recognizable as the same information
   architecture. Responsive adaptations may change size or wrapping, not
   feature ownership or action placement.
5. If the requested behavior cannot be implemented without a structural
   change, explain the conflict and ask the product owner before making that
   change.
6. If an approved change alters an invariant in this document, update this
   architecture and `PRODUCT_REQUIREMENTS.md` together, and verify both the
   changed flow and adjacent flows that must remain stable.

## Authoritative implementation

The current implementation is primarily in `app/page.tsx`, with global
typography and styling in `app/globals.css`, document metadata in
`app/layout.tsx`, and persistence in `app/api/` and `app/lib/`. This document
records intended experience behavior; implementation details may change only
when the documented user experience is preserved or explicitly approved for
change.
