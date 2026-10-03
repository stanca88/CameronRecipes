import { getErrorMessage } from "@/app/lib/errors";
import { getSupabaseClient } from "@/app/lib/supabase";
import { readDoneRecipes, selectedDoneRecipes, withDoneRecipes } from "@/app/lib/weekly-plan";

export async function GET(
  _request: Request,
  context: { params: Promise<{ weekKey: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { weekKey } = await context.params;
    const { data, error } = await supabase
      .from("weekly_plans")
      .select("*")
      .eq("week_key", weekKey)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return Response.json(data || null);
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch plan");
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ weekKey: string }> }
) {
  try {
    const { weekKey } = await context.params;
    const { selected_recipes, servings, chefs, days } = await request.json();
    const planDays = days ?? {};
    const done_recipes = readDoneRecipes(planDays);
    if (!Array.isArray(selected_recipes) || !selected_recipes.every((id: unknown) => typeof id === "string")
      || !Array.isArray(done_recipes) || !done_recipes.every((id: unknown) => typeof id === "string")
      || JSON.stringify(done_recipes) !== JSON.stringify(selectedDoneRecipes(selected_recipes, done_recipes))
      || typeof planDays !== "object" || Array.isArray(planDays)) {
      return Response.json({ error: "Invalid weekly dinner selections" }, { status: 400 });
    }
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    
    const { data, error } = await supabase
      .from("weekly_plans")
      .upsert({
        week_key: weekKey,
        selected_recipes,
        servings,
        chefs,
        days: withDoneRecipes(planDays, selected_recipes, done_recipes),
      }, { onConflict: "week_key" })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "Failed to save plan");
    return Response.json({ error: message }, { status: 500 });
  }
}
