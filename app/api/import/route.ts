type JsonLd = Record<string, unknown>;

const NAMED_ENTITIES: Record<string, string> = {
  quot:'"', apos:"'", amp:"&", lt:"<", gt:">", nbsp:" ",
  mdash:"—", ndash:"–", hellip:"…",
  lsquo:"\u2018", rsquo:"\u2019", ldquo:"\u201c", rdquo:"\u201d",
};

function decode(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
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

function stripTags(value: string): string {
  return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function metaContent(html: string, name: string, attr: "property" | "name" = "property"): string {
  const forward = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
  if (forward) return decode(forward[1]);
  const backward = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, "i").exec(html);
  return backward ? decode(backward[1]) : "";
}

// Some sites (e.g. Jetpack/WordPress.com's built-in recipe block, used by Smitten
// Kitchen and others) mark recipes up with schema.org microdata (itemprop
// attributes) instead of a JSON-LD <script> block. Extract from that as a fallback
// when no JSON-LD recipe was found.
function extractBalancedTag(html: string, tagName: string, matchIndex: number): string {
  const boundaryRe = new RegExp(`<${tagName}\\b|</${tagName}>`, "gi");
  boundaryRe.lastIndex = matchIndex;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = boundaryRe.exec(html))) {
    if (match[0][1] === "/") {
      depth--;
      if (depth === 0) return html.slice(matchIndex, match.index + match[0].length);
    } else {
      depth++;
    }
  }
  return html.slice(matchIndex);
}

function microdataRecipeBlock(html: string): string | null {
  const openTagRe = /<([a-zA-Z0-9]+)\b[^>]*itemtype=["'](?:https?:)?\/\/schema\.org\/Recipe["'][^>]*>/i;
  const match = openTagRe.exec(html);
  if (!match) return null;
  return extractBalancedTag(html, match[1], match.index);
}

function microdataFieldAll(block: string, prop: string): string[] {
  const openTagRe = new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*itemprop=["']${prop}["'][^>]*>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = openTagRe.exec(block))) {
    const tag = match[1];
    const start = match.index + match[0].length;
    const closeIdx = block.indexOf(`</${tag}>`, start);
    if (closeIdx === -1) continue;
    const text = stripTags(block.slice(start, closeIdx));
    if (text) results.push(text);
  }
  return results;
}

function microdataDirections(block: string): string[] {
  const openTagRe = /<div\b[^>]*class=["'][^"']*(?:recipe-directions|recipe-instructions)[^"']*["'][^>]*>/i;
  const match = openTagRe.exec(block);
  if (!match) return [];
  const full = extractBalancedTag(block, "div", match.index);
  const inner = full.slice(match[0].length, full.length - "</div>".length);
  return inner.split(/<\/p>|<br\s*\/?>/i).map(part=>stripTags(part)).filter(Boolean);
}

function extractMicrodataRecipe(html: string) {
  const block = microdataRecipeBlock(html);
  if (!block) return null;
  const title = microdataFieldAll(block, "name")[0] || "";
  const ingredients = microdataFieldAll(block, "recipeIngredient");
  if (!title || !ingredients.length) return null;
  const directions = microdataDirections(block);
  const image = metaContent(html, "og:image");
  const sourceName = metaContent(html, "og:site_name");
  return { title, ingredients, image, directions, sourceName };
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
      const microdata = extractMicrodataRecipe(html);
      if (microdata) {
        return Response.json({
          title: microdata.title,
          ingredients: microdata.ingredients,
          image: microdata.image,
          directions: microdata.directions,
          sourceName: microdata.sourceName || url.hostname.replace(/^www\./, ""),
        });
      }
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
    const image = recipeImage(recipe.image) || metaContent(html, "og:image");
    const directions = instructionText(recipe.recipeInstructions);
    if (!title || !ingredients.length) return Response.json({error:"We found the page, but its title or ingredients were missing. You can still use Add manually."},{status:422});
    const sourceName = publisherName(recipe.publisher) || url.hostname.replace(/^www\./, "");
    return Response.json({title,ingredients,image,directions,sourceName});
  } catch (error) {
    const message = error instanceof TypeError ? "Please enter a valid recipe URL." : error instanceof Error ? error.message : "We couldn't import that recipe.";
    return Response.json({error:message},{status:400});
  }
}
