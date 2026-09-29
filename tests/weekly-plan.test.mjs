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

after(async () => {
  await vite.close();
});

const { selectedDoneRecipes, toggleDoneRecipe } = await vite.ssrLoadModule(
  "/app/lib/weekly-plan.ts",
);

test("moving a dinner between to make and done retains its plan selection", () => {
  const selected = ["tacos", "soup"];
  const done = toggleDoneRecipe(selected, [], "tacos");
  assert.deepEqual(selected, ["tacos", "soup"]);
  assert.deepEqual(done, ["tacos"]);
  assert.deepEqual(toggleDoneRecipe(selected, done, "tacos"), []);
});

test("done dinners stay scoped to selected recipes in each week", () => {
  assert.deepEqual(selectedDoneRecipes(["tacos"], ["tacos", "soup", "tacos"]), ["tacos"]);
  assert.deepEqual(selectedDoneRecipes(["soup"], ["tacos"]), []);
  assert.deepEqual(selectedDoneRecipes(["tacos"], undefined), []);
  assert.deepEqual(toggleDoneRecipe(["soup"], ["tacos"], "tacos"), []);
});

test("plan API rejects done dinners not selected for that week", async () => {
  const { PUT } = await vite.ssrLoadModule("/app/api/plans/[weekKey]/route.ts");
  const response = await PUT(
    new Request("http://localhost/api/plans/2026-09-27", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selected_recipes: ["soup"],
        done_recipes: ["tacos"],
        servings: {},
        chefs: {},
        days: {},
      }),
    }),
    { params: Promise.resolve({ weekKey: "2026-09-27" }) },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid weekly dinner selections" });
});
