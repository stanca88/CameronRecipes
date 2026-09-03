import { getSupabaseClient } from "@/app/lib/supabase";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return Response.json({ error: "Missing Supabase credentials" }, { status: 500 });
    const { id } = await context.params;
    const { checked } = await request.json();

    const { data, error } = await supabase
      .from("shopping_list")
      .update({ checked })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    return Response.json({ error: message }, { status: 500 });
  }
}
