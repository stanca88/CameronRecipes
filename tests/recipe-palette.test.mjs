import assert from "node:assert/strict";
import test from "node:test";

import { deriveRecipePalette } from "../app/lib/recipe-palette.mjs";

const basePalette = {
  surfaceColor: "#d6f59a",
  controlColor: "#e8f7c7",
  controlHoverColor: "#c8eb82",
  controlHoverLightColor: "#e8f7c7",
  menuColor: "#d6f59a",
  menuFocusColor: "#b5d96a",
  checkboxChecked: "#b5d96a",
  timeColor: "#4b5c29",
  tagColor: "#b5d96a",
  tagHoverColor: "#a6ce5a",
  doneHoverColor: "#c8eb82",
};

function hslLightness(hex) {
  const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index + 1, index + 3), 16) / 255);
  return (Math.max(...channels) + Math.min(...channels)) / 2;
}

test("derives a coordinated photo hue while preserving the previous theme lightness", () => {
  const greenPhoto = new Uint8ClampedArray([
    70, 130, 55, 255,
    68, 128, 52, 255,
    180, 90, 75, 255,
    120, 120, 120, 255,
  ]);
  const palette = deriveRecipePalette(greenPhoto, basePalette);

  assert.ok(palette);
  assert.match(palette.surfaceColor, /^#[0-9a-f]{6}$/i);
  assert.match(palette.checkboxChecked, /^#[0-9a-f]{6}$/i);
  assert.ok(hslLightness(palette.timeColor) < hslLightness(palette.surfaceColor));
  assert.notEqual(palette.surfaceColor, palette.checkboxChecked);
  assert.ok(Math.abs(hslLightness(palette.surfaceColor) - hslLightness(basePalette.surfaceColor)) < 0.01);
  assert.equal(palette.surfaceColor, deriveRecipePalette(greenPhoto, basePalette).surfaceColor);
});

test("returns no photo palette when pixels have no usable color", () => {
  assert.equal(deriveRecipePalette(new Uint8ClampedArray([120, 120, 120, 255]), basePalette), null);
  assert.equal(deriveRecipePalette(new Uint8ClampedArray([0, 0, 0, 0]), basePalette), null);
});
