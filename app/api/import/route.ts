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
  return [object, ...allObjects(object["@graph"]), ...allObjects(object.mainEntity), ...allObjects(object.itemListElement)];
}

function isRecipe(object: JsonLd) {
  const type = object["@type"];
  const matches = (t: unknown) => typeof t === "string" && t.trim().toLowerCase() === "recipe";
  return matches(type) || (Array.isArray(type) && type.some(matches));
}

// Many real-world JSON-LD blocks are technically invalid JSON: they contain raw,
// unescaped control characters (literal newlines/tabs) inside string values, or a
// trailing comma before a closing brace/bracket. Both make JSON.parse throw even
// though the data itself is otherwise fine. Repair those issues before parsing.
function sanitizeJsonLd(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === '"') { out += ch; inString = false; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (ch.charCodeAt(0) < 0x20) continue;
      out += ch;
      continue;
    }
    if (ch === '"') { out += ch; inString = true; continue; }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function parseLdJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(sanitizeJsonLd(trimmed));
  }
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
    if (!html.trim().startsWith("<")) {
      return Response.json({error:"That page didn't return normal HTML. Try a different recipe link or add it manually."},{status:422});
    }
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe: JsonLd | undefined;
    let sawLdJson = false;
    for (const block of blocks) {
      sawLdJson = true;
      try {
        const parsed = parseLdJson(decode(block[1]));
        recipe = allObjects(parsed).find(isRecipe);
        if (recipe) break;
      } catch {
        continue;
      }
    }
    if (!recipe) {
      return Response.json({
        error: sawLdJson
          ? "We found recipe metadata, but couldn't read it. Try a different recipe link or add it manually."
          : "We couldn't find structured recipe details on that page. You can still use Add manually.",
      }, {status:422});
    }
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
