export function selectedDoneRecipes(selected: string[], done: unknown): string[] {
  if (!Array.isArray(done)) return [];
  const selectedIds = new Set(selected);
  return [...new Set(done.filter((id): id is string => typeof id === "string" && selectedIds.has(id)))];
}

export function toggleDoneRecipe(selected: string[], done: unknown, id: string): string[] {
  const current = selectedDoneRecipes(selected, done);
  if (!selected.includes(id)) return current;
  return current.includes(id) ? current.filter(recipeId => recipeId !== id) : [...current, id];
}
