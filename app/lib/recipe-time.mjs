function parseDurationMinutes(value) {
  if (typeof value !== "string") return null;
  const duration = value.trim();
  if (!duration) return null;

  const iso = /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i.exec(duration);
  if (iso) {
    const [, weeks, days, hours, minutes, seconds] = iso;
    if (![weeks, days, hours, minutes, seconds].some(Boolean)) return null;
    const total = Number(weeks || 0) * 10080
      + Number(days || 0) * 1440
      + Number(hours || 0) * 60
      + Number(minutes || 0)
      + Number(seconds || 0) / 60;
    return total > 0 ? Math.ceil(total) : null;
  }

  const human = /^(?:(\d+(?:[.,]\d+)?)\s*(?:days?|d)\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|m)\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:seconds?|secs?|s)\s*)?$/i.exec(duration.replace(/,/g, " "));
  if (!human || !human.slice(1).some(Boolean)) return null;
  const [, days, hours, minutes, seconds] = human;
  const total = Number(days || 0) * 1440
    + Number(hours || 0) * 60
    + Number(minutes || 0)
    + Number(seconds || 0) / 60;
  return total > 0 ? Math.ceil(total) : null;
}

function formatMinutes(totalMinutes) {
  let remaining = Math.max(1, Math.ceil(totalMinutes));
  const parts = [];
  const days = Math.floor(remaining / 1440);
  if (days) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
    remaining %= 1440;
  }
  const hours = Math.floor(remaining / 60);
  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    remaining %= 60;
  }
  if (remaining) parts.push(`${remaining} minute${remaining === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function formatRecipeTime(value) {
  if (typeof value !== "string") return "Time not provided";
  const time = value.trim();
  if (!time || ["family recipe", "time not provided"].includes(time.toLowerCase())) {
    return "Time not provided";
  }
  const minutes = parseDurationMinutes(time);
  return minutes === null ? time : formatMinutes(minutes);
}

export function recipeTimeFromSchema(recipe) {
  const totalTime = parseDurationMinutes(recipe?.totalTime);
  if (totalTime !== null) return formatMinutes(totalTime);

  const prepTime = parseDurationMinutes(recipe?.prepTime);
  const cookTime = parseDurationMinutes(recipe?.cookTime);
  return prepTime !== null && cookTime !== null
    ? formatMinutes(prepTime + cookTime)
    : "";
}
