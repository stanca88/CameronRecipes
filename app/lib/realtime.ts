import { supabase } from "./supabase";

// Polling-based sync (real-time subscriptions can be added later)
export function subscribeToShoppingList(
  weekKey: string,
  onUpdate: (items: any[]) => void
) {
  const interval = setInterval(() => {
    fetchShoppingList(weekKey).then(onUpdate);
  }, 2000);

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
  const response = await fetch(`/api/shopping?week_key=${encodeURIComponent(weekKey)}`);
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

export async function toggleShoppingItem(id: string, checked: boolean) {
  const response = await fetch(`/api/shopping/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ checked }),
  });
  return await response.json();
}
