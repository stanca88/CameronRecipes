import { getSupabaseClient } from "@/app/lib/supabase";

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const url = new URL(request.url);
    const weekKey = url.searchParams.get("week_key");
    
    if (!weekKey) {
      return Response.json({ error: "week_key required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("shopping_list")
      .select("*")
      .eq("week_key", weekKey)
      .order("ingredient_category", { ascending: true })
      .order("ingredient_name", { ascending: true });

    if (error) throw error;
    return Response.json({ items: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch shopping list";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { week_key, items } = await request.json();
    
    if (!week_key || !Array.isArray(items)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    // Delete old items for this week
    await supabase.from("shopping_list").delete().eq("week_key", week_key);

    // Insert new items
    const { data, error } = await supabase
      .from("shopping_list")
      .insert(items.map((item:any) => ({
        week_key,
        ingredient_key: item.ingredient_key || `${item.ingredient_name}|${item.ingredient_unit}|${item.ingredient_category}`,
        ingredient_name: item.ingredient_name,
        ingredient_amount: item.ingredient_amount,
        ingredient_unit: item.ingredient_unit,
        ingredient_category: item.ingredient_category,
        checked: false,
      })))
      .select();

    if (error) throw error;
    return Response.json({ items: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save shopping list";
    return Response.json({ error: message }, { status: 500 });
  }
}
