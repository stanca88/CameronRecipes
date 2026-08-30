import express from "express";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = "https://yveqzlpemdxjgzlxvocs.supabase.co";
const SUPABASE_KEY = "sb_publishable_vPv7fZZUYOKIIwCDJHfCSA_EM9qXM8Z";

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "dist")));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    return n === "::1" || n === "::" || n.startsWith("fc") || n.startsWith("fd") || n.startsWith("fe80:");
  }
  return true;
}

async function validateRemoteUrl(raw) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https recipe links are allowed.");
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) throw new Error("That address is not allowed.");
  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) throw new Error("Private network addresses are not allowed.");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("That address is not allowed.");
  return url;
}

async function fetchHtml(raw) {
  let current = await validateRemoteUrl(raw);
  for (let i = 0; i < 5; i++) {
    const r = await fetch(current, {
      redirect: "manual",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CameronFamilyRecipes/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const location = r.headers.get("location");
      if (!location) throw new Error("Recipe site returned an invalid redirect.");
      current = await validateRemoteUrl(new URL(location, current).href);
      continue;
    }
    if (!r.ok) throw new Error(`Recipe site returned ${r.status}.`);
    const type = r.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) throw new Error("That link did not return a web page.");
    const text = await r.text();
    if (text.length > 4_000_000) throw new Error("That recipe page is too large to import safely.");
    return { html: text, finalUrl: current.href };
  }
  throw new Error("Too many redirects while importing that recipe.");
}

function decode(value) {
  return String(value)
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function stripTags(s = "") {
  return decode(String(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
function allObjects(value) {
  if (Array.isArray(value)) return value.flatMap(allObjects);
  if (!value || typeof value !== "object") return [];
  return [value, ...allObjects(value["@graph"])];
}
function isRecipe(object) {
  const type = object["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}
function firstString(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) { for (const x of value) { const s = firstString(x); if (s) return s; } return ""; }
  if (value && typeof value === "object") return firstString(value.url || value.contentUrl || value.name || value.text);
  return "";
}
function instructionText(value) {
  if (typeof value === "string") return value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(instructionText);
  if (!value || typeof value !== "object") return [];
  if (typeof value.text === "string") return [stripTags(value.text)].filter(Boolean);
  if (typeof value.name === "string" && value.itemListElement) return [decode(value.name), ...instructionText(value.itemListElement)];
  return instructionText(value.itemListElement);
}
function publisherName(value) {
  if (typeof value === "string") return decode(value).trim();
  if (Array.isArray(value)) return publisherName(value[0]);
  if (value && typeof value === "object") { const name = value.name; return typeof name === "string" ? decode(name).trim() : ""; }
  return "";
}

async function requireFamily(req) {
  const auth = req.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Sign in required."), { status: 401 });
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, authorization: auth } });
  if (!userRes.ok) throw Object.assign(new Error("Your sign-in has expired."), { status: 401 });
  const user = await userRes.json();
  const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/cameron_family_members?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, {
    headers: { apikey: SUPABASE_KEY, authorization: auth },
  });
  const rows = memberRes.ok ? await memberRes.json() : [];
  if (!rows.length) throw Object.assign(new Error("Join the Cameron family first."), { status: 403 });
  return user;
}

app.post("/api/import", async (req, res) => {
  try {
    await requireFamily(req);
    const raw = String(req.body?.url || "").trim();
    if (!raw) return res.status(400).json({ error: "Paste a recipe link first." });
    const { html } = await fetchHtml(raw);
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let recipe;
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(decode(block[1].trim()));
        recipe = allObjects(parsed).find(isRecipe);
        if (recipe) break;
      } catch { /* Some pages contain unrelated malformed JSON-LD. */ }
    }
    if (!recipe) return res.status(422).json({ error: "We couldn't find structured recipe details on that page. You can still use Add manually." });
    const title = firstString(recipe.name) ? decode(firstString(recipe.name)).trim() : "";
    const ingredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient.map(stripTags).filter(Boolean) : [];
    if (!title || !ingredients.length) return res.status(422).json({ error: "We found the page, but its title or ingredients were missing. You can still use Add manually." });
    const image = firstString(recipe.image);
    const directions = instructionText(recipe.recipeInstructions);
    const sourceUrl = new URL(raw);
    const sourceName = publisherName(recipe.publisher) || sourceUrl.hostname.replace(/^www\./, "");
    res.json({ title, ingredients, image, directions, sourceName });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "We couldn't import that recipe." });
  }
});

app.get("*path", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.listen(PORT, () => console.log(`Cameron Family Recipes running on port ${PORT}`));
