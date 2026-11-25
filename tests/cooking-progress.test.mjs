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
  server: { middlewareMode: true, hmr: false },
});
after(async () => { await vite.close(); });

const { clearRecipeProgress, parseCookingProgress, toggleCookingItem } = await vite.ssrLoadModule("/app/lib/cooking-progress.ts");

test("keeps checkmarks independent for recipes, weeks, and item types", () => {
  let progress = toggleCookingItem({}, "week1", "soup", "ingredients", 0);
  progress = toggleCookingItem(progress, "week1", "soup", "steps", 1);
  progress = toggleCookingItem(progress, "week1", "tacos", "steps", 0);
  progress = toggleCookingItem(progress, "week2", "soup", "steps", 2);
  assert.deepEqual(progress.week1.soup, { ingredients: [0], steps: [1] });
  assert.deepEqual(progress.week1.tacos, { ingredients: [], steps: [0] });
  assert.deepEqual(progress.week2.soup, { ingredients: [], steps: [2] });
  progress = toggleCookingItem(progress, "week1", "soup", "steps", 1);
  assert.deepEqual(progress.week1.soup, { ingredients: [0], steps: [] });
  assert.deepEqual(progress.week2.soup.steps, [2]);
});

test("clears an edited recipe in all weeks without changing other recipes", () => {
  let progress = toggleCookingItem({}, "week1", "soup", "steps", 0);
  progress = toggleCookingItem(progress, "week1", "tacos", "ingredients", 0);
  progress = toggleCookingItem(progress, "week2", "soup", "ingredients", 1);
  const cleared = clearRecipeProgress(progress, "soup");
  assert.equal(cleared.week1.soup, undefined);
  assert.equal(cleared.week2.soup, undefined);
  assert.deepEqual(cleared.week1.tacos.ingredients, [0]);
});

test("restores saved progress and rejects invalid stored entries", () => {
  const progress = toggleCookingItem({}, "week1", "soup", "steps", 1);
  assert.deepEqual(parseCookingProgress(JSON.stringify(progress)), progress);
  assert.throws(() => parseCookingProgress('{"week1":{"soup":{"ingredients":[],"steps":["1"]}}}'));
});
