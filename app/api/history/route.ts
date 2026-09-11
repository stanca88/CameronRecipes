import { getErrorMessage } from "@/app/lib/errors";
import { getSupabaseClient } from "@/app/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { data, error } = await supabase
      .from("meal_history")
      .select("*")
      .order("saved_at", { ascending: false });

    if (error) throw error;
    return Response.json({ weeks: data || [] });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to fetch history");
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { id, label, saved_at, meals } = await request.json();

    if (!id || !label || !Array.isArray(meals)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meal_history")
      .upsert({ id, label, saved_at: saved_at || new Date().toISOString(), meals }, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "Failed to save history week");
    return Response.json({ error: message }, { status: 500 });
  }
}
