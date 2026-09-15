import { getErrorMessage } from "@/app/lib/errors";
import { getSupabaseClient } from "@/app/lib/supabase";

const GLOBAL_WEEK_KEY = "__global__";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { data, error } = await supabase
      .from("shopping_list")
      .select("*")
      .eq("week_key", GLOBAL_WEEK_KEY)
      .order("ingredient_name", { ascending: true });
    if (error) throw error;
    return Response.json({ items: data || [] });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error, "Failed to fetch global shopping items") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const item = await request.json();
    if (!item || typeof item.ingredient_name !== "string" || !item.ingredient_name.trim()) {
      return Response.json({ error: "An ingredient name is required" }, { status: 400 });
    }
    const ingredientKey = item.ingredient_key || item.ingredient_name.trim().toLowerCase();
    const { data, error } = await supabase
      .from("shopping_list")
      .upsert({
        week_key: GLOBAL_WEEK_KEY,
        ingredient_key: ingredientKey,
        ingredient_name: item.ingredient_name.trim(),
        ingredient_amount: Number(item.ingredient_amount) || 0,
        ingredient_unit: typeof item.ingredient_unit === "string" ? item.ingredient_unit : "",
        ingredient_category: "Global",
        checked: false,
      }, { onConflict: "week_key,ingredient_key" })
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error, "Failed to save global shopping item") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Item id required" }, { status: 400 });
    const { error } = await supabase.from("shopping_list").delete().eq("id", id).eq("week_key", GLOBAL_WEEK_KEY);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error, "Failed to remove global shopping item") }, { status: 500 });
  }
}
