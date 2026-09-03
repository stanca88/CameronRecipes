import { supabase } from "@/app/lib/supabase";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const recipe = await request.json();
    const { data, error } = await supabase
      .from("recipes")
      .update(recipe)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update recipe";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete recipe";
    return Response.json({ error: message }, { status: 500 });
  }
}
