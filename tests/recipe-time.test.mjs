import assert from "node:assert/strict";
import test from "node:test";

import { formatRecipeTime, recipeTimeFromSchema } from "../app/lib/recipe-time.mjs";

test("formats total recipe duration from schema.org ISO durations", () => {
  assert.equal(recipeTimeFromSchema({ totalTime: "PT45M" }), "45 minutes");
  assert.equal(recipeTimeFromSchema({ totalTime: "PT1H30M" }), "1 hour 30 minutes");
  assert.equal(recipeTimeFromSchema({ totalTime: "P1DT2H" }), "1 day 2 hours");
});

test("sums prep and cook time only when both are available", () => {
  assert.equal(recipeTimeFromSchema({ prepTime: "PT15M", cookTime: "PT25M" }), "40 minutes");
  assert.equal(recipeTimeFromSchema({ cookTime: "PT25M" }), "");
});

test("prefers total time and normalizes stored recipe time", () => {
  assert.equal(
    recipeTimeFromSchema({ totalTime: "PT50M", prepTime: "PT15M", cookTime: "PT25M" }),
    "50 minutes",
  );
  assert.equal(formatRecipeTime("2 hr"), "2 hours");
  assert.equal(formatRecipeTime("Family recipe"), "Time not provided");
});
