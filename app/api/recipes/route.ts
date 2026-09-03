import { supabase } from "@/app/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ recipes: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch recipes";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const recipe = await request.json();
    const { data, error } = await supabase
      .from("recipes")
      .insert([recipe])
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create recipe";
    return Response.json({ error: message }, { status: 500 });
  }
}
