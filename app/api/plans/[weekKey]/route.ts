import { supabase } from "@/app/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ weekKey: string }> }
) {
  try {
    const { weekKey } = await context.params;
    const { data, error } = await supabase
      .from("weekly_plans")
      .select("*")
      .eq("week_key", weekKey)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return Response.json(data || null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch plan";
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
    
    const { data, error } = await supabase
      .from("weekly_plans")
      .upsert({
        week_key: weekKey,
        selected_recipes,
        servings,
        chefs,
        days,
      }, { onConflict: "week_key" })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save plan";
    return Response.json({ error: message }, { status: 500 });
  }
}
