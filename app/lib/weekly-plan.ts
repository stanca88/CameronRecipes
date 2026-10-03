const DONE_RECIPE_IDS_KEY = "__cameron_done_recipe_ids_v1";

export function selectedDoneRecipes(selected: string[], done: unknown): string[] {
  if (!Array.isArray(done)) return [];
  const selectedIds = new Set(selected);
  return [...new Set(done.filter((id): id is string => typeof id === "string" && selectedIds.has(id)))];
}

export function readDoneRecipes(days: unknown): unknown {
  if (!days || typeof days !== "object" || Array.isArray(days)) return [];
  const serialized = (days as Record<string, unknown>)[DONE_RECIPE_IDS_KEY];
  if (serialized === undefined) return [];
  if (typeof serialized !== "string") return null;
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
}

export function planDays(days: unknown): Record<string, string> {
  if (!days || typeof days !== "object" || Array.isArray(days)) return {};
  return Object.fromEntries(
    Object.entries(days).filter(([key, value]) => key !== DONE_RECIPE_IDS_KEY && typeof value === "string"),
  );
}

export function withDoneRecipes(
  days: Record<string, string>,
  selected: string[],
  done: unknown,
): Record<string, string> {
  return {
    ...days,
    [DONE_RECIPE_IDS_KEY]: JSON.stringify(selectedDoneRecipes(selected, done)),
  };
}

export function toggleDoneRecipe(selected: string[], done: unknown, id: string): string[] {
  const current = selectedDoneRecipes(selected, done);
  if (!selected.includes(id)) return current;
  return current.includes(id) ? current.filter(recipeId => recipeId !== id) : [...current, id];
}
