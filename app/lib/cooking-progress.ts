export type CookingProgress = Record<string, Record<string, { ingredients: number[]; steps: number[] }>>;

export function parseCookingProgress(raw: string): CookingProgress {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid cooking progress");
  for (const recipes of Object.values(value)) {
    if (!recipes || typeof recipes !== "object" || Array.isArray(recipes)) throw new Error("Invalid cooking progress");
    for (const progress of Object.values(recipes)) {
      if (!progress || typeof progress !== "object" || !("ingredients" in progress) || !("steps" in progress) ||
          !Array.isArray(progress.ingredients) || !progress.ingredients.every((item: unknown) => typeof item === "number" && Number.isInteger(item) && item >= 0) ||
          !Array.isArray(progress.steps) || !progress.steps.every((item: unknown) => typeof item === "number" && Number.isInteger(item) && item >= 0)) {
        throw new Error("Invalid cooking progress");
      }
    }
  }
  return value as CookingProgress;
}

export function toggleCookingItem(progress: CookingProgress, week: string, recipe: string, kind: "ingredients" | "steps", index: number): CookingProgress {
  const weekProgress = progress[week] || {};
  const recipeProgress = weekProgress[recipe] || { ingredients: [], steps: [] };
  const checked = recipeProgress[kind];
  return {
    ...progress,
    [week]: {
      ...weekProgress,
      [recipe]: {
        ...recipeProgress,
        [kind]: checked.includes(index) ? checked.filter(item => item !== index) : [...checked, index],
      },
    },
  };
}

export function clearRecipeProgress(progress: CookingProgress, recipe: string): CookingProgress {
  return Object.fromEntries(Object.entries(progress).map(([week, recipes]) => {
    const remaining = { ...recipes };
    delete remaining[recipe];
    return [week, remaining];
  }));
}
