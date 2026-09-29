import { getErrorMessage } from "@/app/lib/errors";
import { getSupabaseClient } from "@/app/lib/supabase";

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
    const { selected_recipes, done_recipes, servings, chefs, days } = await request.json();
    if (!Array.isArray(selected_recipes) || !selected_recipes.every((id: unknown) => typeof id === "string")
      || !Array.isArray(done_recipes) || !done_recipes.every((id: unknown) => typeof id === "string")
      || done_recipes.some((id: string) => !selected_recipes.includes(id))) {
      return Response.json({ error: "Invalid weekly dinner selections" }, { status: 400 });
    }
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    
    const { data, error } = await supabase
      .from("weekly_plans")
      .upsert({
        week_key: weekKey,
        selected_recipes,
        done_recipes,
        servings,
        chefs,
        days,
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
