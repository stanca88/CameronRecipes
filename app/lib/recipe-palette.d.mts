export type RecipePalette = {
  surfaceColor: string;
  controlColor: string;
  controlHoverColor: string;
  controlHoverLightColor: string;
  menuColor: string;
  menuFocusColor: string;
  checkboxChecked: string;
  timeColor: string;
  tagColor: string;
  tagHoverColor: string;
  doneHoverColor: string;
};

export function deriveRecipePalette(pixels: ArrayLike<number>, basePalette: RecipePalette): RecipePalette | null;
export function extractRecipePalette(imageUrl: string, basePalette: RecipePalette): Promise<RecipePalette | null>;
