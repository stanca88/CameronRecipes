// Polling-based sync (real-time subscriptions can be added later)
export function subscribeToShoppingList(
  weekKey: string,
  onUpdate: (items: any[]) => void
) {
  const interval = setInterval(() => {
    fetchShoppingList(weekKey)
      .then(onUpdate)
      .catch((error) => {
        console.error("Failed to poll shopping list:", error);
      });
  }, 2000);

  return () => clearInterval(interval);
}

export function subscribeToGlobalShoppingList(onUpdate: (items: any[]) => void) {
  const interval = setInterval(async () => {
    try {
      const response = await fetch("/api/shopping/global");
      const { items } = await response.json();
      if (response.ok && Array.isArray(items)) onUpdate(items);
    } catch (e) {
      console.error("Failed to poll global shopping items:", e);
    }
  }, 5000);

  return () => clearInterval(interval);
}

export function subscribeToWeeklyPlan(
  weekKey: string,
  onUpdate: (plan: any) => void
) {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(weekKey)}`);
      const plan = await response.json();
      if (plan && !plan.error) {
        onUpdate(plan);
      }
    } catch (e) {
      // Ignore polling errors
    }
  }, 2000);

  return () => clearInterval(interval);
}

export async function fetchShoppingList(weekKey: string) {
  const url = new URL("/api/shopping", window.location.origin);
  url.searchParams.set("week_key", weekKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Shopping list request failed with status ${response.status}`);
  }
  const { items } = await response.json();
  return items || [];
}

export async function saveShoppingList(weekKey: string, items: any[]) {
  const response = await fetch("/api/shopping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ week_key: weekKey, items }),
  });
  const { items: saved } = await response.json();
  return saved || [];
}

export async function fetchWeeklyPlan(weekKey: string) {
  const response = await fetch(`/api/plans/${encodeURIComponent(weekKey)}`);
  const plan = await response.json();
  return plan && !plan.error ? plan : null;
}

export async function saveWeeklyPlan(weekKey: string, plan: { selected_recipes: string[]; servings: Record<string, number>; chefs: Record<string, string>; days: Record<string, string> }) {
  const response = await fetch(`/api/plans/${encodeURIComponent(weekKey)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(plan),
  });
  return await response.json();
}

export async function toggleShoppingItem(id: string, checked: boolean) {
  const response = await fetch(`/api/shopping/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ checked }),
  });
  return await response.json();
}

export function subscribeToHistory(onUpdate: (weeks: any[]) => void) {
  const interval = setInterval(() => {
    fetchHistory().then(onUpdate);
  }, 5000);

  return () => clearInterval(interval);
}

export async function fetchHistory() {
  const response = await fetch("/api/history");
  const data = await response.json();
  return Array.isArray(data.weeks) ? data.weeks : [];
}

export async function saveHistoryWeek(week: { id: string; label: string; savedAt: string; meals: any[] }) {
  const response = await fetch("/api/history", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: week.id, label: week.label, saved_at: week.savedAt, meals: week.meals }),
  });
  return await response.json();
}