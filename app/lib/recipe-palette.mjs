function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  const difference = maximum - minimum;
  if (!difference) return [0, 0, lightness];

  const saturation = difference / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (maximum === r) hue = ((g - b) / difference) % 6;
  else if (maximum === g) hue = (b - r) / difference + 2;
  else hue = (r - g) / difference + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs(section % 2 - 1));
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return `#${[red, green, blue].map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
  return rgbToHsl(red, green, blue);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deriveRecipePalette(pixels, basePalette) {
  if (!pixels || pixels.length < 4) return null;
  if (!basePalette) return null;

  const hueBins = Array.from({ length: 24 }, () => ({ weight: 0, saturation: 0, lightness: 0 }));
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const [hue, saturation, lightness] = rgbToHsl(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (saturation < 0.2 || lightness < 0.12 || lightness > 0.88) continue;
    const weight = saturation * (1 - Math.abs(lightness - 0.5));
    const bin = hueBins[Math.floor(hue / 15)];
    bin.weight += weight;
    bin.saturation += saturation * weight;
    bin.lightness += lightness * weight;
  }

  const dominant = hueBins.reduce((best, bin, index) => bin.weight > best.weight ? { ...bin, index } : best, { weight: 0, saturation: 0, lightness: 0, index: 0 });
  if (dominant.weight < 0.08) return null;

  const hue = dominant.index * 15 + 7.5;
  const photoSaturation = clamp(dominant.saturation / dominant.weight, 0.25, 0.68);
  const recolor = color => {
    const [, baseSaturation, lightness] = hexToHsl(color);
    const saturation = clamp(baseSaturation * 0.75 + photoSaturation * 0.25, 0.18, 0.68);
    return hslToHex(hue, saturation, lightness);
  };
  return {
    surfaceColor: recolor(basePalette.surfaceColor),
    controlColor: recolor(basePalette.controlColor),
    controlHoverColor: recolor(basePalette.controlHoverColor),
    controlHoverLightColor: recolor(basePalette.controlHoverLightColor),
    menuColor: recolor(basePalette.menuColor),
    menuFocusColor: recolor(basePalette.menuFocusColor),
    checkboxChecked: recolor(basePalette.checkboxChecked),
    timeColor: hslToHex(hue, clamp(photoSaturation * 0.85, 0.35, 0.55), 0.24),
    tagColor: recolor(basePalette.tagColor),
    tagHoverColor: recolor(basePalette.tagHoverColor),
    doneHoverColor: recolor(basePalette.doneHoverColor),
  };
}

export async function extractRecipePalette(imageUrl, basePalette) {
  if (typeof Image === "undefined" || typeof document === "undefined" || !imageUrl) return null;

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return deriveRecipePalette(context.getImageData(0, 0, canvas.width, canvas.height).data, basePalette);
}
