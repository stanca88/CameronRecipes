export function formatRecipeTime(value: unknown): string;

export function recipeTimeFromSchema(recipe: {
  totalTime?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
}): string;
