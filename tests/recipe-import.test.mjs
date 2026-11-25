import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(() => vite.close());
const { POST } = await vite.ssrLoadModule("/app/api/import/route.ts");

async function importPage(html, url = "https://smittenkitchen.com/recipe/") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html);
  try {
    const response = await POST(new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }));
    return { status: response.status, body: await response.json() };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("imports a Smitten Kitchen recipe from the printable article section", async () => {
  const html = `<html><head><meta property="og:image" content="https://example.com/meal.jpg">
    <meta property="og:site_name" content="Example Kitchen"></head><body>
    <div class="entry-content"><div class="smittenkitchen-print-hide">
      <div><p>Unrelated article introduction.</p></div></div>
      <p><b>Sample &amp; supper</b></p><p>Recipe notes.</p><p>Serves 4.</p>
      <p>1 cup flour<br>2 eggs<br/>Salt to taste</p>
      <p>Mix the ingredients.</p><p>Bake until done.</p>
      <div class="sharedaddy"><p>Share this recipe.</p></div>
      <p>Unrelated text after the recipe.</p></div></body></html>`;
  const { status, body } = await importPage(html);
  assert.equal(status, 200);
  assert.deepEqual(body, {
    title: "Sample & supper",
    ingredients: ["1 cup flour", "2 eggs", "Salt to taste"],
    directions: ["Mix the ingredients.", "Bake until done."],
    image: "https://example.com/meal.jpg",
    sourceName: "Example Kitchen",
    time: "",
  });
});

test("does not treat an incomplete or unrelated article as a recipe", async () => {
  const html = `<div class="entry-content"><div class="smittenkitchen-print-hide"><p>Intro</p></div>
    <p><b>Article</b></p><p>Some unrelated text<br>Another line<br>Another line</p>
    <div class="sharedaddy"></div></div>`;
  assert.equal((await importPage(html)).status, 422);
  assert.equal((await importPage(html, "https://example.com/article")).status, 422);
});

test("continues to prefer structured recipe metadata", async () => {
  const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Example",
    "recipeIngredient":["1 apple"],"recipeInstructions":["Slice it."]}</script>`;
  const { status, body } = await importPage(html);
  assert.equal(status, 200);
  assert.equal(body.title, "Example");
  assert.deepEqual(body.ingredients, ["1 apple"]);
  assert.deepEqual(body.directions, ["Slice it."]);
});
