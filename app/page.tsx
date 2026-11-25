"use client";

import { useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import { ArrowLeft, BookOpen, CalendarDays, Check, ChefHat, ChevronDown, ChevronUp, Clock, History as HistoryIcon, Minus, MoreHorizontal, Pencil, Plus, RefreshCw, Save, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeToShoppingList, subscribeToGlobalShoppingList, saveShoppingList, toggleShoppingItem, subscribeToWeeklyPlan, saveWeeklyPlan, fetchWeeklyPlan, subscribeToHistory, fetchHistory, saveHistoryWeek } from "@/app/lib/realtime";
import { planDays, readDoneRecipes, selectedDoneRecipes, toggleDoneRecipe } from "@/app/lib/weekly-plan";
import { clearRecipeProgress, parseCookingProgress, toggleCookingItem, type CookingProgress } from "@/app/lib/cooking-progress";
import { MOCK_RECIPES } from "@/app/lib/mock-recipes";
import { formatRecipeTime } from "@/app/lib/recipe-time.mjs";
import { extractRecipePalette, type RecipePalette } from "@/app/lib/recipe-palette.mjs";

type Ingredient = { name: string; amount: number; unit: string; category: string; hasQty?: boolean };
type DirectionStep = { text: string; image?: string };
type Recipe = { id: string; title: string; emoji: string; time: string; serves: number; author: string; ingredients: Ingredient[]; image?: string; directions?: (string | DirectionStep)[]; sourceUrl?: string; sourceName?: string; tag?: string };
type RecipeEditDrafts = {
  details?: { title: string; tag: string; time: string; image: string; sourceUrl: string; sourceName: string };
  ingredients?: string;
  directions?: { steps: { text: string; image: string }[] };
};
type WeeklyPlan = { selected: string[]; done: string[]; servings: Record<string,number>; checked: string[]; chefs: Record<string,string>; days: Record<string,string> };
type SavedWeek = { id: string; label: string; savedAt: string; meals: { id: string; title: string; emoji: string; people: number; chef?: string; day?: string }[] };
type ShoppingItem = { id: string; ingredient_key: string; ingredient_name: string; ingredient_amount: number; ingredient_unit: string; ingredient_category: string; checked: boolean };
const fallbackRecipePalettes: RecipePalette[] = [
  { surfaceColor: "#d6f59a", controlColor: "#e8f7c7", controlHoverColor: "#c8eb82", controlHoverLightColor: "#e8f7c7", menuColor: "#d6f59a", menuFocusColor: "#b5d96a", checkboxChecked: "#b5d96a", timeColor: "#4b5c29", tagColor: "#b5d96a", tagHoverColor: "#a6ce5a", doneHoverColor: "#c8eb82" },
  { surfaceColor: "#fde8d5", controlColor: "#fff3e8", controlHoverColor: "#f9d8b8", controlHoverLightColor: "#fff3e8", menuColor: "#fde8d5", menuFocusColor: "#efc397", checkboxChecked: "#efc397", timeColor: "#80512f", tagColor: "#efc397", tagHoverColor: "#e6b27f", doneHoverColor: "#f9d8b8" },
  { surfaceColor: "#dcecf2", controlColor: "#edf5f8", controlHoverColor: "#cfe3eb", controlHoverLightColor: "#edf5f8", menuColor: "#dcecf2", menuFocusColor: "#b8d2de", checkboxChecked: "#b8d2de", timeColor: "#355260", tagColor: "#b8d2de", tagHoverColor: "#a7c7d5", doneHoverColor: "#cfe3eb" },
];

function fallbackRecipePaletteFor(id: string): RecipePalette {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return fallbackRecipePalettes[hash % fallbackRecipePalettes.length];
}

function RecipeTime({ time }: { time: string }) {
  return <p className="flex items-center gap-1.5 text-sm text-[var(--recipe-time,#59665e)]"><Clock size={15} aria-hidden="true"/><span>{formatRecipeTime(time)}</span></p>;
}

function recipeImageFor(recipe: Pick<Recipe, "id" | "image">): string {
  return recipe.image || (recipe.id === "roasted-veg-bowl" ? "/veg-bowl.jpg"
    : recipe.id === "lemon-herb-chicken" ? "/lemon-chicken.jpg"
      : recipe.id === "beef-stew" ? "/beef-stew.jpg" : "");
}

function recipePaletteStyle(palette: RecipePalette): CSSProperties {
  return {
    "--recipe-surface": palette.surfaceColor,
    "--recipe-control": palette.controlColor,
    "--recipe-control-hover": palette.controlHoverColor,
    "--recipe-control-hover-light": palette.controlHoverLightColor,
    "--recipe-menu": palette.menuColor,
    "--recipe-menu-focus": palette.controlHoverLightColor,
    "--recipe-time": palette.timeColor,
    "--recipe-tag": palette.tagColor,
    "--recipe-tag-hover": palette.tagHoverColor,
    "--recipe-done-hover": palette.doneHoverColor,
  } as CSSProperties;
}

function BackButton({ onClick, disabled=false }: { onClick: () => void; disabled?: boolean }) {
  return <Button type="button" onClick={onClick} disabled={disabled} aria-label="Back" className="h-11 shrink-0 gap-1.5 rounded-lg border-0 bg-[#d6f59a] px-4 text-sm font-normal text-[#111613] hover:bg-[#c9ef78] hover:text-[#111613] disabled:opacity-50 sm:h-9"><ArrowLeft size={18}/><span>Back</span></Button>;
}

const starterRecipes: Recipe[] = [
  {id:"roasted-veg-bowl",title:"Roasted Vegetable Grain Bowl",emoji:"🥗",time:"35 min",serves:4,author:"Maria",image:"/veg-bowl.jpg",ingredients:[
    {name:"quinoa",amount:1,unit:"cup",category:"Pantry"},{name:"sweet potato",amount:2,unit:"",category:"Vegetables"},{name:"chickpeas",amount:1,unit:"can",category:"Pantry"},{name:"spinach",amount:3,unit:"cups",category:"Vegetables"},{name:"feta",amount:4,unit:"oz",category:"Dairy"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Roast cubed sweet potato and chickpeas at 425°F until golden.","Cook quinoa per package instructions.","Toss quinoa with roasted veg, spinach, feta, olive oil, lemon, salt, and pepper."]},
  {id:"lemon-herb-chicken",title:"Lemon Herb Chicken",emoji:"🍗",time:"40 min",serves:4,author:"Dad",image:"/lemon-chicken.jpg",ingredients:[
    {name:"chicken breasts",amount:4,unit:"",category:"Meat"},{name:"lemons",amount:2,unit:"",category:"Fruit"},{name:"garlic cloves",amount:3,unit:"",category:"Vegetables"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"},{name:"rosemary",amount:1,unit:"tsp",category:"Pantry"}],directions:["Marinate chicken with lemon, garlic, olive oil, rosemary, salt, and pepper.","Roast at 425°F for 25–30 minutes until cooked through.","Rest 5 minutes before serving."]},
  {id:"beef-stew",title:"Hearty Beef Stew",emoji:"🥘",time:"2 hr",serves:6,author:"Dad",image:"/beef-stew.jpg",ingredients:[
    {name:"beef chuck",amount:2,unit:"lb",category:"Meat"},{name:"carrots",amount:3,unit:"",category:"Vegetables"},{name:"potatoes",amount:3,unit:"",category:"Vegetables"},{name:"onion",amount:1,unit:"",category:"Vegetables"},{name:"beef broth",amount:4,unit:"cups",category:"Pantry"},{name:"tomato paste",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Brown beef in batches, set aside.","Sauté onion, add carrots and potato, then return beef to pot.","Add broth and tomato paste, simmer covered 1.5–2 hours until beef is tender."]}
];

function directionText(step: string | DirectionStep | null | undefined): string {
  if (!step) return "";
  return typeof step === "string" ? step : step.text;
}

function directionImage(step: string | DirectionStep | null | undefined): string | undefined {
  if (!step || typeof step === "string") return undefined;
  return step.image;
}

function normalizeDirectionStep(value: unknown): string | DirectionStep | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as { text?: unknown; image?: unknown };
      if (parsed && typeof parsed.text === "string") {
        return {
          text: parsed.text,
          image: typeof parsed.image === "string" ? parsed.image : undefined,
        };
      }
    } catch {
      // Plain-text direction.
    }
    return value;
  }
  if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
    const step = value as { text: string; image?: unknown };
    return { text: step.text, image: typeof step.image === "string" ? step.image : undefined };
  }
  return null;
}

function weekStart(offset = 0, date = new Date()) {
  const start = new Date(date); const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setDate(start.getDate() + offset * 7);
  start.setHours(0,0,0,0);
  return start;
}

function weekKey(offset = 0) {
  const start=weekStart(offset);
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
}

function weekRange(offset = 0) {
  const start = weekStart(offset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const left = start.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  const right = end.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  return `${left} – ${right}`;
}

function weekStartLabel(offset = 0) {
  const start = weekStart(offset);
  const day = start.getDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  const month = start.toLocaleDateString("en-US", { month:"short" });
  return `${month} ${day}${suffix} week`;
}

function weekRangeShort(offset = 0) {
  const start = weekStart(offset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const left = start.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  const right = start.getMonth()===end.getMonth()
    ? String(end.getDate())
    : end.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  return `${left} - ${right}`;
}

function weekRangeFromKey(key:string) {
  const [year,month,day]=key.split("-").map(Number);
  const start=new Date(year,month-1,day);
  const end=new Date(start); end.setDate(start.getDate()+6);
  const left=start.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const right=end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  return `${left} – ${right}`;
}

const CUISINE_RULES:{label:string;strong:RegExp;generic?:RegExp}[]=[
  {label:"Mexican",strong:/taco|burrito|enchilada|quesadilla|salsa|guacamole|tortilla|fajita|chorizo|carnitas|pico de gallo|elote|tamale|mole\b/i,generic:/mexican/i},
  {label:"Italian",strong:/pasta|spaghetti|lasagna|risotto|marinara|pesto|bolognese|carbonara|ravioli|gnocchi|pizza/i,generic:/italian|parmesan/i},
  {label:"Asian",strong:/sushi|teriyaki|ramen|tempura|udon|edamame|wasabi|stir.?fry|kung pao|fried rice|dumpling|szechuan|lo mein|chow mein|wonton|pad thai|satay|tom yum|tikka|masala|naan|tandoori|biryani|kimchi|bulgogi|gochujang/i,generic:/asian|japanese|miso|soy sauce|chinese|hoisin|thai|curry paste|coconut curry|indian|curry|paneer|dal\b|korean/i},
  {label:"Mediterranean",strong:/hummus|falafel|tabbouleh|shawarma|feta|tzatziki|souvlaki|spanakopita|moussaka|greek salad|greek olives|kalamata|baklava|gyro/i,generic:/mediterranean|pita|greek/i},
  {label:"French",strong:/baguette|croissant|ratatouille|quiche|béchamel|bechamel/i,generic:/french/i},
  {label:"American",strong:/burger|bbq|barbecue|meatloaf|mac and cheese|mac & cheese|casserole|chili\b|cornbread|pot pie/i,generic:/american/i},
];

// Some ingredient names are just generic descriptors ("Greek-style yogurt",
// "Italian seasoning", "French bread", "Chinese five spice") rather than a sign
// the whole dish belongs to that cuisine. To avoid false-positive tags, a rule's
// "strong" (dish-specific) terms can match anywhere in the title or ingredients,
// but its broader "generic" terms (the bare cuisine name and common descriptor
// words) only count as a match when they appear in the recipe's title, where
// they're a much more reliable signal of the dish's actual cuisine.
function cuisineFromText(title:string, ingredientNames:string[]):string|null {
  const haystack=`${title} ${ingredientNames.join(" ")}`;
  for(const rule of CUISINE_RULES){
    if(rule.strong.test(haystack)) return rule.label;
    if(rule.generic&&rule.generic.test(title)) return rule.label;
  }
  return null;
}

function cuisineFor(recipe:Recipe):string|null {
  return cuisineFromText(recipe.title||"",(recipe.ingredients||[]).map(ingredient=>ingredient.name));
}

function inferredRecipeTag(title:string, ingredientNames:string[]):string {
  return cuisineFromText(title,ingredientNames)||"Family recipe";
}

function recipeTag(recipe:Recipe):string {
  return recipe.tag?.trim() || cuisineFor(recipe) || "Family recipe";
}

function recipeMatchesQuery(recipe:Recipe, query:string, tagFilter:string) {
  const q=query.trim().toLowerCase();
  if(tagFilter&&recipeTag(recipe)!==tagFilter)return false;
  if(!q)return true;
  if(recipe.title.toLowerCase().includes(q))return true;
  const cuisine=cuisineFor(recipe);
  if(cuisine&&cuisine.toLowerCase().includes(q))return true;
  return false;
}

const UNIT_ABBREVIATIONS:Record<string,string>={
  cup:"c",cups:"c",
  tablespoon:"tbsp",tablespoons:"tbsp",tbsp:"tbsp",tbsps:"tbsp",
  teaspoon:"tsp",teaspoons:"tsp",tsp:"tsp",tsps:"tsp",
  ounce:"oz",ounces:"oz",oz:"oz",
  pound:"lb",pounds:"lb",lbs:"lb",lb:"lb",
  gram:"g",grams:"g",g:"g",
  kilogram:"kg",kilograms:"kg",kg:"kg",
  milliliter:"ml",milliliters:"ml",millilitre:"ml",millilitres:"ml",ml:"ml",
  liter:"l",liters:"l",litre:"l",litres:"l",l:"l",
  pinch:"pinch",pinches:"pinch",
  clove:"clove",cloves:"clove",
  can:"can",cans:"can",
  slice:"slice",slices:"slice",
  head:"head",heads:"head",
  stalk:"stalk",stalks:"stalk",
  sprig:"sprig",sprigs:"sprig",
  package:"pkg",packages:"pkg",pkg:"pkg",pkgs:"pkg",
  bunch:"bunch",bunches:"bunch",
  large:"large",medium:"medium",small:"small",whole:"whole",
};

function abbreviateUnit(unit:string):string {
  const clean=unit.trim().toLowerCase().replace(/\.$/,"");
  if(!clean)return "";
  return UNIT_ABBREVIATIONS[clean]||unit.trim();
}

function splitLastWord(name:string):[string,string] {
  const idx=name.lastIndexOf(" ");
  if(idx===-1)return["",name];
  return[name.slice(0,idx+1),name.slice(idx+1)];
}

function singularizeWord(word:string):string {
  if(/^(ss|us|is|ies)$/i.test(word))return word;
  if(/ies$/i.test(word)&&word.length>3)return word.slice(0,-3)+"y";
  if(/(ches|shes|xes|zes|sses)$/i.test(word))return word.slice(0,-2);
  if(/oes$/i.test(word))return word.slice(0,-2);
  if(/s$/i.test(word)&&!/ss$/i.test(word))return word.slice(0,-1);
  return word;
}

function pluralizeWord(word:string):string {
  if(!word)return word;
  if(/[^aeiou]y$/i.test(word))return word.slice(0,-1)+"ies";
  if(/(ch|sh|x|z|s)$/i.test(word))return word+"es";
  return word+"s";
}

function singularizeName(name:string):string {
  const [prefix,last]=splitLastWord(name);
  return prefix+singularizeWord(last);
}

function ingredientMatchKey(name:string) {
  return singularizeName(name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim());
}

function matchesGlobalIngredient(name:string, globalItems:ShoppingItem[]) {
  const recipeKey = ingredientMatchKey(name);
  return globalItems.some(item => {
    const globalKey = ingredientMatchKey(item.ingredient_name);
    return globalKey === recipeKey || (globalKey.length > 2 && recipeKey.length > 2 && (recipeKey.includes(globalKey) || globalKey.includes(recipeKey)));
  });
}

function pluralizeName(name:string):string {
  const [prefix,last]=splitLastWord(name);
  return prefix+pluralizeWord(last);
}

const PLURALIZABLE_COUNT_UNITS=new Set(["clove","slice","head","stalk","sprig","pkg","bunch","pinch","can","cup","tablespoon","teaspoon","ounce","pound","gram","kilogram","milliliter","liter"]);

function formatAmountFraction(amount:number):string {
  const rounded=Math.round(amount*100)/100;
  const whole=Math.floor(rounded);
  const frac=Math.round((rounded-whole)*100)/100;
  let fracStr="";
  if(Math.abs(frac-0.5)<0.03) fracStr="½";
  else if(Math.abs(frac-0.25)<0.03) fracStr="¼";
  else if(Math.abs(frac-0.75)<0.03) fracStr="¾";
  else if(Math.abs(frac-0.33)<0.03) fracStr="⅓";
  else if(Math.abs(frac-0.67)<0.03) fracStr="⅔";
  else if(Math.abs(frac-0.125)<0.02) fracStr="⅛";
  
  if(fracStr){
    return whole>0?`${whole} ${fracStr}`:fracStr;
  }
  return String(rounded);
}

function displayUnit(unit:string,amount:number):string {
  if(!unit)return "";
  const isSingular = Math.round(amount*100)/100 <= 1;
  if(unit==="cup"||unit==="c") return isSingular?"cup":"cups";
  if(unit==="tablespoon"||unit==="tbsp") return isSingular?"tablespoon":"tablespoons";
  if(unit==="teaspoon"||unit==="tsp") return isSingular?"teaspoon":"teaspoons";
  if(!PLURALIZABLE_COUNT_UNITS.has(unit))return unit;
  return isSingular?unit:pluralizeWord(unit);
}

function formatIngredientPhrase(item:Ingredient, scaledAmount?:number):string {
  const amt = scaledAmount !== undefined ? scaledAmount : item.amount;
  if(item.hasQty===false){
    return item.name;
  }
  const amtStr = formatAmountFraction(amt);
  const u = displayUnit(item.unit, amt);
  if(u){
    return `${amtStr} ${u} ${item.name}`;
  }
  return `${amtStr} ${item.name}`;
}

const PREP_TRAILING_WORD_PATTERN=/^(minced|chopped|diced|sliced|slivered|julienned|shredded|grated|melted|softened|beaten|whisked|peeled|seeded|cored|pitted|trimmed|halved|quartered|crushed|mashed|drained|rinsed|room temperature|cold|divided|optional|to taste|for garnish|for serving)\b/i;

function cleanIngredientName(rawName:string):string {
  let name=rawName
    .replace(/\([^)]*\)/g," ")
    .replace(/\s{2,}/g," ")
    .trim();
  const commaIndex=name.indexOf(",");
  if(commaIndex>0){
    const before=name.slice(0,commaIndex).trim();
    const after=name.slice(commaIndex+1).trim();
    if(before&&(!after||PREP_TRAILING_WORD_PATTERN.test(after)||/^and\b/i.test(after)||/\bcut into\b/i.test(after))){
      name=before;
    }
  }
  name=name.replace(/\s+(?:and\s+)?(?:cut|sliced|chopped|diced|trimmed)\s+into\b.*$/i,"").trim();
  return name||rawName.trim();
}

const GROCERY_CATEGORY_ORDER=[
  "Fruit",
  "Vegetables",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pasta & Grains",
  "Pantry / Dry Goods",
  "Canned & Jarred Goods",
  "Soups, Broths & Stocks",
  "Condiments & Sauces",
  "Spices & Seasonings",
  "Frozen",
  "Snacks",
  "Beverages",
  "Household / Other",
];

function categoryFor(name:string, unit="") {
  const value=name.toLowerCase();
  if(/\b(broth|stock|bouillon|consomm[eé])\b/.test(value)) return "Soups, Broths & Stocks";
  if(/\b(chicken|beef|turkey|pork|lamb|sausage|bacon|ham|salmon|shrimp|prawn|fish|tuna|cod|meat)\b/.test(value)) return "Meat & Seafood";
  if(/\b(milk|cheese|feta|cream|yogurt|butter|egg|eggs|sour cream|cottage cheese)\b/.test(value)) return "Dairy & Eggs";
  if(/\b(bread|tortilla|bun|roll|pita|bagel|brioche|naan)\b/.test(value)) return "Bakery";
  if(/\b(canned|jarred|tomato paste|tomato sauce|marinara|canned tomatoes|crushed tomatoes|diced tomatoes|whole tomatoes|pickles|olives|jam|jelly)\b/.test(value)||/^(can|jar)$/.test(unit)) return "Canned & Jarred Goods";
  if(/\b(mayo|mayonnaise|mustard|ketchup|soy sauce|hot sauce|salsa|vinegar|dressing|olive oil|vegetable oil|sesame oil)\b/.test(value)) return "Condiments & Sauces";
  if(/\b(salt|pepper|cumin|paprika|cinnamon|oregano|thyme|rosemary|basil|seasoning|spice|nutmeg|chili powder|curry)\b/.test(value)) return "Spices & Seasonings";
  if(/\b(frozen|ice cream|sorbet)\b/.test(value)) return "Frozen";
  if(/\b(chips|crackers|popcorn|pretzel|granola bar|snack|nuts|trail mix)\b/.test(value)) return "Snacks";
  if(/\b(coffee|tea|juice|soda|water|lemonade|wine|beer|drink|beverage)\b/.test(value)) return "Beverages";
  if(/\b(foil|plastic wrap|paper towel|napkin|detergent|cleaner|trash bag|parchment)\b/.test(value)) return "Household / Other";
  if(/\b(onion|garlic|shallot|chive|pepper)\s+powder\b/.test(value)) return "Spices & Seasonings";
  if(/\b(gnocchi|ravioli|tortellini|dumplings?|pierogi|stuffed pasta|quinoa|rice|pasta|noodle|grain|oat|couscous|flour|sugar|bean|lentil|cornmeal|breadcrumb)\b/.test(value)) return "Pantry / Dry Goods";
  if(/\b(?:fresh\s+)?lemon\s+juice\b/.test(value)) return "Vegetables";
  if(/\b(apple|banana|berries|berry|blueberr(?:y|ies)|blackberr(?:y|ies)|raspberr(?:y|ies)|strawberr(?:y|ies)|cherr(?:y|ies)|grape|orange|mandarin|tangerine|grapefruit|lemon|lime|peach|nectarine|plum|pear|mango|pineapple|watermelon|cantaloupe|melon|kiwi|papaya|coconut|pomegranate|fig|date|raisin|cranberr(?:y|ies))\b/.test(value)) return "Fruit";
  if(/\b(tomato|tomatoes|onion|onions|garlic|pepper|peppers|lettuce|potato|potatoes|cucumber|cucumbers|carrot|carrots|celery|spinach|kale|avocado|avocados|mushroom|mushrooms|broccoli|zucchini|herb|herbs|parsley|cilantro|mint|scallion|scallions|ginger)\b/.test(value)) return "Vegetables";
  return "Pantry / Dry Goods";
}

function excludeFromShoppingList(name:string) {
  const value=name.toLowerCase().trim();
  return /\bwater\b/.test(value) && !/\bsparkling\s+water\b/.test(value);
}

function parseAmount(raw:string):number {
  return raw.split(/\s+/).reduce((total,part)=>{
    if(!part.includes("/")) return total+Number(part);
    const [top,bottom]=part.split("/").map(Number);
    return total+(bottom?top/bottom:0);
  },0);
}

function normalizeShoppingIngredient(item:Ingredient):Ingredient {
  const embeddedQuantity=/^\s*(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s+(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kg|ml|liters?|l)\s+(.+)$/i.exec(item.name);
  const parsedItem=embeddedQuantity
    ? {...item,amount:parseAmount(embeddedQuantity[1]),unit:abbreviateUnit(embeddedQuantity[2]),name:embeddedQuantity[3],hasQty:true}
    : item;
  const preparedName=parsedItem.name
    .replace(/^(?:freshly|coarsely|finely)\s+ground\s+/i,"")
    .replace(/^(?:chopped|minced|diced|sliced|shredded|grated|peeled|crushed|trimmed|halved|quartered)\s+/i,"")
    .replace(/\s+/g," ").trim();
  const value=preparedName.toLowerCase();
  if(/\bsalt\b/.test(value)) {
    const unit=parsedItem.unit.toLowerCase();
    if(unit==="tablespoon"||unit==="tbsp") return {...parsedItem,name:"salt",amount:parsedItem.amount*3,unit:"tsp",hasQty:true};
    if(unit==="cup"||unit==="c") return {...parsedItem,name:"salt",amount:parsedItem.amount*48,unit:"tsp",hasQty:true};
    return {...parsedItem,name:"salt"};
  }
  if(/\bpepper\b/.test(value) && !/\b(bell|jalapeño?|chili|chilli|banana|cayenne)\s+pepper\b/.test(value)) {
    const unit=parsedItem.unit.toLowerCase();
    if(unit==="tablespoon"||unit==="tbsp") return {...parsedItem,name:"pepper",amount:parsedItem.amount*3,unit:"tsp",hasQty:true};
    if(unit==="cup"||unit==="c") return {...parsedItem,name:"pepper",amount:parsedItem.amount*48,unit:"tsp",hasQty:true};
    return {...parsedItem,name:"pepper"};
  }
  return {...parsedItem,name:preparedName};
}

function ingredientLineFor(item:Ingredient) {
  const amount=Math.round(item.amount*100)/100;
  const parts=[amount?String(amount):"",item.unit,item.name].filter(Boolean);
  return parts.join(" ");
}

const DESCRIPTOR_UNIT_PATTERN=/^(cloves?|pinch(?:es)?|cans?|slices?|heads?|stalks?|sprigs?|packages?|pkgs?|bunch(?:es)?|large|medium|small|whole)\s+(.+)$/i;
const TRAILING_DESCRIPTOR_UNIT_PATTERN=/^(.+?)\s+(cloves?|pinch(?:es)?|cans?|slices?|heads?|stalks?|sprigs?|packages?|pkgs?|bunch(?:es)?|large|medium|small|whole)$/i;

function normalizeIngredient(raw:unknown):Ingredient|null {
  if(typeof raw==="string"){
    const trimmed=raw.trim();
    if(trimmed.startsWith("{")&&trimmed.endsWith("}")){
      try{return normalizeIngredient(JSON.parse(trimmed))}catch{/* fall through to line parsing */}
    }
    return parseIngredientLine(raw);
  }
  if(!raw||typeof raw!=="object") return null;
  const item=raw as Partial<Ingredient>;
  let name=typeof item.name==="string"?item.name.trim():"";
  if(!name)return null;
  const hasQty=typeof item.hasQty==="boolean"?item.hasQty:Number.isFinite(Number(item.amount));
  let amount=hasQty?Number(item.amount):1;
  let unit=abbreviateUnit(typeof item.unit==="string"?item.unit:"");
  if(unit.toLowerCase()==="l"&&/^arge\b/i.test(name)){name=`l${name}`;unit=""}
  const trailingFraction=name.match(/^(?:(\d+)\/|\/)(\d+)\s+(.+)$/);
  if(trailingFraction){amount+=Number(trailingFraction[1]||1)/Number(trailingFraction[2]);name=trailingFraction[3]}
  name=cleanIngredientName(name);
  if(!unit&&hasQty){const descriptorMatch=name.match(DESCRIPTOR_UNIT_PATTERN);if(descriptorMatch){unit=abbreviateUnit(descriptorMatch[1]);name=descriptorMatch[2]}}
  if(!unit){const trailingDescriptorMatch=name.match(TRAILING_DESCRIPTOR_UNIT_PATTERN);if(trailingDescriptorMatch){name=trailingDescriptorMatch[1];unit=abbreviateUnit(trailingDescriptorMatch[2])}}
  return {name,amount,unit,category:categoryFor(name,unit),hasQty};
}

function parseIngredientLine(line:string):Ingredient {
  const clean=line.trim();
  const normalized=clean
    .replace(/(\d)½/g,"$1 1/2").replace(/(\d)¼/g,"$1 1/4").replace(/(\d)¾/g,"$1 3/4").replace(/(\d)⅓/g,"$1 1/3").replace(/(\d)⅔/g,"$1 2/3")
    .replace(/^½/,"1/2 ").replace(/^¼/,"1/4 ").replace(/^¾/,"3/4 ").replace(/^⅓/,"1/3 ").replace(/^⅔/,"2/3 ");
  const match=normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+(?:(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kg|ml|liters?|l|cloves?|pinch(?:es)?|cans?|slices?|heads?|stalks?|sprigs?|packages?|pkgs?|bunch(?:es)?|large|medium|small|whole)\b\s*)?(.*)$/i);
  if(!match){
    const trailingDescriptorMatch=clean.match(TRAILING_DESCRIPTOR_UNIT_PATTERN);
    if(trailingDescriptorMatch)return{name:trailingDescriptorMatch[1],amount:1,unit:abbreviateUnit(trailingDescriptorMatch[2]),category:categoryFor(trailingDescriptorMatch[1],abbreviateUnit(trailingDescriptorMatch[2])),hasQty:false};
    return{name:clean,amount:1,unit:"",category:categoryFor(clean),hasQty:false};
  }
  const rawAmount=match[1]; const amount=rawAmount.split(/\s+/).reduce((total,part)=>{if(!part.includes("/"))return total+Number(part);const [top,bottom]=part.split("/").map(Number);return total+top/bottom},0);
  const name=cleanIngredientName((match[3]||clean).replace(/^of\s+/i,"").trim());
  const parsedUnit=abbreviateUnit(match[2]||"");
  return{name,amount,unit:parsedUnit,category:categoryFor(name,parsedUnit),hasQty:true};
}

export default function Home() {
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [derivedRecipePalettes,setDerivedRecipePalettes]=useState<Record<string,RecipePalette>>({});
  const [weekOffset,setWeekOffset]=useState<0|1>(0);
  const [doneCollapsed,setDoneCollapsed]=useState(false);
  const [plans,setPlans]=useState<Record<string,WeeklyPlan>>({[weekKey(0)]:{selected:["roasted-veg-bowl","lemon-herb-chicken"],done:[],servings:{"roasted-veg-bowl":4,"lemon-herb-chicken":4},checked:[],chefs:{},days:{}}});
  const [history,setHistory]=useState<SavedWeek[]>([]);
  const [query,setQuery]=useState("");
  const [tagFilter,setTagFilter]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [time,setTime]=useState("");
  const [url,setUrl]=useState("");
  const [ingredients,setIngredients]=useState("");
  const [directions,setDirections]=useState("");
  const [directionImages,setDirectionImages]=useState<(string|undefined)[]>([]);
  const [imageUrl,setImageUrl]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [tag,setTag]=useState("");
  const [recipeEditDrafts,setRecipeEditDrafts]=useState<RecipeEditDrafts>({});
  const [savingRecipeEdits,setSavingRecipeEdits]=useState(false);
  const [recipeEditError,setRecipeEditError]=useState("");
  const [activeRecipe,setActiveRecipe]=useState<Recipe|null>(null);
  const [recipeToDelete,setRecipeToDelete]=useState<Recipe|null>(null);
  const [recipeTab,setRecipeTab]=useState<"ingredients"|"directions">("ingredients");
  const [cookingProgress,setCookingProgress]=useState<CookingProgress>({});
  const [cookingProgressLoaded,setCookingProgressLoaded]=useState(false);
  const [ingredientSectionsCollapsed,setIngredientSectionsCollapsed]=useState<Record<"toUse"|"used",boolean>>({toUse:false,used:false});
  const [addMode,setAddMode]=useState<"url"|"review"|"manual">("url");
  const [importing,setImporting]=useState(false);
  const [importError,setImportError]=useState("");
  const [saveError,setSaveError]=useState("");
  const [savingRecipe,setSavingRecipe]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const [loaded,setLoaded]=useState(false);
  const [view,setView]=useState("plan");
  const [stickyHeaderTop,setStickyHeaderTop]=useState(0);
  const [mockCategoryPreview,setMockCategoryPreview]=useState(false);
  const [mockRecipePreview,setMockRecipePreview]=useState(false);
  const [shopTab,setShopTab]=useState<"meals"|"global">("meals");
  const [revealedRemoveRecipeId,setRevealedRemoveRecipeId]=useState<string|null>(null);
  const [preRecipesView,setPreRecipesView]=useState("plan");
  const [planPicking,setPlanPicking]=useState(false);
  const [planQuery,setPlanQuery]=useState("");
  const [planSearchOpen,setPlanSearchOpen]=useState(false);
  const [planErrors,setPlanErrors]=useState<Record<string,string>>({});
  useEffect(()=>{if(view!=="recipes"){setSearchOpen(false);setQuery("")}},[view]);
  useEffect(()=>{if(view!=="plan"){setPlanPicking(false);setPlanQuery("");setPlanSearchOpen(false)}},[view]);
  const [syncing,setSyncing]=useState(false);
  const [shoppingItems,setShoppingItems]=useState<ShoppingItem[]>([]);
  const [globalItems,setGlobalItems]=useState<ShoppingItem[]>([]);
  const [globalItemText,setGlobalItemText]=useState("");
  const [globalItemEntryOpen,setGlobalItemEntryOpen]=useState(false);
  const [globalItemError,setGlobalItemError]=useState("");
  const [savingGlobalItem,setSavingGlobalItem]=useState(false);
  const [globalSectionsCollapsed,setGlobalSectionsCollapsed]=useState<Record<"toGet"|"completed",boolean>>({toGet:false,completed:false});
  const [planSynced,setPlanSynced]=useState<Record<string,boolean>>({});
  const [recipesLoaded,setRecipesLoaded]=useState(false);
  const unsubscribeRef=useRef<(() => void)|null>(null);
  const sharedHeaderRef=useRef<HTMLElement|null>(null);
  const sharedControlsRef=useRef<HTMLDivElement|null>(null);
  const recipePaletteCacheRef=useRef(new Map<string,Promise<RecipePalette|null>>());
  const removeLongPressTimerRef=useRef<number|null>(null);
  const longPressTriggeredRef=useRef(false);
  const globalUnsubscribeRef=useRef<(() => void)|null>(null);
  const planUnsubscribeRef=useRef<(() => void)|null>(null);
  const historyUnsubscribeRef=useRef<(() => void)|null>(null);
  useEffect(()=>()=>{if(removeLongPressTimerRef.current!==null)window.clearTimeout(removeLongPressTimerRef.current)},[]);
  useEffect(()=>{
    const header=sharedHeaderRef.current;
    const controls=sharedControlsRef.current;
    if(!header||!controls)return;
    const updateStickyOffset=()=>{
      const next=Math.round(controls.getBoundingClientRect().height-header.getBoundingClientRect().height);
      setStickyHeaderTop(current=>current===next?current:next);
    };
    updateStickyOffset();
    const observer=new ResizeObserver(updateStickyOffset);
    observer.observe(header);
    observer.observe(controls);
    return()=>observer.disconnect();
  },[view]);
  const activeWeekKey=weekKey(weekOffset);
  const activeCookingProgress=activeRecipe?cookingProgress[activeWeekKey]?.[activeRecipe.id]:undefined;
  const checkedIngredients=activeCookingProgress?.ingredients||[];
  const completedSteps=activeCookingProgress?.steps||[];
  useEffect(()=>{
    let active=true;
    const paletteRequests=recipes.map(async recipe=>{
      const imageUrl=recipeImageFor(recipe);
      if(!imageUrl)return[recipe.id,null] as const;
      const basePalette=fallbackRecipePaletteFor(recipe.id);
      const cacheKey=`${imageUrl}:${basePalette.surfaceColor}`;
      let request=recipePaletteCacheRef.current.get(cacheKey);
      if(!request){
        request=extractRecipePalette(imageUrl,basePalette).catch(()=>null);
        recipePaletteCacheRef.current.set(cacheKey,request);
      }
      return[recipe.id,await request] as const;
    });
    void Promise.all(paletteRequests).then(entries=>{
      if(active)setDerivedRecipePalettes(Object.fromEntries(entries.filter((entry):entry is readonly [string,RecipePalette]=>entry[1]!==null)));
    });
    return()=>{active=false};
  },[recipes]);
  const activePlan=plans[activeWeekKey]||{selected:[],done:[],servings:{},checked:[],chefs:{},days:{}};
  const visibleRecipeIds=new Set(recipes.map(recipe=>recipe.id));
  const selected=(activePlan.selected||[]).filter(id=>visibleRecipeIds.has(id));
  const done=selectedDoneRecipes(selected,activePlan.done);
  const servings=Object.fromEntries(Object.entries(activePlan.servings||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const checked=activePlan.checked||[];
  const chefs=Object.fromEntries(Object.entries(activePlan.chefs||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const days=Object.fromEntries(Object.entries(activePlan.days||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const emptyPlan=():WeeklyPlan=>({selected:[],done:[],servings:{},checked:[],chefs:{},days:{}});
  const setSelected=(update:(current:string[])=>string[])=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,selected:update(plan.selected)}}});
  const setServings=(update:(current:Record<string,number>)=>Record<string,number>)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,servings:update(plan.servings)}}});
  const setChecked=(update:(current:string[])=>string[])=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,checked:update(plan.checked)}}});
  const setChef=(id:string,name:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,chefs:{...(plan.chefs||{}),[id]:name}}}});
  const setDay=(id:string,day:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,days:{...(plan.days||{}),[id]:day}}}});
  const toggleDinnerDone=(id:string)=>{setPlanErrors(previous=>({...previous,[activeWeekKey]:""}));setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();if(!plan.selected.includes(id))return all;return{...all,[activeWeekKey]:{...plan,done:toggleDoneRecipe(plan.selected,plan.done,id)}}})};
  const weekdayOrder=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayOrderIndex=(day:string|undefined)=>{
    const normalized=(day||"").trim().toLowerCase();
    if(!normalized)return weekdayOrder.length;
    const idx=weekdayOrder.findIndex(name=>name.startsWith(normalized)||normalized.startsWith(name));
    return idx===-1?weekdayOrder.length:idx;
  };
  // Only reorder cards once a day field is committed (blurred), not on every keystroke,
  // so the card the user is typing into doesn't jump position mid-word and steal focus.
  const [committedDays,setCommittedDays]=useState<Record<string,string>>({});
  useEffect(()=>{setCommittedDays(days)},[activeWeekKey]);
  useEffect(()=>{
    setCommittedDays(prev=>{
      const missing=Object.keys(days).filter(id=>!(id in prev));
      if(missing.length===0)return prev;
      return{...prev,...Object.fromEntries(missing.map(id=>[id,days[id]]))};
    });
  },[days]);
  const commitDay=(id:string)=>setCommittedDays(prev=>({...prev,[id]:days[id]||""}));
  const orderedSelectedRecipes=useMemo(()=>recipes.filter(r=>selected.includes(r.id)).sort((a,b)=>dayOrderIndex(committedDays[a.id])-dayOrderIndex(committedDays[b.id])),[recipes,selected,committedDays]);
  const dinnersToMake=orderedSelectedRecipes.filter(recipe=>!done.includes(recipe.id));
  const dinnersDone=orderedSelectedRecipes.filter(recipe=>done.includes(recipe.id));
  const weekLabel=weekRange(weekOffset);
  const weekLabelShort=weekRangeShort(weekOffset);
  const headerImages=useMemo(()=>{
    const imgs=Array.from(new Set(recipes.map(r=>r.image).filter((img):img is string=>Boolean(img))));
    return imgs.length?imgs:["/family-taco-night.png?v=2"];
  },[recipes]);
  const headerTaglines=["Good food, happy family.","Plan the week together.","Bring one tidy list to the store.","Keep the recipes everyone loves in one place."];
  const [headerTick,setHeaderTick]=useState(0);
  useEffect(()=>{
    const interval=setInterval(()=>setHeaderTick(t=>t+1),6000);
    return()=>clearInterval(interval);
  },[]);
  const headerImageIndex=headerTick%headerImages.length;
  const headerTagline=headerTaglines[headerTick%headerTaglines.length];

  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);const localHost=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";const useMockRecipes=localHost&&params.get("mockRecipes")==="1";setMockCategoryPreview(params.get("mockCategory")==="1");setMockRecipePreview(useMockRecipes);if(params.get("view")==="shop")setView("shop");if(params.get("resetLocal")==="1"){localStorage.removeItem("cameron-family-table");localStorage.removeItem("cameron-cooking-progress");params.delete("resetLocal");const newUrl=window.location.pathname+(params.toString()?"?"+params.toString():"");window.history.replaceState({},"",newUrl);}const raw=localStorage.getItem("cameron-family-table");if(raw){const s=JSON.parse(raw);setHistory(s.history||[]);setPlans(s.plans||{[weekKey(0)]:{selected:s.selected||[],done:[],servings:s.servings||Object.fromEntries((s.selected||[]).map((id:string)=>[id,4])),checked:s.checked||[],chefs:{},days:{}}})}loadSharedRecipes(useMockRecipes)}finally{setLoaded(true)}},[]);
  useEffect(()=>{
    if(!loaded)return;
    if(mockRecipePreview){setCookingProgressLoaded(true);return}
    try{
      const raw=localStorage.getItem("cameron-cooking-progress");
      if(raw)setCookingProgress(parseCookingProgress(raw));
      setCookingProgressLoaded(true);
    }catch(error){console.error("Failed to load cooking progress:",error)}
  },[loaded,mockRecipePreview]);
  useEffect(()=>{
    if(!cookingProgressLoaded||mockRecipePreview)return;
    try{localStorage.setItem("cameron-cooking-progress",JSON.stringify(cookingProgress))}
    catch(error){console.error("Failed to save cooking progress:",error)}
  },[cookingProgress,cookingProgressLoaded,mockRecipePreview]);
  const [sharedLinkApplied,setSharedLinkApplied]=useState(false);
  useEffect(()=>{
    if(!loaded||sharedLinkApplied)return;
    const params=new URLSearchParams(window.location.search);
    const sharedView=params.get("view");
    if(!sharedView){setSharedLinkApplied(true);return}
    if(!recipes.length)return;
    setSharedLinkApplied(true);
    if(sharedView==="recipes"){
      setView("recipes");
      const recipeId=params.get("recipe");
      if(recipeId){const found=recipes.find(r=>r.id===recipeId);if(found)openRecipe(found)}
    }else if(sharedView==="shop"){
      const sharedWeek=params.get("week");
      if(sharedWeek==="1")setWeekOffset(1);
      changeView("shop");
    }
  },[loaded,sharedLinkApplied,recipes]);
  useEffect(()=>{
    if(!loaded||!sharedLinkApplied)return;
    const params=new URLSearchParams();
    if(view==="recipes"){
      params.set("view","recipes");
      if(activeRecipe)params.set("recipe",activeRecipe.id);
    }else if(view==="shop"){
      params.set("view","shop");
      params.set("week",String(weekOffset));
    }
    if(mockRecipePreview)params.set("mockRecipes","1");
    const search=params.toString();
    const newUrl=window.location.pathname+(search?`?${search}`:"");
    if(newUrl!==window.location.pathname+window.location.search)window.history.replaceState({},"",newUrl);
  },[loaded,sharedLinkApplied,view,activeRecipe,weekOffset,mockRecipePreview]);
  const loadSharedRecipes=async(useMocks=mockRecipePreview)=>{if(useMocks){const normalized:Recipe[]=MOCK_RECIPES.map(recipe=>({...recipe,ingredients:recipe.ingredients.map(normalizeIngredient).filter((ingredient):ingredient is Ingredient=>ingredient!==null),directions:recipe.directions.map(normalizeDirectionStep).filter((step):step is string|DirectionStep=>step!==null)}));const ids=normalized.map(recipe=>recipe.id);setRecipes(normalized);setPlans(all=>({...all,[weekKey(0)]:{...emptyPlan(),selected:ids,servings:Object.fromEntries(ids.map(id=>[id,4]))}}));setRecipesLoaded(true);return true}try{const response=await fetch("/api/recipes");if(!response.ok)return false;const {recipes:shared}=await response.json();if(Array.isArray(shared)){const normalized=shared.map((r:any)=>({...r,tag:typeof r.tag==="string"?r.tag.trim()||undefined:undefined,sourceUrl:r.sourceUrl||r.source_url||undefined,sourceName:r.sourceName||r.source_name||undefined,ingredients:Array.isArray(r.ingredients)?r.ingredients.map((i:any)=>normalizeIngredient(i)).filter((i:Ingredient|null):i is Ingredient=>i!==null):[],directions:Array.isArray(r.directions)?r.directions.map(normalizeDirectionStep).filter((d:any):d is string|DirectionStep=>d!==null):[]}));setRecipes(normalized);setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>[key,{...plan,selected:plan.selected.filter(id=>normalized.some(recipe=>recipe.id===id)),done:(plan.done||[]).filter(id=>normalized.some(recipe=>recipe.id===id)),servings:Object.fromEntries(Object.entries(plan.servings).filter(([id])=>normalized.some(recipe=>recipe.id===id))),checked:plan.checked,chefs:Object.fromEntries(Object.entries(plan.chefs||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id))),days:Object.fromEntries(Object.entries(plan.days||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id)))}])));setRecipesLoaded(true);return true}return false}catch(e){console.error("Failed to load shared recipes:",e);return false}};
  const syncGlobalItems=async()=>{
    const response=await fetch("/api/shopping/global");
    if(!response.ok) throw new Error("Failed to fetch global shopping items");
    const {items}=await response.json();
    if(Array.isArray(items)) setGlobalItems(items);
  };
  const syncNow=async()=>{if(mockRecipePreview)return true;setSyncing(true);try{const hasShared=await loadSharedRecipes();if(hasShared){const response=await fetch(`/api/shopping?week_key=${encodeURIComponent(activeWeekKey)}`);if(response.ok){const {items}=await response.json();if(Array.isArray(items))setShoppingItems(items)}await syncGlobalItems()}return hasShared}finally{setSyncing(false)}};
  const refreshRecipeImages=async()=>{
    const candidates=recipes.filter(recipe=>recipe.sourceUrl);
    for(const recipe of candidates){
      try{
        const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:recipe.sourceUrl})});
        if(!response.ok)continue;
        const imported=await response.json();
        const importedDirections=(imported.directions||[]).map(normalizeDirectionStep).filter((step: string|DirectionStep|null): step is string|DirectionStep=>step!==null);
        const currentDirections=(recipe.directions||[]).map(normalizeDirectionStep).filter((step: string|DirectionStep|null): step is string|DirectionStep=>step!==null);
        const directions=currentDirections.map((step,index)=>{
          const importedStep=importedDirections[index];
          const existingImage=directionImage(step);
          const newImage=directionImage(importedStep);
          return newImage&&!existingImage?{text:directionText(step),image:newImage}:step;
        });
        const image=recipe.image||imported.image;
        const changed=image!==recipe.image||directions.some((step,index)=>directionImage(step)!==directionImage(currentDirections[index]));
        if(!changed)continue;
        await fetch(`/api/recipes/${recipe.id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({image,directions})});
      }catch(error){console.error(`Failed to refresh images for ${recipe.title}:`,error)}
    }
  };
  const hardRefresh=async()=>{setSyncing(true);try{await refreshRecipeImages();await syncNow()}finally{window.location.reload()}};
  useEffect(()=>{if(loaded&&!mockRecipePreview)localStorage.setItem("cameron-family-table",JSON.stringify({recipes,plans,history}))},[loaded,recipes,plans,history,mockRecipePreview]);
  const mergeRemoteHistory=(remoteWeeks:any[])=>{
    if(!Array.isArray(remoteWeeks))return;
    const normalized:SavedWeek[]=remoteWeeks.map(w=>({id:w.id,label:w.label,savedAt:w.saved_at,meals:Array.isArray(w.meals)?w.meals:[]}));
    setHistory(current=>{
      const byId=new Map(current.map(w=>[w.id,w]));
      normalized.forEach(w=>byId.set(w.id,w));
      return Array.from(byId.values()).sort((a,b)=>new Date(b.savedAt).getTime()-new Date(a.savedAt).getTime());
    });
  };
  useEffect(()=>{
    if(!loaded||mockRecipePreview)return;
    let cancelled=false;
    (async()=>{try{const weeks=await fetchHistory();if(!cancelled)mergeRemoteHistory(weeks)}catch(e){console.error("Failed to fetch history:",e)}})();
    if(historyUnsubscribeRef.current)historyUnsubscribeRef.current();
    historyUnsubscribeRef.current=subscribeToHistory(mergeRemoteHistory);
    return()=>{cancelled=true;if(historyUnsubscribeRef.current)historyUnsubscribeRef.current()};
  },[loaded,mockRecipePreview]);
  useEffect(()=>{
    if(!loaded||mockRecipePreview)return;
    const currentKey=weekKey(0);
    const savedLabels=new Set(history.map(week=>week.label));
    const newlyCompleted=Object.entries(plans).filter(([key,plan])=>key<currentKey&&plan.selected.length>0&&!savedLabels.has(weekRangeFromKey(key))).map(([key,plan])=>({
      id:`auto-${key}`,
      label:weekRangeFromKey(key),
      savedAt:new Date().toISOString(),
      meals:recipes.filter(recipe=>plan.selected.includes(recipe.id)).map(recipe=>({id:recipe.id,title:recipe.title,emoji:recipe.emoji,people:plan.servings[recipe.id]||4,chef:plan.chefs?.[recipe.id]?.trim()||undefined,day:plan.days?.[recipe.id]?.trim()||undefined}))
    })).filter(week=>week.meals.length>0);
    if(newlyCompleted.length){setHistory(current=>[...newlyCompleted,...current]);newlyCompleted.forEach(week=>{saveHistoryWeek(week).catch(e=>console.error("Failed to save history week:",e))})}
  },[loaded,plans,recipes,history,mockRecipePreview]);

  const grocery=useMemo(()=>{
    const items=new Map<string,Ingredient>();
    recipes.filter(r=>selected.includes(r.id)).forEach(r=>(Array.isArray(r.ingredients)?r.ingredients:[]).forEach(raw=>{
      const normalized=normalizeIngredient(raw); if(!normalized)return;
      if(excludeFromShoppingList(normalized.name)) return;
      const shoppingIngredient=normalizeShoppingIngredient(normalized);
      if(matchesGlobalIngredient(shoppingIngredient.name,globalItems)) return;
      const i=/^c$/i.test(shoppingIngredient.unit.trim())?{...shoppingIngredient,amount:shoppingIngredient.amount*8,unit:"oz"}:shoppingIngredient;
      const canonicalName=singularizeName(i.name.trim());
      const canonicalKey=canonicalName.toLowerCase();
      const key=/^(salt|pepper)$/.test(canonicalKey)?`${canonicalKey}|${i.category}`:`${canonicalKey}|${i.unit.toLowerCase()}|${i.category}`;
      const old=items.get(key); const people=servings[r.id]||4;
      const amountToAdd=i.hasQty===false?0:i.amount*people/(r.serves||4);
      items.set(key,{...(old||i),...i,name:canonicalName,unit:i.unit||old?.unit||"",amount:(old?.amount||0)+amountToAdd,hasQty:(old?.hasQty??false)||(i.hasQty??false)});
      }));
    if(mockCategoryPreview)items.set("mobile preview item|unit|Mobile Preview",{name:"mobile preview item",amount:1,unit:"unit",category:"Mobile Preview",hasQty:true});
    return [...items.values()].sort((a,b)=>(GROCERY_CATEGORY_ORDER.indexOf(a.category)-GROCERY_CATEGORY_ORDER.indexOf(b.category))||a.name.localeCompare(b.name));
  },[recipes,selected,servings,globalItems,mockCategoryPreview]);
  const categories=[...new Set(grocery.map(i=>i.category))];
  const syncedChecked=useMemo(()=>{const localSet=new Set(checked);const syncedKeys=new Set(shoppingItems.filter(s=>s.checked).map(s=>s.ingredient_key));return Array.from(new Set([...localSet,...syncedKeys]));},[checked,shoppingItems]);
  const grocerySignature=useMemo(()=>JSON.stringify(grocery.map(g=>[g.name.toLowerCase(),g.unit.toLowerCase(),g.category,Math.round(g.amount*100)])),[grocery]);
  const lastSavedGrocerySignatureRef=useRef<Record<string,string>>({});
  useEffect(()=>{
    if(!loaded||grocery.length===0||mockCategoryPreview||mockRecipePreview)return;
    if(lastSavedGrocerySignatureRef.current[activeWeekKey]===grocerySignature)return;
    (async()=>{
      try{
        const items=grocery.map(g=>({ingredient_key:`${g.name.toLowerCase()}|${g.unit.toLowerCase()}|${g.category}`,ingredient_name:g.name,ingredient_amount:g.amount,ingredient_unit:g.unit,ingredient_category:g.category}));
        await saveShoppingList(activeWeekKey,items);
        lastSavedGrocerySignatureRef.current[activeWeekKey]=grocerySignature;
      }catch(e){console.error("Failed to save shopping list:",e)}
    })();
  },[grocery,activeWeekKey,loaded,mockCategoryPreview,mockRecipePreview]);
  useEffect(()=>{
    if(!loaded||mockRecipePreview)return;
    if(unsubscribeRef.current)unsubscribeRef.current();
    unsubscribeRef.current=subscribeToShoppingList(activeWeekKey,(items:ShoppingItem[])=>setShoppingItems(items));
    return()=>{if(unsubscribeRef.current)unsubscribeRef.current()};
  },[activeWeekKey,loaded,mockRecipePreview]);
  useEffect(()=>{
    if(!loaded||mockRecipePreview)return;
    if(globalUnsubscribeRef.current)globalUnsubscribeRef.current();
    globalUnsubscribeRef.current=subscribeToGlobalShoppingList(setGlobalItems);
    return()=>{if(globalUnsubscribeRef.current)globalUnsubscribeRef.current()};
  },[loaded,mockRecipePreview]);
  const planSignature=JSON.stringify(activePlan);
  useEffect(()=>{
    if(!loaded||mockRecipePreview||!planSynced[activeWeekKey]||!recipesLoaded)return;
    (async()=>{
      try{
        await saveWeeklyPlan(activeWeekKey,{selected_recipes:selected,done_recipes:done,servings,chefs,days});
        setPlanErrors(previous=>previous[activeWeekKey]?{...previous,[activeWeekKey]:""}:previous);
      }catch(e){setPlanErrors(previous=>({...previous,[activeWeekKey]:e instanceof Error?e.message:"Failed to save weekly plan"}));console.error("Failed to save weekly plan:",e)}
    })();
  },[planSignature,activeWeekKey,loaded,planSynced,recipesLoaded,mockRecipePreview]);
  const applyRemotePlan=(weekKeyToUpdate:string,remote:any)=>{
    setPlanSynced(prev=>prev[weekKeyToUpdate]?prev:{...prev,[weekKeyToUpdate]:true});
    if(!remote)return;
    setPlans(all=>{
      const local=all[weekKeyToUpdate]||emptyPlan();
      const merged:WeeklyPlan={
        selected:Array.isArray(remote.selected_recipes)?remote.selected_recipes:[],
        done:selectedDoneRecipes(Array.isArray(remote.selected_recipes)?remote.selected_recipes:[],readDoneRecipes(remote.days)),
        servings:remote.servings||{},
        checked:local.checked,
        chefs:remote.chefs||{},
        days:planDays(remote.days),
      };
      if(JSON.stringify(merged)===JSON.stringify(local))return all;
      return{...all,[weekKeyToUpdate]:merged};
    });
  };
  useEffect(()=>{
    if(!loaded||mockRecipePreview)return;
    let cancelled=false;
    (async()=>{try{const remote=await fetchWeeklyPlan(activeWeekKey);if(!cancelled)applyRemotePlan(activeWeekKey,remote)}catch(e){console.error("Failed to fetch weekly plan:",e)}})();
    if(planUnsubscribeRef.current)planUnsubscribeRef.current();
    planUnsubscribeRef.current=subscribeToWeeklyPlan(activeWeekKey,(remote:any)=>applyRemotePlan(activeWeekKey,remote));
    return()=>{cancelled=true;if(planUnsubscribeRef.current)planUnsubscribeRef.current()};
  },[activeWeekKey,loaded,mockRecipePreview]);
  useEffect(()=>{if(loaded)syncNow()},[loaded]);
  useEffect(()=>{if(!loaded)return;const interval=setInterval(()=>{syncNow()},30000);return()=>clearInterval(interval)},[loaded]);
  const [columnCount,setColumnCount]=useState(3);
  useEffect(()=>{
    const update=()=>{const w=typeof window!=="undefined"?window.innerWidth:1200; if(w<640) setColumnCount(1); else if(w<1024) setColumnCount(2); else setColumnCount(3);};
    update(); window.addEventListener('resize', update); return ()=>window.removeEventListener('resize', update);
  },[]);
  const categoryColumns = useMemo(()=>{ const cols = Array.from({length: Math.max(1, columnCount)}, ()=>[] as string[]); categories.forEach((c,i)=>cols[i%cols.length].push(c)); return cols; },[categories,columnCount]);

  const toggle=(id:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();const adding=!plan.selected.includes(id);return{...all,[activeWeekKey]:{...plan,selected:adding?[...plan.selected,id]:plan.selected.filter(recipeId=>recipeId!==id),done:adding?(plan.done||[]):(plan.done||[]).filter(recipeId=>recipeId!==id),servings:{...plan.servings,[id]:plan.servings[id]||4},checked:adding&&plan.selected.length===0?[]:plan.checked}}});
  const changeServings=(id:string,delta:number)=>setServings(v=>({...v,[id]:Math.max(1,(v[id]||4)+delta)}));
  const openRecipe=(recipe:Recipe)=>{setActiveRecipe(recipe);setRecipeEditDrafts({});setRecipeEditError("");setRecipeTab("ingredients");window.scrollTo({top:0,behavior:"smooth"})};
  const toggleStepDone=(index:number)=>{if(activeRecipe)setCookingProgress(previous=>toggleCookingItem(previous,activeWeekKey,activeRecipe.id,"steps",index))};
  const toggleIngredientDone=(recipeId:string,index:number)=>{
    setCookingProgress(previous=>toggleCookingItem(previous,activeWeekKey,recipeId,"ingredients",index));
  };
  const parseIngredientLines=(value:string)=>value.split("\n").map(line=>line.trim()).filter(Boolean).map(parseIngredientLine);
  const parsedIngredients=()=>parseIngredientLines(ingredients);
  const resolveStepImages=async(images:(string|undefined)[])=>Promise.all(images.map(async image=>{
    if(!image||!/(^|\.)flickr\.com\//i.test(image))return image;
    try{
      const response=await fetch("/api/resolve-image",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:image})});
      if(!response.ok)return image;
      const data=await response.json();
      return typeof data.url==="string"&&data.url?data.url:image;
    }catch{return image}
  }));
  const beginRecipeEdit=(recipe:Recipe|null=activeRecipe)=>{
    if(!recipe)return;
    const sameRecipe=activeRecipe?.id===recipe.id;
    if(!sameRecipe){setActiveRecipe(recipe);setRecipeTab("ingredients");window.scrollTo({top:0,behavior:"smooth"})}
    setRecipeEditDrafts({
      details:{title:recipe.title,tag:recipe.tag||"",time:["family recipe","time not provided"].includes(recipe.time.trim().toLowerCase())?"":recipe.time||"",image:recipe.image||"",sourceUrl:recipe.sourceUrl||"",sourceName:recipe.sourceName||""},
      ingredients:(recipe.ingredients||[]).map(ingredientLineFor).join("\n"),
      directions:{steps:(recipe.directions||[]).map(step=>({text:directionText(step),image:directionImage(step)||""}))},
    });
    setRecipeEditError("");
  };
  const updateDirectionDraft=(index:number,field:"text"|"image",value:string)=>{
    setRecipeEditDrafts(previous=>{
      if(!previous.directions)return previous;
      const steps=[...previous.directions.steps];
      steps[index]={...steps[index],[field]:value};
      return{...previous,directions:{steps}};
    });
  };
  const addDirectionDraftStep=()=>setRecipeEditDrafts(previous=>previous.directions?{...previous,directions:{steps:[...previous.directions.steps,{text:"",image:""}]}}:previous);
  const removeDirectionDraftStep=(index:number)=>setRecipeEditDrafts(previous=>previous.directions?{...previous,directions:{steps:previous.directions.steps.filter((_,stepIndex)=>stepIndex!==index)}}:previous);
  const cancelRecipeEdit=()=>{setRecipeEditDrafts({});setRecipeEditError("")};
  const saveRecipeEdits=async()=>{
    const recipe=activeRecipe;
    const draft=recipeEditDrafts;
    if(!recipe||savingRecipeEdits||!draft.details||draft.ingredients===undefined||!draft.directions)return;
    if(!draft.details.title.trim()){setRecipeEditError("Add a recipe name before saving.");return}
    setSavingRecipeEdits(true);
    setRecipeEditError("");
    try{
      const details=draft.details;
      const ingredients=parseIngredientLines(draft.ingredients);
      const resolvedImages=await resolveStepImages(draft.directions.steps.map(step=>step.image||undefined));
      const directions=draft.directions.steps.reduce<(string|DirectionStep)[]>((steps,step,index)=>{
        const text=step.text.trim();
        if(!text)return steps;
        const image=resolvedImages[index];
        steps.push(image?{text,image}:text);
        return steps;
      },[]);
      const title=details.title.trim();
      const time=details.time.trim()||"Time not provided";
      const tag=details.tag.trim()||undefined;
      const image=details.image.trim()||undefined;
      const sourceUrl=details.sourceUrl.trim()||undefined;
      const sourceName=details.sourceName.trim()||undefined;
      const updatedFields:Partial<Recipe>={title,time,tag,image,sourceUrl,sourceName,ingredients,directions};
      if(!mockRecipePreview){
        const response=await fetch(`/api/recipes/${recipe.id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({title,time,tag:tag||null,image:image||null,source_url:sourceUrl||null,source_name:sourceName||null,ingredients,directions})});
        if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe changes")}
        if(!await syncNow())throw new Error("Could not refresh recipes after saving.");
      }
      setRecipes(previous=>previous.map(current=>current.id===recipe.id?{...current,...updatedFields}:current));
      setActiveRecipe(previous=>previous&&previous.id===recipe.id?{...previous,...updatedFields}:previous);
      setCookingProgress(previous=>clearRecipeProgress(previous,recipe.id));
      setRecipeEditDrafts({});
    }catch(error){
      const message=error instanceof Error?error.message:"Failed to save recipe changes";
      setRecipeEditError(message);
      console.error("Failed to save recipe changes:",error);
    }finally{
      setSavingRecipeEdits(false);
    }
  };
  const openEditRecipe=(recipe:Recipe)=>beginRecipeEdit(recipe);
  const resetAdd=()=>{setTitle("");setTime("");setUrl("");setIngredients("");setDirections("");setDirectionImages([]);setImageUrl("");setSourceName("");setTag("");setAddMode("url");setImportError("");setImporting(false)};
  const saveRecipe=async()=>{if(!title.trim()){setSaveError("Add a recipe name before saving.");return}setSavingRecipe(true);setSaveError("");const id=crypto.randomUUID();const resolvedImages=await resolveStepImages(directionImages);const newDirections=directions.split("\n").map(x=>x.trim()).filter(Boolean).map((text,index)=>resolvedImages[index]?{text,image:resolvedImages[index]}:text);const recipeIngredients=parsedIngredients();const recipeTitle=title.trim();const newRecipe={id,title:recipeTitle,tag:tag.trim()||inferredRecipeTag(recipeTitle,recipeIngredients.map(ingredient=>ingredient.name)),emoji:"🍽️",time:time.trim()||"Time not provided",serves:4,author:"Family",ingredients:recipeIngredients,directions:newDirections,image:imageUrl||undefined,sourceUrl:url||undefined,sourceName:sourceName||undefined};try{const response=await fetch("/api/recipes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,title:newRecipe.title,tag:newRecipe.tag,emoji:newRecipe.emoji,time:newRecipe.time,serves:newRecipe.serves,author:newRecipe.author,ingredients:newRecipe.ingredients,directions:newRecipe.directions,image:newRecipe.image,source_url:newRecipe.sourceUrl,source_name:newRecipe.sourceName})});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe to database")}const saved=await syncNow();if(saved){setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,selected:[...plan.selected,id],servings:{...plan.servings,[id]:4},checked:plan.selected.length===0?[]:plan.checked}}});resetAdd();setOpen(false);setView("plan")}else{throw new Error("Could not refresh recipes after saving.")}}catch(error){setSaveError(error instanceof Error?error.message:"Failed to save recipe to database");console.error("Failed to save recipe to database:",error)}finally{setSavingRecipe(false)}};
  const importRecipe=async()=>{if(!url.trim())return;setImporting(true);setImportError("");try{const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});const data=await response.json();if(!response.ok)throw new Error(data.error||"We couldn't import that recipe.");const importedDirections=(data.directions||[]) as (string|DirectionStep)[];const importedIngredients=(data.ingredients||[]) as string[];const importedTitle=data.title||"";setTitle(importedTitle);setTime(typeof data.time==="string"?data.time:"");setIngredients(importedIngredients.join("\n"));setDirections(importedDirections.map(directionText).join("\n"));setDirectionImages(importedDirections.map(directionImage));setImageUrl(data.image||"");setSourceName(data.sourceName||"");setTag(typeof data.tag==="string"&&data.tag.trim()?data.tag.trim():inferredRecipeTag(importedTitle,importedIngredients));setAddMode("review")}catch(error){setImportError(error instanceof Error?error.message:"We couldn't import that recipe.")}finally{setImporting(false)}};
  const deleteRecipe=async(id:string)=>{try{const response=await fetch(`/api/recipes/${id}`,{method:"DELETE"});if(!response.ok)throw new Error("Failed to delete recipe");await syncNow();setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>{const nextServings={...plan.servings};const nextChefs={...(plan.chefs||{})};const nextDays={...(plan.days||{})};delete nextServings[id];delete nextChefs[id];delete nextDays[id];return[key,{...plan,selected:plan.selected.filter(recipeId=>recipeId!==id),done:(plan.done||[]).filter(recipeId=>recipeId!==id),servings:nextServings,chefs:nextChefs,days:nextDays}]})));setActiveRecipe(null)}catch(error){console.error("Failed to delete recipe from database:",error)}};
  const toggleShoppingItemSync=async(itemKey:string,shouldCheck:boolean)=>{setChecked(v=>shouldCheck?[...v,itemKey]:v.filter(x=>x!==itemKey));setShoppingItems(items=>items.map(si=>si.ingredient_key===itemKey?{...si,checked:shouldCheck}:si));const shoppingItem=shoppingItems.find(si=>si.ingredient_key===itemKey);if(shoppingItem){try{await toggleShoppingItem(shoppingItem.id,shouldCheck)}catch(error){console.error("Failed to sync shopping item:",error)}}};
  const addGlobalItem=async()=>{
    const text=globalItemText.trim();
    if(!text)return;
    setSavingGlobalItem(true);setGlobalItemError("");
    try{
      const parsed=parseIngredientLine(text);
      const response=await fetch("/api/shopping/global",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ingredient_name:parsed.name,ingredient_amount:parsed.hasQty===false?0:parsed.amount,ingredient_unit:parsed.hasQty===false?"":parsed.unit,ingredient_key:ingredientMatchKey(parsed.name)})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Failed to save global item");
      setGlobalItems(items=>[...items.filter(item=>item.id!==data.id),data].sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name)));
      setGlobalItemText("");
      setGlobalItemEntryOpen(false);
    }catch(error){setGlobalItemError(error instanceof Error?error.message:"Failed to save global item");console.error("Failed to save global shopping item:",error)}
    finally{setSavingGlobalItem(false)}
  };
  const removeGlobalItem=async(item:ShoppingItem)=>{
    try{
      const response=await fetch(`/api/shopping/global?id=${encodeURIComponent(item.id)}`,{method:"DELETE"});
      if(!response.ok)throw new Error("Failed to remove global item");
      setGlobalItems(items=>items.filter(current=>current.id!==item.id));
    }catch(error){setGlobalItemError(error instanceof Error?error.message:"Failed to remove global item");console.error("Failed to remove global shopping item:",error)}
  };
  const toggleGlobalItem=async(item:ShoppingItem)=>{
    const checked=!item.checked;
    setGlobalItems(items=>items.map(current=>current.id===item.id?{...current,checked}:current));
    try{
      const response=await toggleShoppingItem(item.id,checked);
      if(response?.error)throw new Error(response.error);
    }catch(error){
      setGlobalItems(items=>items.map(current=>current.id===item.id?{...current,checked:!checked}:current));
      setGlobalItemError(error instanceof Error?error.message:"Failed to update global item");
      console.error("Failed to sync global shopping item:",error);
    }
  };
  const globalItemPhrase=(item:ShoppingItem)=>formatIngredientPhrase({
    name:item.ingredient_name,
    amount:item.ingredient_amount||1,
    unit:item.ingredient_unit,
    category:"Global",
    hasQty:Boolean(item.ingredient_amount||item.ingredient_unit),
  });

  const nav=[{value:"plan",label:"Plan",icon:ChefHat},{value:"shop",label:"Shop",icon:ShoppingBasket}];
  const changeView=(v:string)=>{if(v!=="recipes"&&v!=="history")setPreRecipesView(v);setView(v)};
  const goAway=(v:string)=>{if(view!=="recipes"&&view!=="history")setPreRecipesView(view);setView(v)};
  const recipePaletteClasses = {
    surface: "bg-[var(--recipe-surface)]",
    control: "bg-[var(--recipe-control)]",
    controlHover: "hover:bg-[var(--recipe-control-hover)]",
    controlHoverLight: "hover:bg-[var(--recipe-control-hover-light)]",
    menu: "bg-white shadow-xl ring-1 ring-black/5",
    menuFocus: "hover:bg-[var(--recipe-control-hover-light)] focus:bg-[var(--recipe-menu-focus)] data-[highlighted]:bg-[var(--recipe-menu-focus)]",
    tag: "bg-[var(--recipe-tag)]",
    tagHover: "hover:bg-[var(--recipe-tag-hover)]",
    doneHover: "hover:bg-[var(--recipe-done-hover)]",
  };
  const recipeCardPaletteFor = (id: string) => {
    return { ...recipePaletteClasses, ...(derivedRecipePalettes[id] || fallbackRecipePaletteFor(id)) };
  };
  const cancelRemoveLongPress=()=>{
    if(removeLongPressTimerRef.current!==null){
      window.clearTimeout(removeLongPressTimerRef.current);
      removeLongPressTimerRef.current=null;
    }
  };
  const activeRecipePalette = recipeCardPaletteFor(activeRecipe?.id || "");
  const recipeGrid=(list:Recipe[])=><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map(r=>{
    const palette=recipeCardPaletteFor(r.id);
    const paletteStyle=recipePaletteStyle(palette);
    const image=recipeImageFor(r);
    return <article key={r.id} onClick={()=>openRecipe(r)} style={paletteStyle} className={`group relative cursor-pointer overflow-hidden rounded-[1.75rem] ${palette.surface} transition hover:-translate-y-1 hover:shadow-lg`}>
      <div className="absolute left-3 top-3 z-10"><TooltipProvider><Tooltip><TooltipTrigger aria-label={selected.includes(r.id)?`Remove ${r.title} from ${weekRange(weekOffset)}`:`Add ${r.title} to ${weekRange(weekOffset)}`} onClick={event=>{event.stopPropagation();toggle(r.id)}} className={`grid size-11 place-items-center rounded-full shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35 sm:size-10 ${selected.includes(r.id)?"bg-[#111613] text-white hover:bg-[#2d3b32]":`${palette.control} ${palette.controlHover} text-[#111613]`}`}>{selected.includes(r.id)?<Check size={20}/>:<Plus size={21}/>}</TooltipTrigger><TooltipContent side="top" sideOffset={6} className="bg-[#151b17] text-white">{selected.includes(r.id)?`Remove from ${weekRange(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}</TooltipContent></Tooltip></TooltipProvider></div>
      <div className="absolute right-3 top-3 z-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <DropdownMenu><DropdownMenuTrigger asChild><button onClick={event=>event.stopPropagation()} aria-label={`More actions for ${r.title}`} className={`grid size-11 place-items-center rounded-full ${palette.control} ${palette.controlHover} text-[#1e2822] shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35 sm:size-10`}><MoreHorizontal size={21}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" style={paletteStyle} className={`min-w-44 border-0 ${palette.menu}`}><DropdownMenuItem className={palette.menuFocus} onClick={event=>{event.stopPropagation();openEditRecipe(r)}}><Pencil/>Edit recipe</DropdownMenuItem><DropdownMenuItem className={palette.menuFocus} variant="destructive" onClick={event=>{event.stopPropagation();setRecipeToDelete(r)}}><Trash2/>Delete recipe</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
      {image ? <img src={image} alt={r.title} className="h-44 w-full object-cover"/> : <div className={`grid h-36 place-items-center ${palette.surface} text-5xl`}>{r.emoji}</div>}
      <div className="min-w-0 p-5"><h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3><div className="mt-2"><RecipeTime time={r.time}/></div><div className="mt-1.5 flex flex-wrap items-center gap-2"><button type="button" onClick={event=>{event.stopPropagation();setTagFilter(recipeTag(r));setQuery("")}} className={`rounded-full ${palette.tag} ${palette.tagHover} px-2 py-1 text-[10px] font-normal uppercase tracking-[.08em] text-[#151b17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35 sm:text-[11px]`}>{recipeTag(r)}</button>{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-[#151b17] underline decoration-[#151b17]/35 underline-offset-2 hover:decoration-[#151b17]" onClick={event=>event.stopPropagation()}>{r.sourceName||"View original recipe"}</a>}</div></div>
    </article>;
  })}</div>;

  const planRecipeGrid=(list:Recipe[])=><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map(r=>{
    const palette=recipeCardPaletteFor(r.id);
    const paletteStyle=recipePaletteStyle(palette);
    const image=recipeImageFor(r);
    return <article
      key={r.id}
      onPointerDown={event=>{
        longPressTriggeredRef.current=false;
        if(event.pointerType!=="touch"||event.target instanceof Element&&event.target.closest("button, a, input, [role='combobox'], [role='checkbox']"))return;
        cancelRemoveLongPress();
        removeLongPressTimerRef.current=window.setTimeout(()=>{
          removeLongPressTimerRef.current=null;
          longPressTriggeredRef.current=true;
          setRevealedRemoveRecipeId(r.id);
        },550);
      }}
      onPointerMove={event=>{if(event.pointerType==="touch")cancelRemoveLongPress()}}
      onPointerUp={cancelRemoveLongPress}
      onPointerCancel={cancelRemoveLongPress}
      onPointerLeave={cancelRemoveLongPress}
      onContextMenu={event=>{
        if(window.matchMedia("(hover: none)").matches&&!(event.target instanceof Element&&event.target.closest("button, a, input, [role='combobox'], [role='checkbox']"))){
          event.preventDefault();
          longPressTriggeredRef.current=true;
          setRevealedRemoveRecipeId(r.id);
        }
      }}
      onClick={event=>{
        if(longPressTriggeredRef.current){
          longPressTriggeredRef.current=false;
          event.preventDefault();
          return;
        }
        setRevealedRemoveRecipeId(null);
        openRecipe(r);
      }}
      style={paletteStyle}
      className={`group relative cursor-pointer overflow-hidden rounded-[1.75rem] ${palette.surface} transition hover:-translate-y-1 hover:shadow-lg`}
    >
      <div style={revealedRemoveRecipeId===r.id?{opacity:1,pointerEvents:"auto"}:undefined} className={`absolute right-3 top-3 z-10 transition-opacity ${revealedRemoveRecipeId===r.id?"pointer-events-auto opacity-100":"pointer-events-auto opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100"}`}><button onClick={event=>{event.stopPropagation();toggle(r.id);setRevealedRemoveRecipeId(null)}} aria-label={`Remove ${r.title} from ${weekOffset===0?"this week":"next week"}`} className={`grid size-11 place-items-center rounded-full ${palette.control} ${palette.controlHover} text-[#1e2822] shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35 sm:size-10`}><X size={20}/></button></div>
      {image ? <img src={image} alt={r.title} className="h-44 w-full object-cover"/> : <div className={`grid h-36 place-items-center ${palette.surface} text-5xl`}>{r.emoji}</div>}
      <div className="min-w-0 p-5">
        <h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3>
        <div className="mt-2"><RecipeTime time={r.time}/></div>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2" onClick={event=>event.stopPropagation()}>
        <Select value={days[r.id]||"none"} onValueChange={value=>{const day=value==="none"?"":value;setDay(r.id,day);setCommittedDays(previous=>({...previous,[r.id]:day}))}}>
          <SelectTrigger aria-label={`Day for ${r.title}`} className="h-11 w-full rounded-full border-0 bg-white text-sm font-normal text-[#111613] shadow-none hover:bg-white focus-visible:border-[#111613] focus-visible:ring-[#111613]/20 [&_svg]:!text-[#111613] [&_svg]:!opacity-100"><SelectValue placeholder="Add day"/></SelectTrigger>
          <SelectContent position="popper" side="top" sideOffset={6} align="start" style={paletteStyle} className={`z-50 max-h-none overflow-visible rounded-xl border-0 bg-white p-1 shadow-xl ring-1 ring-black/5`}><SelectItem value="none" className={palette.menuFocus}>Add day</SelectItem>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day=><SelectItem key={day} value={day} className={palette.menuFocus}>{day}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chefs[r.id]||"none"} onValueChange={value=>setChef(r.id,value==="none"?"":value)}>
          <SelectTrigger aria-label={`Chef cooking ${r.title}`} className="h-11 w-full rounded-full border-0 bg-white text-sm font-normal text-[#111613] shadow-none hover:bg-white focus-visible:border-[#111613] focus-visible:ring-[#111613]/20 [&_svg]:!text-[#111613] [&_svg]:!opacity-100"><SelectValue placeholder="Add chef name"/></SelectTrigger>
          <SelectContent position="popper" side="top" sideOffset={6} align="end" style={paletteStyle} className="z-50 max-h-none overflow-visible rounded-xl border-0 bg-white p-1 shadow-xl ring-1 ring-black/5"><SelectItem value="none" className={palette.menuFocus}>Add chef name</SelectItem>{["Rory","Maria","Emma","Maya"].map(chef=><SelectItem key={chef} value={chef} className={palette.menuFocus}>{chef}</SelectItem>)}</SelectContent>
        </Select>
        </div>
        <button type="button" role="checkbox" aria-checked={done.includes(r.id)} aria-label={done.includes(r.id)?`Reopen ${r.title}`:`Mark ${r.title} as made`} onClick={event=>{event.stopPropagation();toggleDinnerDone(r.id)}} className={`meal-done-control mt-3 -ml-2 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-3 rounded-full pl-2 text-left text-sm font-normal text-[#151b17] transition-colors ${palette.doneHover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35`}><CheckboxIndicator checked={done.includes(r.id)} backgroundColor="#ffffff" checkedBackgroundColor={palette.checkboxChecked} borderless/>{done.includes(r.id)?"Made":"Mark as made"}</button>
      </div>
    </article>;
  })}</div>;

  const fieldControlClass="min-h-12 rounded-xl border-[#d2e0c1] bg-white px-4 py-3 text-base text-[#151b17] shadow-none placeholder:text-[#707b76] focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15";
  const editFieldClass=`mt-2 ${fieldControlClass}`;
  const editAreaClass="mt-2 min-h-40 rounded-xl border-[#d2e0c1] bg-white px-4 py-3 text-base leading-relaxed text-[#151b17] shadow-none placeholder:text-[#707b76] focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15";
  const recipeIsEditing=Boolean(recipeEditDrafts.details||recipeEditDrafts.ingredients!==undefined||recipeEditDrafts.directions);

  if(open) {
    const fieldClass="mt-2 min-h-14 rounded-xl border-[#d2e0c1] bg-white px-4 py-3 text-base text-[#151b17] shadow-none placeholder:text-[#707b76] focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15";
    const textAreaClass="mt-2 min-h-40 rounded-xl border-[#d2e0c1] bg-white px-4 py-3 text-base leading-relaxed text-[#151b17] shadow-none placeholder:text-[#707b76] focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15";
    return <main className="min-h-screen bg-white text-[#151b17]" style={{scrollbarGutter:"stable"}}>
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Button type="button" onClick={()=>{setOpen(false);resetAdd()}} className="h-12 rounded-xl border-0 bg-[#111613] px-4 text-white hover:bg-[#2d3b32] hover:text-white"><ArrowLeft size={18}/>Back</Button>
          <span className="text-right text-xs font-bold uppercase tracking-[.16em] text-[#68766f]"><span className="sm:hidden">Cameron</span><span className="hidden sm:inline">Cameron Family Table</span></span>
        </div>
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-[#111613]">New recipe</p>
          <h1 className="mt-2 font-sans text-4xl font-bold leading-tight sm:text-5xl">Add a recipe to the table</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#65716b]">{addMode==="url"?"Start with a recipe link, or enter a family favorite yourself.":addMode==="review"?"Check the imported details, then make any changes before saving.":"Tell us about the recipe using the roomy fields below."}</p>
        </div>
        {addMode==="url"&&<section className="rounded-3xl border border-[#d6d6d6] bg-[#ffffff] p-5 shadow-[0_4px_20px_rgba(45,61,50,.05)] sm:p-8">
          <label className="block text-base font-bold text-[#111613]">Recipe link</label>
          <p className="mt-1 text-sm text-[#65716b]">We’ll try to bring in the title, ingredients, directions, and image.</p>
          <Input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/favorite-recipe" aria-label="Recipe URL" className={fieldClass}/>
          <Button type="button" className="mt-5 h-14 w-full rounded-xl bg-[#151b17] text-base font-bold text-white hover:bg-[#2d3b32]" disabled={!url.trim()||importing} onClick={importRecipe}>{importing?"Importing recipe…":"Import recipe"}</Button>
          {importError&&<p role="alert" className="mt-4 rounded-xl bg-[#fff0e8] p-4 text-sm leading-relaxed text-[#963f32]">{importError}</p>}
          <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-[#d6d6d6]"/><span className="text-sm text-[#68736c]">or</span><span className="h-px flex-1 bg-[#d6d6d6]"/></div>
          <Button type="button" variant="outline" className="h-14 w-full rounded-xl border-[#cfdfa9] bg-white text-base font-bold text-[#151b17] hover:bg-[#eff8dd]" onClick={()=>setAddMode("manual")}>Enter recipe manually</Button>
        </section>}
        {(addMode==="review"||addMode==="manual")&&<section className="space-y-6 rounded-3xl border border-[#d6d6d6] bg-[#ffffff] p-5 shadow-[0_4px_20px_rgba(45,61,50,.05)] sm:p-8">
          {imageUrl&&<img src={imageUrl} alt="Recipe preview" className="h-48 w-full rounded-2xl object-cover sm:h-64"/>}
          <div><label className="block text-base font-bold text-[#111613]">Recipe name <span className="font-normal text-[#963f32]">*</span></label><Input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Sunday tomato sauce" aria-required="true" className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#111613]">Total time <span className="font-normal text-[#65716b]">(optional)</span></label><Input value={time} onChange={e=>setTime(e.target.value)} placeholder="e.g. 45 minutes" className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#111613]">Cuisine tag <span className="font-normal text-[#65716b]">(optional)</span></label><p className="mt-1 text-sm text-[#65716b]">Leave blank to infer a cuisine from the recipe title and ingredients.</p><Input value={tag} onChange={e=>setTag(e.target.value)} placeholder="e.g. American, Asian, Italian" className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#111613]">Image URL <span className="font-normal text-[#65716b]">(optional)</span></label><Input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#111613]">Ingredients</label><p className="mt-1 text-sm text-[#65716b]">Add one ingredient per line.</p><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder={"2 apples\n1 cup flour\nA pinch of salt"} rows={7} className={textAreaClass}/></div>
          <div><label className="block text-base font-bold text-[#111613]">Directions</label><p className="mt-1 text-sm text-[#65716b]">Add one step per line. You can add an image URL to any step.</p><Textarea value={directions} onChange={e=>setDirections(e.target.value)} placeholder={"Heat oven to 375°F\nMix ingredients\nBake until golden"} rows={7} className={textAreaClass}/><div className="mt-4 space-y-3">{directions.split("\n").map((step,index)=>step.trim()?<div key={index} className="rounded-xl border border-[#e0ead1] bg-[#f3f8e9] p-3"><p className="text-sm font-semibold text-[#151b17]">Step {index+1}: {step.trim()}</p><Input value={directionImages[index]||""} onChange={event=>setDirectionImages(previous=>{const next=[...previous];next[index]=event.target.value;return next})} placeholder="Step image URL (optional)" aria-label={`Image URL for step ${index+1}`} className="mt-2 min-h-12 border-[#d2e0c1] bg-white text-sm shadow-none focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15"/></div>:null)}</div></div>
          {addMode==="review"&&<p className="rounded-xl bg-[#eff8dd] p-4 text-sm leading-relaxed text-[#151b17]">Everything is editable before you save it.</p>}
          {saveError&&<p role="alert" className="rounded-xl bg-[#fff0e8] p-4 text-sm leading-relaxed text-[#963f32]">{saveError}</p>}
          <Button type="button" className="h-14 w-full rounded-xl bg-[#151b17] text-base font-bold text-white hover:bg-[#2d3b32]" disabled={savingRecipe} onClick={saveRecipe}>{savingRecipe?"Saving…":`Save and add to ${weekRange(weekOffset)}`}</Button>
          <Button type="button" variant="ghost" className="h-12 w-full rounded-xl text-base font-semibold text-[#151b17] hover:bg-[#eff8dd] hover:text-[#111613]" onClick={()=>setAddMode("url")}>{addMode==="review"?"Use a different link":"Back to recipe link"}</Button>
        </section>}
      </div>
    </main>;
  }

  return <main className="min-h-screen bg-white text-[#151b17]" style={{scrollbarGutter:'stable'}}>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {mockRecipePreview&&<p role="status" className="mb-4 rounded-xl border border-[#d2e0c1] bg-[#eff8dd] px-4 py-3 text-sm text-[#151b17]">Sample recipe preview. Changes are temporary and won&apos;t be saved.</p>}
      {activeRecipe ? <article style={recipePaletteStyle(activeRecipePalette)}>
        <div className="mb-5 flex items-center justify-between gap-2 pt-4 sm:pt-3">
          <BackButton onClick={()=>setActiveRecipe(null)} disabled={recipeIsEditing||savingRecipeEdits}/>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={()=>toggle(activeRecipe.id)} variant="outline" size="icon" className="shrink-0 rounded-lg border border-[#d6d6d6] bg-white text-[#111613] font-normal transition-colors hover:border-[#d6f59a] hover:bg-[#d6f59a] sm:h-9 sm:w-auto sm:px-4" aria-label={selected.includes(activeRecipe.id)?`Added to ${weekStartLabel(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}>{selected.includes(activeRecipe.id)?<Check size={18}/>:<Plus size={18}/>}<span className="hidden sm:inline">{selected.includes(activeRecipe.id)?`Added to ${weekStartLabel(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}</span></Button>
            {recipeIsEditing
              ? <>
                  <Button type="button" className="h-11 w-11 shrink-0 rounded-lg bg-[#111613] p-0 text-white hover:bg-[#2d3b32] sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3" aria-label="Save recipe changes" disabled={savingRecipeEdits} onClick={saveRecipeEdits}><Save size={18}/><span className="sr-only sm:not-sr-only">{savingRecipeEdits?"Saving…":"Save"}</span></Button>
                  <Button type="button" variant="outline" className="h-11 w-11 shrink-0 rounded-lg border border-[#d6d6d6] p-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3" aria-label="Cancel recipe changes" disabled={savingRecipeEdits} onClick={cancelRecipeEdit}><X size={18}/><span className="sr-only sm:not-sr-only">Cancel</span></Button>
                </>
              : <Button variant="outline" size="icon" className="shrink-0 rounded-lg border border-[#d6d6d6] bg-white text-[#111613] font-normal transition-colors hover:border-[#d6f59a] hover:bg-[#d6f59a] sm:h-9 sm:w-auto sm:px-3" onClick={()=>openEditRecipe(activeRecipe)} aria-label="Edit"><Pencil size={18}/><span className="hidden sm:inline">Edit</span></Button>}
            <Button variant="outline" size="icon" className="shrink-0 rounded-lg border border-[#d6d6d6] bg-white text-[#111613] transition-colors hover:border-[#d6f59a] hover:bg-[#d6f59a] sm:h-9 sm:w-auto sm:px-3" onClick={()=>setRecipeToDelete(activeRecipe)} aria-label="Delete recipe" disabled={recipeIsEditing||savingRecipeEdits}><Trash2 size={18}/></Button>
          </div>
        </div>
        {recipeEditError&&<p role="alert" className="mb-5 rounded-xl bg-[#fff0e8] p-4 text-sm text-[#963f32]">{recipeEditError}</p>}
        <div className="rounded-[1.75rem] border border-[#d6d6d6] bg-white">
          {(activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")} alt={activeRecipe.title} className="h-64 w-full rounded-t-[1.75rem] object-cover sm:h-80 lg:h-[28rem]"/> : <div className="grid h-56 place-items-center rounded-t-[1.75rem] bg-[#eaf7d0] text-8xl">{activeRecipe.emoji}</div>}
          <div className="p-6 sm:p-9 lg:p-12">
            <div className="border-b border-[#d6d6d6] pb-8">
              {recipeEditDrafts.details
                ? <section aria-label="Edit recipe details" className="space-y-4">
                    <h3 className="font-sans text-2xl font-bold">Recipe details</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-bold sm:col-span-2">Recipe name<Input value={recipeEditDrafts.details.title} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,title:event.target.value}}:previous)} className={editFieldClass}/></label>
                      <label className="block text-sm font-bold">Total time<Input value={recipeEditDrafts.details.time} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,time:event.target.value}}:previous)} placeholder="e.g. 45 minutes" className={editFieldClass}/></label>
                      <label className="block text-sm font-bold">Recipe tag<Input value={recipeEditDrafts.details.tag} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,tag:event.target.value}}:previous)} placeholder="Family recipe" className={editFieldClass}/></label>
                      <label className="block text-sm font-bold">Photo URL<Input value={recipeEditDrafts.details.image} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,image:event.target.value}}:previous)} placeholder="https://example.com/photo.jpg" className={editFieldClass}/></label>
                      <label className="block text-sm font-bold">Recipe link<Input type="url" value={recipeEditDrafts.details.sourceUrl} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,sourceUrl:event.target.value}}:previous)} placeholder="https://example.com/recipe" className={editFieldClass}/></label>
                      <label className="block text-sm font-bold">Source name<Input value={recipeEditDrafts.details.sourceName} onChange={event=>setRecipeEditDrafts(previous=>previous.details?{...previous,details:{...previous.details,sourceName:event.target.value}}:previous)} placeholder="Recipe website or family member" className={editFieldClass}/></label>
                    </div>
                  </section>
                : <>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.2em]"><span className={`rounded-full ${recipeCardPaletteFor(activeRecipe.id).tag} px-2 py-1 text-[10px] font-normal uppercase tracking-[.08em] text-[#111613] sm:text-[11px]`}>{recipeTag(activeRecipe)}</span>{activeRecipe.sourceUrl&&<a href={activeRecipe.sourceUrl} target="_blank" rel="noreferrer" className="text-[#151b17] underline decoration-[#151b17]/40 underline-offset-2 hover:decoration-[#151b17]">{activeRecipe.sourceName||"View original recipe"}</a>}</div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-serif text-3xl font-bold leading-tight sm:text-5xl">{activeRecipe.title}</h2>
                          <div className="mt-2"><RecipeTime time={activeRecipe.time}/></div>
                        </div>
                      </div>
                      <div className={`flex max-w-md shrink-0 items-center justify-between gap-3 rounded-full ${activeRecipePalette.control} p-3 pl-6`}><span className="font-medium">Cooking for</span><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className={`size-11 cursor-pointer rounded-full ${activeRecipePalette.controlHover} sm:size-8`} onClick={()=>changeServings(activeRecipe.id,-1)}><Minus size={17} className="sm:hidden"/><Minus size={15} className="hidden sm:block"/></Button><strong className="min-w-20 text-center">{servings[activeRecipe.id]||4} people</strong><Button size="icon" variant="ghost" className={`size-11 cursor-pointer rounded-full ${activeRecipePalette.controlHover} sm:size-8`} onClick={()=>changeServings(activeRecipe.id,1)}><Plus size={17} className="sm:hidden"/><Plus size={15} className="hidden sm:block"/></Button></div></div>
                    </div>
                  </>}
            </div>

            <div className="mt-10">
              <div className="sticky top-0 z-30 -mx-6 bg-white/95 px-6 py-2 backdrop-blur sm:-mx-9 sm:px-9 lg:-mx-12 lg:px-12">
              <div className={`relative grid grid-cols-2 rounded-full p-px ${activeRecipePalette.control}`} role="tablist" aria-label="Recipe details">
                <span aria-hidden="true" className={`pivot-tab-indicator absolute inset-y-px left-px w-[calc(50%-1px)] rounded-full ${activeRecipePalette.tag} ${recipeTab==="directions"?"translate-x-full":"translate-x-0"}`}/>
                <button type="button" id="recipe-ingredients-tab" role="tab" aria-controls="recipe-ingredients-panel" aria-selected={recipeTab==="ingredients"} onClick={()=>setRecipeTab("ingredients")} className={`relative z-10 rounded-full px-4 py-3 text-sm font-bold transition-colors ${recipeTab==="ingredients"?"text-[#151b17]":"text-[var(--recipe-time)] hover:text-black"}`}>Ingredients</button>
                <button type="button" id="recipe-directions-tab" role="tab" aria-controls="recipe-directions-panel" aria-selected={recipeTab==="directions"} onClick={()=>setRecipeTab("directions")} className={`relative z-10 rounded-full px-4 py-3 text-sm font-bold transition-colors ${recipeTab==="directions"?"text-[#151b17]":"text-[var(--recipe-time)] hover:text-black"}`}>Directions</button>
              </div>
              </div>
              {recipeTab==="ingredients"
                ? <section id="recipe-ingredients-panel" role="tabpanel" aria-labelledby="recipe-ingredients-tab" tabIndex={0} className="recipe-tab-panel--ingredients min-w-0">
                    <div id="ingredients-list">
                      {recipeEditDrafts.ingredients!==undefined
                        ? <div><label className="block text-sm font-bold">Ingredients <span className="font-normal text-[#65716b]">· one per line</span><Textarea value={recipeEditDrafts.ingredients} onChange={event=>setRecipeEditDrafts(previous=>previous.ingredients===undefined?previous:{...previous,ingredients:event.target.value})} rows={10} className={editAreaClass}/></label></div>
                        : <div className="space-y-5">
                            {(["To use","Used"] as const).map((heading,index)=>{
                              const sectionKey=index===0?"toUse":"used";
                              const isCollapsed=ingredientSectionsCollapsed[sectionKey];
                              const items=(Array.isArray(activeRecipe.ingredients)?activeRecipe.ingredients:[])
                                .map((raw,itemIndex)=>({item:normalizeIngredient(raw),index:itemIndex}))
                                .filter(({item,index:itemIndex})=>item&&(index===0?!checkedIngredients.includes(itemIndex):checkedIngredients.includes(itemIndex)));
                              return <section key={heading} className="overflow-hidden">
                                <button type="button" onClick={()=>setIngredientSectionsCollapsed(previous=>({...previous,[sectionKey]:!previous[sectionKey]}))} aria-expanded={!isCollapsed} className="flex w-full cursor-pointer items-center justify-between rounded-full px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35">
                                  <span className="flex items-center gap-2 font-sans text-2xl font-bold text-[var(--recipe-time)]">{heading}<span className="text-sm font-sans font-medium text-[#707b76]">({items.length})</span></span>
                                  <span className="grid size-8 place-items-center text-[#151b17]" aria-hidden="true">{isCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span>
                                </button>
                                {!isCollapsed&&<div className="space-y-1">
                                  {items.map(({item,index:itemIndex})=>{
                                    if(!item)return null;
                                    const amount=item.amount*(servings[activeRecipe.id]||4)/(activeRecipe.serves||4);
                                    const phrase=formatIngredientPhrase(item,amount);
                                    const done=checkedIngredients.includes(itemIndex);
                                    return <label key={itemIndex} className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-3xl px-3 py-3 text-xl leading-relaxed transition sm:text-base ${done?"text-[#707b76] line-through":`text-[#151b17] ${activeRecipePalette.controlHoverLight}`}`}>
                                      <Checkbox className="size-6 shrink-0" checked={done} onCheckedChange={()=>toggleIngredientDone(activeRecipe.id,itemIndex)} style={{backgroundColor:done?activeRecipePalette.checkboxChecked:"#ffffff",borderColor:done?activeRecipePalette.checkboxChecked:"#b5b5b5"}} aria-label={`${done?"Uncheck":"Check off"} ${phrase}`}/>
                                      <span className="min-w-0 flex-1">{phrase}</span>
                                    </label>;
                                  })}
                                  {!items.length&&<p className="rounded-full border border-dashed border-[#d6d6d6] px-4 py-5 text-center text-sm text-[#6b7280]">{index===0?"Everything is marked used.":"Used ingredients will appear here."}</p>}
                                </div>}
                              </section>;
                            })}
                          </div>}
                    </div>
                  </section>
                : <section id="recipe-directions-panel" role="tabpanel" aria-labelledby="recipe-directions-tab" tabIndex={0} className="recipe-tab-panel--directions min-w-0">
                    <h3 className="font-sans text-2xl font-bold">Directions</h3>
                    {recipeEditDrafts.directions
                      ? <div className="mt-4">
                          <div className="space-y-4">{recipeEditDrafts.directions.steps.map((step,index)=><div key={index} className="rounded-2xl border border-[#d6d6d6] bg-[#f7fafb] p-4">
                            <div className="flex items-start gap-3"><label className="min-w-0 flex-1 text-sm font-bold">Step {index+1}<Textarea value={step.text} onChange={event=>updateDirectionDraft(index,"text",event.target.value)} rows={3} className="mt-2 min-h-24 rounded-xl border-[#d2e0c1] bg-white px-4 py-3 text-base leading-relaxed text-[#151b17] shadow-none focus-visible:border-[#111613] focus-visible:ring-4 focus-visible:ring-[#111613]/15"/></label><Button type="button" variant="outline" size="icon" className="mt-6 size-11 shrink-0 rounded-xl border-[#d6d6d6]" aria-label={`Remove step ${index+1}`} onClick={()=>removeDirectionDraftStep(index)}><X size={18}/></Button></div>
                            <label className="mt-3 block text-sm font-bold">Step {index+1} image URL <span className="font-normal text-[#65716b]">(optional)</span><Input value={step.image} onChange={event=>updateDirectionDraft(index,"image",event.target.value)} placeholder="https://example.com/step-photo.jpg" className={editFieldClass}/></label>
                          </div>)}</div>
                          <Button type="button" variant="outline" className="mt-4 min-h-11 rounded-xl border-[#d6d6d6] px-4" onClick={addDirectionDraftStep}><Plus size={18}/>Add step</Button>
                        </div>
                      : activeRecipe.directions?.length?<>
                          <ol className="mt-5 space-y-2">
                            {activeRecipe.directions.map((step,index)=>{
                              const done=completedSteps.includes(index);
                              const text=directionText(step);
                              const image=directionImage(step);
                              const stepStyle: CSSProperties = done
                                ? {backgroundColor:activeRecipePalette.controlColor,borderColor:activeRecipePalette.checkboxChecked}
                                : {};
                              return (
                                <li key={index}>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={done}
                                    aria-label={`Step ${index+1}: ${text}`}
                                    onClick={()=>toggleStepDone(index)}
                                    style={stepStyle}
                                    className={`flex w-full min-w-0 flex-wrap items-start gap-3 rounded-3xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35 ${done ? "" : "border-[#d6d6d6] bg-white"} ${done ? "" : activeRecipePalette.controlHoverLight}`}
                                  >
                                    <CheckboxIndicator checked={done} checkedBackgroundColor={activeRecipePalette.checkboxChecked} borderColor={done?activeRecipePalette.checkboxChecked:"#b5b5b5"} className="mt-1"/>
                                    <span className="min-w-0 flex-1">
                                      <p className={`text-lg leading-relaxed sm:text-base ${done?"truncate text-[#68766f] line-through":"text-[#151b17]"}`}>{text}</p>
                                      {image&&!done&&<img src={image} alt="" className="mt-3 max-h-72 w-full rounded-xl object-cover"/>}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                          {completedSteps.length===activeRecipe.directions.length&&<div className="mt-6 rounded-2xl border p-5 text-center" style={{borderColor:activeRecipePalette.checkboxChecked,backgroundColor:activeRecipePalette.controlColor}}><Check className="mx-auto mb-2 text-[#111613]"/><p className="font-semibold text-[#111613]">All steps done — enjoy!</p></div>}
                        </>:<p className="mt-4 rounded-xl bg-[#edf3f6] p-4 text-center text-sm text-[#6b7280]">Directions weren’t included with this saved recipe. Re-import it from its recipe page to add them.</p>}
                  </section>}
            </div>
          </div>
        </div>
      </article> : <><Tabs value={view} onValueChange={changeView}>
      {view!=="recipes"&&<header ref={sharedHeaderRef} style={{top:`${stickyHeaderTop}px`}} className="sticky z-40 -mx-4 -mt-6 mb-3 overflow-hidden rounded-none sm:mx-0 sm:mt-0 sm:rounded-[1.75rem]">
        <div className="absolute inset-0" aria-hidden="true">{headerImages.map((src,i)=><img key={src+i} src={src} alt="" className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${i===headerImageIndex?"opacity-100":"opacity-0"}`}/>)}</div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#111613]/70 via-[#111613]/55 to-[#111613]/35" aria-hidden="true"/>
        <div className="relative flex flex-col gap-4 px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div className="pr-36 sm:pr-40 lg:pr-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#eaf7d0]"><span className="sm:hidden">Cameron</span><span className="hidden sm:inline">Cameron Family Table</span></p>
            <h2 className="mt-1 min-h-[5.625rem] font-serif text-2xl font-medium leading-tight transition-opacity duration-500 sm:min-h-[7.03125rem] sm:text-3xl lg:min-h-[8.4375rem] lg:text-4xl">{headerTagline}</h2>
          </div>
          <Button type="button" onClick={()=>goAway("recipes")} className="absolute right-4 top-4 z-10 flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-full border-0 bg-[#d6f59a] p-0 text-sm font-normal text-[#111613] shadow-md transition-[transform,box-shadow,background-color] hover:-translate-y-1 hover:bg-[#c9ef78] hover:shadow-xl focus-visible:-translate-y-1 focus-visible:shadow-xl active:translate-y-0 sm:size-32 sm:gap-1.5"><BookOpen strokeWidth={1.5} className="size-9 sm:hidden"/><BookOpen strokeWidth={1.5} className="hidden size-11 sm:block"/><span>Recipes</span></Button>
        </div>
        <div ref={sharedControlsRef} className="relative flex items-stretch gap-2 px-5 py-3 sm:px-8">
          <Select
            value={view==="history"?"history":String(weekOffset)}
            onValueChange={value=>{if(value==="history"){goAway("history")}else{setWeekOffset(Number(value) as 0|1);if(view==="history")setView(preRecipesView)}}}
          >
            <SelectTrigger aria-label="Choose planning week" className="data-[size=default]:h-11 min-w-0 shrink rounded-full border-0 bg-[#d6f59a] px-3 text-sm font-normal text-[#111613] shadow-none hover:bg-[#c9ef78] [&_svg]:!text-[#111613] sm:shrink-0">
              {view==="history"
                ? <HistoryIcon size={16} className="hidden shrink-0 text-white sm:block"/>
                : <CalendarDays size={16} className="hidden shrink-0 text-white sm:block"/>}
              <SelectValue className="truncate">
                {view==="history"
                  ? "History"
                  : <><span className="sm:hidden">{weekLabelShort}</span><span className="hidden sm:inline">{weekLabel}</span></>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} align="start" className="min-w-56 rounded-xl border-0 bg-white p-2 shadow-lg">
              {[0,1].map(offset=><SelectItem key={offset} value={String(offset)} className="rounded-lg py-2.5 pl-3 text-base">{offset===0?"This week":"Next week"} · {weekRange(offset as 0|1)}</SelectItem>)}
              <SelectItem value="history" className="rounded-lg py-2.5 pl-3 text-base">History</SelectItem>
            </SelectContent>
          </Select>
          <TabsList className="relative flex !h-11 flex-none items-stretch gap-0 overflow-hidden rounded-full border-0 bg-white/15 p-0 shadow-none backdrop-blur-sm">
            {(view==="plan"||view==="shop")&&<span aria-hidden="true" className={`pivot-tab-indicator absolute inset-y-0 left-0 w-1/2 rounded-full bg-[#d6f59a] ${view==="shop"?"translate-x-full":"translate-x-0"}`}/>}
            {nav.map(({value,label,icon:Icon})=><TabsTrigger key={value} value={value} className="group relative z-10 flex h-full min-w-[82px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-transparent px-4 py-0 text-xs font-normal text-white/80 shadow-none transition-colors hover:text-white data-[state=active]:bg-transparent data-[state=active]:text-[#111613] data-[state=active]:shadow-none data-[state=active]:hover:text-[#111613] sm:min-w-[104px] sm:px-5 sm:text-sm"><Icon size={16} className="hidden shrink-0 sm:block"/><span>{label}</span>{value==="plan"&&selected.length>0&&<b className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-normal leading-none text-white group-data-[state=active]:bg-[#111613]/10 group-data-[state=active]:text-[#111613]">{selected.length}</b>}</TabsTrigger>)}
          </TabsList>
        </div>
      </header>}
        {view==="recipes"
          ? <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 bg-white/95 px-4 pb-2 pt-4 shadow-[0_8px_18px_-16px_rgba(17,22,19,.75)] backdrop-blur sm:-mx-6 sm:px-6 sm:pt-3">
              <BackButton onClick={()=>setView(preRecipesView)}/>
              <div className="flex items-center gap-2">
                <Button onClick={()=>{resetAdd();setOpen(true)}} variant="outline" aria-label="Add a recipe" className="h-12 shrink-0 rounded-xl border-[#d6d6d6] bg-white px-4 text-sm font-semibold text-[#151b17] shadow-none transition-colors hover:border-[#d6d6d6] hover:bg-[#111613] hover:text-white sm:h-9"><Plus size={18}/>Add recipe</Button>
                {searchOpen
                  ? <div className="relative flex min-w-0 flex-1 items-center sm:w-56 sm:flex-none">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#38453e]" size={17}/>
                      <Input autoFocus className="h-11 w-full rounded-lg border-[#d6d6d6] bg-white pl-9 pr-9 shadow-none sm:h-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or cuisine" onBlur={()=>{if(!query)setSearchOpen(false)}}/>
                      <button type="button" aria-label="Close search" onClick={()=>{setQuery("");setSearchOpen(false)}} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#65716b] hover:bg-[#f0ede4]"><X size={16}/></button>
                    </div>
                  : <Button type="button" variant="outline" aria-label="Search recipes" onClick={()=>setSearchOpen(true)} className="size-11 shrink-0 rounded-lg border-[#d6d6d6] bg-white p-0 text-[#151b17] shadow-none transition-colors hover:border-[#d6d6d6] hover:bg-[#111613] hover:text-white sm:size-9"><Search size={18}/></Button>
                }
              </div>
            </div>
          : null}
        {view==="recipes"&&tagFilter&&<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#d2e0c1] bg-[#eff8dd] px-4 py-3 text-sm text-[#151b17]"><span>Showing <strong>{tagFilter}</strong> recipes</span><button type="button" onClick={()=>setTagFilter("")} className="font-bold underline underline-offset-2">Show all</button></div>}


        <TabsContent value="recipes">
          {recipeGrid(recipes.filter(r=>recipeMatchesQuery(r,query,tagFilter)))}
        </TabsContent>

        <TabsContent value="plan">{planPicking
          ? <div>
              <div className="mb-4 flex items-center gap-2">
                <BackButton onClick={()=>{setPlanPicking(false);setPlanQuery("");setPlanSearchOpen(false)}}/>
                <div className="flex-1"/>
                {planSearchOpen
                  ? <div className="relative flex min-w-0 flex-1 items-center sm:w-56 sm:flex-none">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#38453e]" size={17}/>
                      <Input autoFocus className="h-11 w-full rounded-lg border-[#d6d6d6] bg-white pl-9 pr-9 shadow-none sm:h-9" value={planQuery} onChange={e=>setPlanQuery(e.target.value)} placeholder="Search by name or cuisine" onBlur={()=>{if(!planQuery)setPlanSearchOpen(false)}}/>
                      <button type="button" aria-label="Close search" onClick={()=>{setPlanQuery("");setPlanSearchOpen(false)}} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#65716b] hover:bg-[#f0ede4]"><X size={16}/></button>
                    </div>
                  : <Button type="button" variant="outline" aria-label="Search recipes" onClick={()=>setPlanSearchOpen(true)} className="size-11 shrink-0 rounded-lg border-[#d6d6d6] bg-white p-0 text-[#151b17] shadow-none transition-colors hover:border-[#d6d6d6] hover:bg-[#111613] hover:text-white sm:size-9"><Search size={18}/></Button>
                }
              </div>
              {recipeGrid(recipes.filter(r=>recipeMatchesQuery(r,planQuery,"")))}
            </div>
          : <div>{planErrors[activeWeekKey]&&<p role="alert" className="mb-4 rounded-xl bg-[#fff0e8] p-4 text-sm text-[#963f32]">Could not save this week&apos;s dinners: {planErrors[activeWeekKey]}</p>}{selected.length>0&&<><section aria-label="Dinners to make"><h2 className="mb-4 font-sans text-2xl font-bold text-[#111613]">To make <span className="font-sans text-base font-medium text-[#68766f]">({dinnersToMake.length})</span></h2>{dinnersToMake.length?planRecipeGrid(dinnersToMake):<p className="rounded-2xl border border-dashed border-[#d6d6d6] p-5 text-center text-sm text-[#6b7280]">All planned dinners are done.</p>}</section><Button type="button" variant="outline" onClick={()=>setPlanPicking(true)} className="mt-4 w-full rounded-2xl border-dashed border-[#d2e0c1] bg-transparent py-6 text-[#151b17] font-normal shadow-none hover:border-[#d6f59a] hover:bg-[#d6f59a] hover:text-[#111613]"><Plus size={18}/>Add another recipe</Button>{dinnersDone.length>0&&<section aria-label="Done dinners" className="mt-9"><h2 className="mb-4"><button type="button" aria-expanded={!doneCollapsed} onClick={()=>setDoneCollapsed(v=>!v)} className="flex min-h-11 w-full items-center gap-2 rounded-lg text-left font-sans text-2xl font-bold text-[#111613] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35"><ChevronDown size={22} className={`shrink-0 transition-transform ${doneCollapsed?"-rotate-90":""}`}/>Done <span className="font-sans text-base font-medium text-[#68766f]">({dinnersDone.length})</span></button></h2>{!doneCollapsed&&planRecipeGrid(dinnersDone)}</section>}</>}{selected.length===0&&<div role="button" tabIndex={0} onClick={()=>setPlanPicking(true)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPlanPicking(true)}}} className="cursor-pointer rounded-3xl border border-dashed border-[#d6d6d6] bg-transparent p-10 text-center transition hover:border-[#bdbdbd] hover:bg-[#f1f8e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35"><ChefHat className="mx-auto mb-3 text-[#6b7280]"/><p className="font-normal text-[#6b7280]">Choose recipes to plan {weekOffset===0?"this week":"next week"}.</p></div>}</div>}</TabsContent>

        <TabsContent value="shop">
          <div className="sticky top-[69px] z-30 -mx-4 mb-6 bg-white/95 px-4 py-2 backdrop-blur">
            <div className="relative grid w-full grid-cols-2 rounded-full bg-[#f2f2f2] p-px" role="tablist" aria-label="Shopping list source">
              <span aria-hidden="true" className={`pivot-tab-indicator absolute inset-y-px left-px w-[calc(50%-1px)] rounded-full bg-[#111613] ${shopTab==="global"?"translate-x-full":"translate-x-0"}`}/>
              <button type="button" role="tab" aria-selected={shopTab==="meals"} onClick={()=>setShopTab("meals")} className={`relative z-10 rounded-full px-4 py-3 text-sm font-bold transition-colors ${shopTab==="meals"?"text-white":"text-[#65716b] hover:text-[#111613]"}`}>From meals</button>
              <button type="button" role="tab" aria-selected={shopTab==="global"} onClick={()=>setShopTab("global")} className={`relative z-10 rounded-full px-4 py-3 text-sm font-bold transition-colors ${shopTab==="global"?"text-white":"text-[#65716b] hover:text-[#111613]"}`}>Global</button>
            </div>
          </div>
          {shopTab==="meals" ? (grocery.length?
            <div className="min-w-0">
              {/* Balanced columns implemented in JS to ensure top-aligned cards */}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-4">
                {categoryColumns.map((col,ci)=> (
                  <div key={ci} className="flex-1 flex flex-col gap-4">
                    {col.map(cat=>{
                      const items = grocery.filter(i=>i.category===cat);
                      return (
                        <section key={cat} className="min-w-0 w-full overflow-hidden rounded-2xl border border-[#d6d6d6] bg-[#ffffff] shadow-[0_2px_10px_rgba(45,61,50,.04)]">
                          <button type="button" onClick={()=>setCollapsed(prev=>({...prev,[cat]:!prev[cat]}))} aria-expanded={!collapsed[cat]} aria-controls={`cat-${cat}`} className="flex w-full items-center justify-between rounded-t-2xl border-b border-[#d6d6d6] bg-[#f2f2f2] px-3 py-1 text-left hover:bg-[#e8e8e8] sm:px-4 sm:py-1">
                            <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-[#151b17]">{cat}</h3>
                            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md text-[#151b17]">{collapsed[cat]?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</span>
                          </button>
                          <div id={`cat-${cat}`} className={collapsed[cat]?"hidden p-1 sm:p-2":"p-1 sm:p-2"}>
                            {items.map(i=>{const key=`${i.name.toLowerCase()}|${i.unit.toLowerCase()}|${i.category}`;const done=syncedChecked.includes(key);const phrase=formatIngredientPhrase(i);return (
                              <label key={key} className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl px-1 py-1.5 sm:gap-3.5 sm:px-2 sm:py-3 ${done?"text-[#707b76] line-through":"hover:bg-[#f4f9ea]"}`}>
                                <Checkbox className="mt-1 size-6 shrink-0" checked={done} onCheckedChange={()=>toggleShoppingItemSync(key,!done)}/>
                                <span className="min-w-0 flex-1 text-base leading-normal text-[#151b17] sm:text-base sm:leading-relaxed">{phrase}</span>
                              </label>
                            )})}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div> : <div role="button" tabIndex={0} onClick={()=>goAway("recipes")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();goAway("recipes")}}} className="cursor-pointer rounded-3xl border border-dashed border-[#d6d6d6] bg-transparent p-10 text-center transition hover:border-[#bdbdbd] hover:bg-[#f1f8e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111613]/35"><ShoppingBasket className="mx-auto mb-3 text-[#6b7280]"/><p className="font-normal text-[#6b7280]">Add meals to build your shopping list.</p></div>) : <div className="space-y-6">
                {globalItemEntryOpen
                  ? <div className="relative">
                      <Input autoFocus disabled={savingGlobalItem} value={globalItemText} onChange={event=>setGlobalItemText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();addGlobalItem()}else if(event.key==="Escape"){setGlobalItemText("");setGlobalItemError("");setGlobalItemEntryOpen(false)}}} placeholder="Add a task or item" aria-label="Global shopping task" className={`${fieldControlClass} pr-24`}/>
                      <button type="button" onClick={addGlobalItem} disabled={!globalItemText.trim()||savingGlobalItem} aria-label="Add task" title="Add task" className="absolute right-12 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[#111613] transition-colors hover:bg-[#f1f8e6] disabled:opacity-50"><Check size={18}/></button>
                      <button type="button" onClick={()=>{setGlobalItemText("");setGlobalItemError("");setGlobalItemEntryOpen(false)}} disabled={savingGlobalItem} aria-label="Cancel adding task" title="Cancel" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[#111613] transition-colors hover:bg-[#f1f8e6] disabled:opacity-50"><X size={18}/></button>
                    </div>
                  : <Button type="button" variant="outline" onClick={()=>{setGlobalItemError("");setGlobalItemEntryOpen(true)}} className="w-full rounded-2xl border-dashed border-[#d2e0c1] bg-transparent py-6 text-[#151b17] shadow-none hover:bg-[#edf3f6] hover:text-[#111613]"><Plus size={18}/>Add a task</Button>}
                {globalItemError&&<p className="rounded-xl bg-[#fff0e8] p-3 text-sm text-[#963f32]">{globalItemError}</p>}
                {(["To get","Completed"] as const).map((heading,index)=>{
                  const sectionKey=index===0?"toGet":"completed";
                const items=globalItems.filter(item=>index===0?!item.checked:item.checked);
                  const isCollapsed=globalSectionsCollapsed[sectionKey];
                  return <section key={heading} className="min-w-0 w-full overflow-hidden rounded-2xl border border-[#d6d6d6] bg-[#ffffff] shadow-[0_2px_10px_rgba(45,61,50,.04)]">
                    <button type="button" onClick={()=>setGlobalSectionsCollapsed(previous=>({...previous,[sectionKey]:!previous[sectionKey]}))} aria-expanded={!isCollapsed} className="flex w-full items-center justify-between rounded-t-2xl border-b border-[#d6d6d6] bg-[#f2f2f2] px-3 py-1 text-left hover:bg-[#e8e8e8] sm:px-4 sm:py-1">
                      <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-[#151b17]">{heading} <span className="font-medium text-[#65716b]">({items.length})</span></h3>
                      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md text-[#151b17]">{isCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</span>
                    </button>
                    {!isCollapsed&&<div className="p-1 sm:p-2">{items.map(item=><div key={item.id} className={`flex min-w-0 items-start gap-2 rounded-xl px-1 py-1.5 sm:gap-3.5 sm:px-2 sm:py-3 ${item.checked?"":"hover:bg-[#f4f9ea]"}`}><Checkbox className="mt-1 size-6 shrink-0" checked={item.checked} onCheckedChange={()=>toggleGlobalItem(item)} aria-label={`${item.checked?"Uncheck":"Complete"} ${item.ingredient_name}`}/><span className={`min-w-0 flex-1 text-base leading-normal sm:leading-relaxed ${item.checked?"text-[#707b76] line-through":"text-[#151b17]"}`}>{globalItemPhrase(item)}</span><button type="button" onClick={()=>removeGlobalItem(item)} aria-label={`Remove ${item.ingredient_name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[#68766f] hover:bg-[#fff0e8] hover:text-[#963f32]"><X size={16}/></button></div>)}{!items.length&&<p className="rounded-2xl border border-dashed border-[#d6d6d6] p-5 text-center text-sm text-[#6b7280]">{index===0?"Everything is checked off.":"Completed items will appear here."}</p>}</div>}
                  </section>
                })}
              </div>}
          </TabsContent>

        <TabsContent value="history"><div className="space-y-4">{history.map(week=><article key={week.id} className="rounded-2xl border border-[#d6d6d6] bg-[#ffffff] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#687c36]">Meal plan</p><h3 className="font-sans text-xl font-bold">{week.label}</h3></div><span className="text-xs text-[#68736c]">Saved {new Date(week.savedAt).toLocaleDateString()}</span></div><div className="grid gap-2 sm:grid-cols-2">{week.meals.map(meal=><div key={meal.id} className="flex items-center gap-3 rounded-xl bg-[#edf3f6] p-3"><span className="text-2xl">{meal.emoji}</span><div className="min-w-0"><p className="truncate font-medium">{meal.title}</p><p className="text-xs text-[#65716b]">{meal.day?`${meal.day} · `:""}For {meal.people} people{meal.chef?` · Chef ${meal.chef}`:""}</p></div></div>)}</div></article>)}{!history.length&&<div className="rounded-3xl border border-dashed border-[#d6d6d6] bg-transparent p-10 text-center"><HistoryIcon className="mx-auto mb-3 text-[#6b7280]"/><p className="font-normal text-[#6b7280]">No completed weeks yet.</p><p className="mt-1 text-sm text-[#6b7280]">A week will appear here automatically after it ends.</p></div>}</div></TabsContent>
      </Tabs>
      </>}
    </div>
    <button type="button" onClick={hardRefresh} disabled={syncing} aria-label="Refresh recipes and images" title="Refresh recipes and images" className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-[#111613] text-white shadow-lg transition-colors hover:bg-[#2d3b32] disabled:opacity-60"><RefreshCw size={20} className={syncing?"animate-spin":""}/></button>
    <AlertDialog open={!!recipeToDelete} onOpenChange={value=>{if(!value)setRecipeToDelete(null)}}><AlertDialogContent className="bg-[#ffffff]"><AlertDialogHeader><AlertDialogTitle>Delete “{recipeToDelete?.title}”?</AlertDialogTitle><AlertDialogDescription>This removes the recipe from your collection, this week’s plan, and the shopping list. Previously saved week history will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep recipe</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>recipeToDelete&&deleteRecipe(recipeToDelete.id)}>Delete recipe</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
