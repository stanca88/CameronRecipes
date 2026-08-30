type JsonLd = Record<string, unknown>;

function decode(value: string) {
  return value
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function allObjects(value: unknown): JsonLd[] {
  if (Array.isArray(value)) return value.flatMap(allObjects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonLd;
  return [object, ...allObjects(object["@graph"])];
}

function isRecipe(object: JsonLd) {
  const type = object["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function recipeImage(value:unknown):string {
  if(typeof value==="string")return value;
  if(Array.isArray(value))return recipeImage(value[0]);
  if(value&&typeof value==="object"){
    const object=value as JsonLd;
    return typeof object.url==="string"?object.url:typeof object.contentUrl==="string"?object.contentUrl:"";
  }
  return "";
}

function instructionText(value:unknown):string[] {
  if(typeof value==="string")return value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(Array.isArray(value))return value.flatMap(instructionText);
  if(!value||typeof value!=="object")return [];
  const object=value as JsonLd;
  if(typeof object.text==="string")return [decode(object.text).replace(/<[^>]+>/g,"").trim()].filter(Boolean);
  if(typeof object.name==="string"&&object.itemListElement)return [decode(object.name),...instructionText(object.itemListElement)];
  return instructionText(object.itemListElement);
}

function publisherName(value: unknown): string {
  if (typeof value === "string") return decode(value).trim();
  if (Array.isArray(value)) return publisherName(value[0]);
  if (value && typeof value === "object") {
    const name = (value as JsonLd).name;
    return typeof name === "string" ? decode(name).trim() : "";
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const url = new URL(body.url || "");
    if (!/^https?:$/.test(url.protocol)) return Response.json({error:"Please enter a valid recipe URL."},{status:400});

    const response = await fetch(url, {
      headers: {"user-agent":"Mozilla/5.0 (compatible; CameronFamilyRecipes/1.0)"},
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("That recipe page could not be opened.");
    const html = await response.text();
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe: JsonLd | undefined;
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(decode(block[1].trim()));
        recipe = allObjects(parsed).find(isRecipe);
        if (recipe) break;
      } catch { /* Some pages contain unrelated malformed JSON-LD. */ }
    }
    if (!recipe) return Response.json({error:"We couldn't find structured recipe details on that page. You can still use Add manually."},{status:422});
    const title = typeof recipe.name === "string" ? decode(recipe.name).trim() : "";
    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter((item): item is string => typeof item === "string").map(item=>decode(item).trim())
      : [];
    const image = recipeImage(recipe.image);
    const directions = instructionText(recipe.recipeInstructions);
    if (!title || !ingredients.length) return Response.json({error:"We found the page, but its title or ingredients were missing. You can still use Add manually."},{status:422});
    const sourceName = publisherName(recipe.publisher) || url.hostname.replace(/^www\./, "");
    return Response.json({title,ingredients,image,directions,sourceName});
  } catch (error) {
    const message = error instanceof TypeError ? "Please enter a valid recipe URL." : error instanceof Error ? error.message : "We couldn't import that recipe.";
    return Response.json({error:message},{status:400});
  }
}
