"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeft, BookOpen, CalendarDays, Check, ChefHat, ChevronDown, ChevronUp, History as HistoryIcon, Minus, MoreHorizontal, Pencil, Plus, RefreshCw, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeToShoppingList, subscribeToGlobalShoppingList, saveShoppingList, toggleShoppingItem, subscribeToWeeklyPlan, saveWeeklyPlan, fetchWeeklyPlan, subscribeToHistory, fetchHistory, saveHistoryWeek } from "@/app/lib/realtime";

type Ingredient = { name: string; amount: number; unit: string; category: string; hasQty?: boolean };
type DirectionStep = { text: string; image?: string };
type Recipe = { id: string; title: string; emoji: string; time: string; serves: number; author: string; ingredients: Ingredient[]; image?: string; directions?: (string | DirectionStep)[]; sourceUrl?: string; sourceName?: string; tag?: string };
type WeeklyPlan = { selected: string[]; servings: Record<string,number>; checked: string[]; chefs: Record<string,string>; days: Record<string,string> };
type SavedWeek = { id: string; label: string; savedAt: string; meals: { id: string; title: string; emoji: string; people: number; chef?: string; day?: string }[] };
type ShoppingItem = { id: string; ingredient_key: string; ingredient_name: string; ingredient_amount: number; ingredient_unit: string; ingredient_category: string; checked: boolean };

function BackButton({ onClick }: { onClick: () => void }) {
  return <Button type="button" onClick={onClick} aria-label="Back" className="h-11 shrink-0 gap-1.5 rounded-lg border-0 bg-[#257F4B] px-4 text-sm font-semibold text-white hover:bg-[#1f6b3f] hover:text-white sm:h-9"><ArrowLeft size={18}/><span>Back</span></Button>;
}

const starterRecipes: Recipe[] = [
  {id:"roasted-veg-bowl",title:"Roasted Vegetable Grain Bowl",emoji:"🥗",time:"35 min",serves:4,author:"Maria",image:"/veg-bowl.jpg",ingredients:[
    {name:"quinoa",amount:1,unit:"cup",category:"Pantry"},{name:"sweet potato",amount:2,unit:"",category:"Vegetables"},{name:"chickpeas",amount:1,unit:"can",category:"Pantry"},{name:"spinach",amount:3,unit:"cups",category:"Vegetables"},{name:"feta",amount:4,unit:"oz",category:"Dairy"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Roast cubed sweet potato and chickpeas at 425°F until golden.","Cook quinoa per package instructions.","Toss quinoa with roasted veg, spinach, feta, olive oil, lemon, salt, and pepper."]},
  {id:"lemon-herb-chicken",title:"Lemon Herb Chicken",emoji:"🍗",time:"40 min",serves:4,author:"Dad",image:"/lemon-chicken.jpg",ingredients:[
    {name:"chicken breasts",amount:4,unit:"",category:"Meat"},{name:"lemons",amount:2,unit:"",category:"Fruit"},{name:"garlic cloves",amount:3,unit:"",category:"Vegetables"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"},{name:"rosemary",amount:1,unit:"tsp",category:"Pantry"}],directions:["Marinate chicken with lemon, garlic, olive oil, rosemary, salt, and pepper.","Roast at 425°F for 25–30 minutes until cooked through.","Rest 5 minutes before serving."]},
  {id:"beef-stew",title:"Hearty Beef Stew",emoji:"🥘",time:"2 hr",serves:6,author:"Dad",image:"/beef-stew.jpg",ingredients:[
    {name:"beef chuck",amount:2,unit:"lb",category:"Meat"},{name:"carrots",amount:3,unit:"",category:"Vegetables"},{name:"potatoes",amount:3,unit:"",category:"Vegetables"},{name:"onion",amount:1,unit:"",category:"Vegetables"},{name:"beef broth",amount:4,unit:"cups",category:"Pantry"},{name:"tomato paste",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Brown beef in batches, set aside.","Sauté onion, add carrots and potato, then return beef to pot.","Add broth and tomato paste, simmer covered 1.5–2 hours until beef is tender."]}
];

function directionText(step: string | DirectionStep): string {
  return typeof step === "string" ? step : step.text;
}

function directionImage(step: string | DirectionStep): string | undefined {
  return typeof step === "string" ? undefined : step.image;
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

function weekRangeShort(offset = 0) {
  const start = weekStart(offset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const left = start.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  const right = start.getMonth()===end.getMonth()
    ? String(end.getDate())
    : end.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  return `${left}–${right}`;
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
  {label:"Japanese",strong:/sushi|teriyaki|ramen|tempura|udon|edamame|wasabi/i,generic:/japanese|miso|soy sauce/i},
  {label:"Chinese",strong:/stir.?fry|kung pao|fried rice|dumpling|szechuan|lo mein|chow mein|wonton/i,generic:/chinese|hoisin/i},
  {label:"Thai",strong:/pad thai|satay|tom yum/i,generic:/thai|curry paste|coconut curry/i},
  {label:"Indian",strong:/tikka|masala|naan|tandoori|biryani/i,generic:/indian|curry|paneer|dal\b/i},
  {label:"Mediterranean",strong:/hummus|falafel|tabbouleh|shawarma/i,generic:/mediterranean|pita/i},
  {label:"Greek",strong:/feta|tzatziki|souvlaki|spanakopita|moussaka|greek salad|greek olives|kalamata|baklava|gyro/i,generic:/greek/i},
  {label:"French",strong:/baguette|croissant|ratatouille|quiche|béchamel|bechamel/i,generic:/french/i},
  {label:"Korean",strong:/kimchi|bulgogi|gochujang/i,generic:/korean/i},
  {label:"American",strong:/burger|bbq|barbecue|meatloaf|mac and cheese|mac & cheese|casserole|chili\b|cornbread|pot pie/i,generic:/american/i},
];

// Some ingredient names are just generic descriptors ("Greek-style yogurt",
// "Italian seasoning", "French bread", "Chinese five spice") rather than a sign
// the whole dish belongs to that cuisine. To avoid false-positive tags, a rule's
// "strong" (dish-specific) terms can match anywhere in the title or ingredients,
// but its broader "generic" terms (the bare cuisine name and common descriptor
// words) only count as a match when they appear in the recipe's title, where
// they're a much more reliable signal of the dish's actual cuisine.
function cuisineFor(recipe:Recipe):string|null {
  const title=recipe.title||"";
  const ingredientText=(recipe.ingredients||[]).map(i=>i.name).join(" ");
  const haystack=`${title} ${ingredientText}`;
  for(const rule of CUISINE_RULES){
    if(rule.strong.test(haystack)) return rule.label;
    if(rule.generic&&rule.generic.test(title)) return rule.label;
  }
  return null;
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

function normalizeShoppingIngredient(item:Ingredient):Ingredient {
  const preparedName=item.name
    .replace(/^(?:freshly|coarsely|finely)\s+ground\s+/i,"")
    .replace(/^(?:chopped|minced|diced|sliced|shredded|grated|peeled|crushed|trimmed|halved|quartered)\s+/i,"")
    .replace(/\s+/g," ").trim();
  const value=preparedName.toLowerCase();
  if(/\bsalt\b/.test(value)) {
    const unit=item.unit.toLowerCase();
    if(unit==="tablespoon"||unit==="tbsp") return {...item,name:"salt",amount:item.amount*3,unit:"tsp"};
    if(unit==="cup"||unit==="c") return {...item,name:"salt",amount:item.amount*48,unit:"tsp"};
    return {...item,name:"salt"};
  }
  if(/\bpepper\b/.test(value) && !/\b(bell|jalapeño?|chili|chilli|banana|cayenne)\s+pepper\b/.test(value)) {
    const unit=item.unit.toLowerCase();
    if(unit==="tablespoon"||unit==="tbsp") return {...item,name:"pepper",amount:item.amount*3,unit:"tsp"};
    if(unit==="cup"||unit==="c") return {...item,name:"pepper",amount:item.amount*48,unit:"tsp"};
    return {...item,name:"pepper"};
  }
  return {...item,name:preparedName};
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
  const hasQty=Number.isFinite(Number(item.amount));
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
  const [weekOffset,setWeekOffset]=useState<0|1>(0);
  const [plans,setPlans]=useState<Record<string,WeeklyPlan>>({[weekKey(0)]:{selected:["roasted-veg-bowl","lemon-herb-chicken"],servings:{"roasted-veg-bowl":4,"lemon-herb-chicken":4},checked:[],chefs:{},days:{}}});
  const [history,setHistory]=useState<SavedWeek[]>([]);
  const [query,setQuery]=useState("");
  const [tagFilter,setTagFilter]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [url,setUrl]=useState("");
  const [ingredients,setIngredients]=useState("");
  const [directions,setDirections]=useState("");
  const [directionImages,setDirectionImages]=useState<(string|undefined)[]>([]);
  const [imageUrl,setImageUrl]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [tag,setTag]=useState("");
  const [editingRecipeId,setEditingRecipeId]=useState<string|null>(null);
  const [activeRecipe,setActiveRecipe]=useState<Recipe|null>(null);
  const [recipeToDelete,setRecipeToDelete]=useState<Recipe|null>(null);
  const [ingredientsCollapsed,setIngredientsCollapsed]=useState(false);
  const [recipeTab,setRecipeTab]=useState<"ingredients"|"directions">("ingredients");
  const [checkedIngredients,setCheckedIngredients]=useState<Record<string,number[]>>({});
  const [ingredientSectionsCollapsed,setIngredientSectionsCollapsed]=useState<Record<"toUse"|"used",boolean>>({toUse:false,used:false});
  const [completedSteps,setCompletedSteps]=useState<number[]>([]);
  const [addMode,setAddMode]=useState<"url"|"review"|"manual">("url");
  const [importing,setImporting]=useState(false);
  const [importError,setImportError]=useState("");
  const [saveError,setSaveError]=useState("");
  const [savingRecipe,setSavingRecipe]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const [loaded,setLoaded]=useState(false);
  const [view,setView]=useState("plan");
  const [mockCategoryPreview,setMockCategoryPreview]=useState(false);
  const [shopTab,setShopTab]=useState<"meals"|"global">("meals");
  const [preRecipesView,setPreRecipesView]=useState("plan");
  const [planPicking,setPlanPicking]=useState(false);
  const [planQuery,setPlanQuery]=useState("");
  const [planSearchOpen,setPlanSearchOpen]=useState(false);
  useEffect(()=>{if(view!=="recipes"){setSearchOpen(false);setQuery("")}},[view]);
  useEffect(()=>{if(view!=="plan"){setPlanPicking(false);setPlanQuery("");setPlanSearchOpen(false)}},[view]);
  const [syncing,setSyncing]=useState(false);
  const [shoppingItems,setShoppingItems]=useState<ShoppingItem[]>([]);
  const [globalItems,setGlobalItems]=useState<ShoppingItem[]>([]);
  const [globalItemText,setGlobalItemText]=useState("");
  const [globalItemError,setGlobalItemError]=useState("");
  const [savingGlobalItem,setSavingGlobalItem]=useState(false);
  const [globalSectionsCollapsed,setGlobalSectionsCollapsed]=useState<Record<"toGet"|"completed",boolean>>({toGet:false,completed:false});
  const [planSynced,setPlanSynced]=useState<Record<string,boolean>>({});
  const [recipesLoaded,setRecipesLoaded]=useState(false);
  const unsubscribeRef=useRef<(() => void)|null>(null);
  const globalUnsubscribeRef=useRef<(() => void)|null>(null);
  const planUnsubscribeRef=useRef<(() => void)|null>(null);
  const historyUnsubscribeRef=useRef<(() => void)|null>(null);
  const activeWeekKey=weekKey(weekOffset);
  const activePlan=plans[activeWeekKey]||{selected:[],servings:{},checked:[],chefs:{},days:{}};
  const visibleRecipeIds=new Set(recipes.map(recipe=>recipe.id));
  const selected=(activePlan.selected||[]).filter(id=>visibleRecipeIds.has(id));
  const servings=Object.fromEntries(Object.entries(activePlan.servings||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const checked=activePlan.checked||[];
  const chefs=Object.fromEntries(Object.entries(activePlan.chefs||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const days=Object.fromEntries(Object.entries(activePlan.days||{}).filter(([id])=>visibleRecipeIds.has(id)));
  const emptyPlan=():WeeklyPlan=>({selected:[],servings:{},checked:[],chefs:{},days:{}});
  const setSelected=(update:(current:string[])=>string[])=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,selected:update(plan.selected)}}});
  const setServings=(update:(current:Record<string,number>)=>Record<string,number>)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,servings:update(plan.servings)}}});
  const setChecked=(update:(current:string[])=>string[])=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,checked:update(plan.checked)}}});
  const setChef=(id:string,name:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,chefs:{...(plan.chefs||{}),[id]:name}}}});
  const setDay=(id:string,day:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,days:{...(plan.days||{}),[id]:day}}}});
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

  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);setMockCategoryPreview(params.get("mockCategory")==="1");if(params.get("view")==="shop")setView("shop");if(params.get("resetLocal")==="1"){localStorage.removeItem("cameron-family-table");params.delete("resetLocal");const newUrl=window.location.pathname+(params.toString()?"?"+params.toString():"");window.history.replaceState({},"",newUrl);}const raw=localStorage.getItem("cameron-family-table");if(raw){const s=JSON.parse(raw);setHistory(s.history||[]);setPlans(s.plans||{[weekKey(0)]:{selected:s.selected||[],servings:s.servings||Object.fromEntries((s.selected||[]).map((id:string)=>[id,4])),checked:s.checked||[],chefs:{},days:{}}})}}finally{setLoaded(true);loadSharedRecipes()}},[]);
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
    const search=params.toString();
    const newUrl=window.location.pathname+(search?`?${search}`:"");
    if(newUrl!==window.location.pathname+window.location.search)window.history.replaceState({},"",newUrl);
  },[loaded,sharedLinkApplied,view,activeRecipe,weekOffset]);
  const loadSharedRecipes=async()=>{try{const response=await fetch("/api/recipes");if(!response.ok)return false;const {recipes:shared}=await response.json();if(Array.isArray(shared)){const normalized=shared.map((r:any)=>({...r,tag:typeof r.tag==="string"?r.tag.trim()||undefined:undefined,sourceUrl:r.sourceUrl||r.source_url||undefined,sourceName:r.sourceName||r.source_name||undefined,ingredients:Array.isArray(r.ingredients)?r.ingredients.map((i:any)=>normalizeIngredient(i)).filter((i:Ingredient|null):i is Ingredient=>i!==null):[],directions:Array.isArray(r.directions)?r.directions.filter((d:any):d is string|DirectionStep=>typeof d==="string"||(d&&typeof d.text==="string")):[]}));setRecipes(normalized);setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>[key,{...plan,selected:plan.selected.filter(id=>normalized.some(recipe=>recipe.id===id)),servings:Object.fromEntries(Object.entries(plan.servings).filter(([id])=>normalized.some(recipe=>recipe.id===id))),checked:plan.checked,chefs:Object.fromEntries(Object.entries(plan.chefs||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id))),days:Object.fromEntries(Object.entries(plan.days||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id)))}])));setRecipesLoaded(true);return true}return false}catch(e){console.error("Failed to load shared recipes:",e);return false}};
  const syncGlobalItems=async()=>{
    const response=await fetch("/api/shopping/global");
    if(!response.ok) throw new Error("Failed to fetch global shopping items");
    const {items}=await response.json();
    if(Array.isArray(items)) setGlobalItems(items);
  };
  const syncNow=async()=>{setSyncing(true);try{const hasShared=await loadSharedRecipes();if(hasShared){const response=await fetch(`/api/shopping?week_key=${encodeURIComponent(activeWeekKey)}`);if(response.ok){const {items}=await response.json();if(Array.isArray(items))setShoppingItems(items)}await syncGlobalItems()}return hasShared}finally{setSyncing(false)}};
  const hardRefresh=async()=>{setSyncing(true);try{await syncNow()}finally{window.location.reload()}};
  useEffect(()=>{if(loaded)localStorage.setItem("cameron-family-table",JSON.stringify({recipes,plans,history}))},[loaded,recipes,plans,history]);
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
    if(!loaded)return;
    let cancelled=false;
    (async()=>{try{const weeks=await fetchHistory();if(!cancelled)mergeRemoteHistory(weeks)}catch(e){console.error("Failed to fetch history:",e)}})();
    if(historyUnsubscribeRef.current)historyUnsubscribeRef.current();
    historyUnsubscribeRef.current=subscribeToHistory(mergeRemoteHistory);
    return()=>{cancelled=true;if(historyUnsubscribeRef.current)historyUnsubscribeRef.current()};
  },[loaded]);
  useEffect(()=>{
    if(!loaded)return;
    const currentKey=weekKey(0);
    const savedLabels=new Set(history.map(week=>week.label));
    const newlyCompleted=Object.entries(plans).filter(([key,plan])=>key<currentKey&&plan.selected.length>0&&!savedLabels.has(weekRangeFromKey(key))).map(([key,plan])=>({
      id:`auto-${key}`,
      label:weekRangeFromKey(key),
      savedAt:new Date().toISOString(),
      meals:recipes.filter(recipe=>plan.selected.includes(recipe.id)).map(recipe=>({id:recipe.id,title:recipe.title,emoji:recipe.emoji,people:plan.servings[recipe.id]||4,chef:plan.chefs?.[recipe.id]?.trim()||undefined,day:plan.days?.[recipe.id]?.trim()||undefined}))
    })).filter(week=>week.meals.length>0);
    if(newlyCompleted.length){setHistory(current=>[...newlyCompleted,...current]);newlyCompleted.forEach(week=>{saveHistoryWeek(week).catch(e=>console.error("Failed to save history week:",e))})}
  },[loaded,plans,recipes,history]);

  const grocery=useMemo(()=>{
    const items=new Map<string,Ingredient>();
    recipes.filter(r=>selected.includes(r.id)).forEach(r=>(Array.isArray(r.ingredients)?r.ingredients:[]).forEach(raw=>{
      const normalized=normalizeIngredient(raw); if(!normalized)return;
      if(excludeFromShoppingList(normalized.name)) return;
      const shoppingIngredient=normalizeShoppingIngredient(normalized);
      if(matchesGlobalIngredient(shoppingIngredient.name,globalItems)) return;
      const i=/^c$/i.test(shoppingIngredient.unit.trim())?{...shoppingIngredient,amount:shoppingIngredient.amount*8,unit:"oz"}:shoppingIngredient;
      const canonicalName=singularizeName(i.name.trim());
      const key=`${canonicalName.toLowerCase()}|${i.unit.toLowerCase()}|${i.category}`; const old=items.get(key); const people=servings[r.id]||4;
      items.set(key,{...i,name:canonicalName,amount:(old?.amount||0)+(i.amount*people/(r.serves||4)),hasQty:(old?.hasQty??false)||(i.hasQty??false)});
      }));
    if(mockCategoryPreview)items.set("mobile preview item|unit|Mobile Preview",{name:"mobile preview item",amount:1,unit:"unit",category:"Mobile Preview",hasQty:true});
    return [...items.values()].sort((a,b)=>(GROCERY_CATEGORY_ORDER.indexOf(a.category)-GROCERY_CATEGORY_ORDER.indexOf(b.category))||a.name.localeCompare(b.name));
  },[recipes,selected,servings,globalItems,mockCategoryPreview]);
  const categories=[...new Set(grocery.map(i=>i.category))];
  const syncedChecked=useMemo(()=>{const localSet=new Set(checked);const syncedKeys=new Set(shoppingItems.filter(s=>s.checked).map(s=>s.ingredient_key));return Array.from(new Set([...localSet,...syncedKeys]));},[checked,shoppingItems]);
  const grocerySignature=useMemo(()=>JSON.stringify(grocery.map(g=>[g.name.toLowerCase(),g.unit.toLowerCase(),g.category,Math.round(g.amount*100)])),[grocery]);
  const lastSavedGrocerySignatureRef=useRef<Record<string,string>>({});
  useEffect(()=>{
    if(!loaded||grocery.length===0||mockCategoryPreview)return;
    if(lastSavedGrocerySignatureRef.current[activeWeekKey]===grocerySignature)return;
    (async()=>{
      try{
        const items=grocery.map(g=>({ingredient_key:`${g.name.toLowerCase()}|${g.unit.toLowerCase()}|${g.category}`,ingredient_name:g.name,ingredient_amount:g.amount,ingredient_unit:g.unit,ingredient_category:g.category}));
        await saveShoppingList(activeWeekKey,items);
        lastSavedGrocerySignatureRef.current[activeWeekKey]=grocerySignature;
      }catch(e){console.error("Failed to save shopping list:",e)}
    })();
  },[grocery,activeWeekKey,loaded,mockCategoryPreview]);
  useEffect(()=>{
    if(!loaded)return;
    if(unsubscribeRef.current)unsubscribeRef.current();
    unsubscribeRef.current=subscribeToShoppingList(activeWeekKey,(items:ShoppingItem[])=>setShoppingItems(items));
    return()=>{if(unsubscribeRef.current)unsubscribeRef.current()};
  },[activeWeekKey,loaded]);
  useEffect(()=>{
    if(!loaded)return;
    if(globalUnsubscribeRef.current)globalUnsubscribeRef.current();
    globalUnsubscribeRef.current=subscribeToGlobalShoppingList(setGlobalItems);
    return()=>{if(globalUnsubscribeRef.current)globalUnsubscribeRef.current()};
  },[loaded]);
  const planSignature=JSON.stringify(activePlan);
  useEffect(()=>{
    if(!loaded||!planSynced[activeWeekKey]||!recipesLoaded)return;
    (async()=>{
      try{
        await saveWeeklyPlan(activeWeekKey,{selected_recipes:selected,servings,chefs,days});
      }catch(e){console.error("Failed to save weekly plan:",e)}
    })();
  },[planSignature,activeWeekKey,loaded,planSynced,recipesLoaded]);
  const applyRemotePlan=(weekKeyToUpdate:string,remote:any)=>{
    setPlanSynced(prev=>prev[weekKeyToUpdate]?prev:{...prev,[weekKeyToUpdate]:true});
    if(!remote)return;
    setPlans(all=>{
      const local=all[weekKeyToUpdate]||emptyPlan();
      const merged:WeeklyPlan={
        selected:Array.isArray(remote.selected_recipes)?remote.selected_recipes:[],
        servings:remote.servings||{},
        checked:local.checked,
        chefs:remote.chefs||{},
        days:remote.days||{},
      };
      if(JSON.stringify(merged)===JSON.stringify(local))return all;
      return{...all,[weekKeyToUpdate]:merged};
    });
  };
  useEffect(()=>{
    if(!loaded)return;
    let cancelled=false;
    (async()=>{try{const remote=await fetchWeeklyPlan(activeWeekKey);if(!cancelled)applyRemotePlan(activeWeekKey,remote)}catch(e){console.error("Failed to fetch weekly plan:",e)}})();
    if(planUnsubscribeRef.current)planUnsubscribeRef.current();
    planUnsubscribeRef.current=subscribeToWeeklyPlan(activeWeekKey,(remote:any)=>applyRemotePlan(activeWeekKey,remote));
    return()=>{cancelled=true;if(planUnsubscribeRef.current)planUnsubscribeRef.current()};
  },[activeWeekKey,loaded]);
  useEffect(()=>{if(loaded)syncNow()},[loaded]);
  useEffect(()=>{if(!loaded)return;const interval=setInterval(()=>{syncNow()},30000);return()=>clearInterval(interval)},[loaded]);
  const [columnCount,setColumnCount]=useState(3);
  useEffect(()=>{
    const update=()=>{const w=typeof window!=="undefined"?window.innerWidth:1200; if(w<640) setColumnCount(1); else if(w<1024) setColumnCount(2); else setColumnCount(3);};
    update(); window.addEventListener('resize', update); return ()=>window.removeEventListener('resize', update);
  },[]);
  const categoryColumns = useMemo(()=>{ const cols = Array.from({length: Math.max(1, columnCount)}, ()=>[] as string[]); categories.forEach((c,i)=>cols[i%cols.length].push(c)); return cols; },[categories,columnCount]);

  const toggle=(id:string)=>setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();const adding=!plan.selected.includes(id);return{...all,[activeWeekKey]:{...plan,selected:adding?[...plan.selected,id]:plan.selected.filter(recipeId=>recipeId!==id),servings:{...plan.servings,[id]:plan.servings[id]||4},checked:adding&&plan.selected.length===0?[]:plan.checked}}});
  const changeServings=(id:string,delta:number)=>setServings(v=>({...v,[id]:Math.max(1,(v[id]||4)+delta)}));
  const openRecipe=(recipe:Recipe)=>{setActiveRecipe(recipe);setRecipeTab("ingredients");setIngredientsCollapsed(false);setCompletedSteps([]);window.scrollTo({top:0,behavior:"smooth"})};
  const toggleStepDone=(index:number)=>{setCompletedSteps(prev=>prev.includes(index)?prev.filter(i=>i!==index):[...prev,index])};
  const toggleIngredientDone=(recipeId:string,index:number)=>{
    setCheckedIngredients(previous=>{
      const current=new Set(previous[recipeId]||[]);
      if(current.has(index))current.delete(index);else current.add(index);
      return {...previous,[recipeId]:Array.from(current)};
    });
  };
  const parsedIngredients=()=>ingredients.split("\n").filter(Boolean).map(parseIngredientLine);
  const resetAdd=()=>{setTitle("");setUrl("");setIngredients("");setDirections("");setDirectionImages([]);setImageUrl("");setSourceName("");setTag("");setAddMode("url");setImportError("");setImporting(false);setEditingRecipeId(null)};
  const openEditRecipe=(recipe:Recipe)=>{setEditingRecipeId(recipe.id);setTitle(recipe.title);setUrl(recipe.sourceUrl||"");setSourceName(recipe.sourceName||"");setTag(recipe.tag||"");setImageUrl(recipe.image||"");setIngredients((recipe.ingredients||[]).map(ingredientLineFor).join("\n"));setDirections((recipe.directions||[]).map(directionText).join("\n"));setDirectionImages((recipe.directions||[]).map(directionImage));setAddMode("manual");setSaveError("");setOpen(true)};
  const saveRecipe=async()=>{if(!title.trim()){setSaveError("Add a recipe name before saving.");return}setSavingRecipe(true);setSaveError("");
    if(editingRecipeId){
      const id=editingRecipeId;
      const updatedDirections=directions.split("\n").map(x=>x.trim()).filter(Boolean).map((text,index)=>directionImages[index]?{text,image:directionImages[index]}:text);
      const updated={title:title.trim(),tag:tag.trim()||null,ingredients:parsedIngredients(),directions:updatedDirections,image:imageUrl||undefined,source_url:url||undefined,source_name:sourceName||undefined};
      try{const response=await fetch(`/api/recipes/${id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(updated)});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe changes")}const saved=await syncNow();if(saved){resetAdd();setOpen(false);setActiveRecipe(prev=>prev&&prev.id===id?{...prev,title:updated.title,tag:updated.tag||undefined,ingredients:updated.ingredients,directions:updated.directions,image:updated.image,sourceUrl:updated.source_url,sourceName:updated.source_name}:prev)}else{throw new Error("Could not refresh recipes after saving.")}}catch(error){setSaveError(error instanceof Error?error.message:"Failed to save recipe changes");console.error("Failed to save recipe changes:",error)}finally{setSavingRecipe(false)}
      return;
    }
    const id=crypto.randomUUID();const newDirections=directions.split("\n").map(x=>x.trim()).filter(Boolean).map((text,index)=>directionImages[index]?{text,image:directionImages[index]}:text);const newRecipe={id,title:title.trim(),tag:tag.trim()||undefined,emoji:"🍽️",time:"Family recipe",serves:4,author:"Family",ingredients:parsedIngredients(),directions:newDirections,image:imageUrl||undefined,sourceUrl:url||undefined,sourceName:sourceName||undefined};try{const response=await fetch("/api/recipes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,title:newRecipe.title,tag:newRecipe.tag,emoji:newRecipe.emoji,time:newRecipe.time,serves:newRecipe.serves,author:newRecipe.author,ingredients:newRecipe.ingredients,directions:newRecipe.directions,image:newRecipe.image,source_url:newRecipe.sourceUrl,source_name:newRecipe.sourceName})});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe to database")}const saved=await syncNow();if(saved){setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,selected:[...plan.selected,id],servings:{...plan.servings,[id]:4},checked:plan.selected.length===0?[]:plan.checked}}});resetAdd();setOpen(false);setView("plan")}else{throw new Error("Could not refresh recipes after saving.")}}catch(error){setSaveError(error instanceof Error?error.message:"Failed to save recipe to database");console.error("Failed to save recipe to database:",error)}finally{setSavingRecipe(false)}};
  const importRecipe=async()=>{if(!url.trim())return;setImporting(true);setImportError("");try{const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});const data=await response.json();if(!response.ok)throw new Error(data.error||"We couldn't import that recipe.");const importedDirections=(data.directions||[]) as (string|DirectionStep)[];setTitle(data.title||"");setIngredients((data.ingredients||[]).join("\n"));setDirections(importedDirections.map(directionText).join("\n"));setDirectionImages(importedDirections.map(directionImage));setImageUrl(data.image||"");setSourceName(data.sourceName||"");setAddMode("review")}catch(error){setImportError(error instanceof Error?error.message:"We couldn't import that recipe.")}finally{setImporting(false)}};
  const deleteRecipe=async(id:string)=>{try{const response=await fetch(`/api/recipes/${id}`,{method:"DELETE"});if(!response.ok)throw new Error("Failed to delete recipe");await syncNow();setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>{const nextServings={...plan.servings};const nextChefs={...(plan.chefs||{})};const nextDays={...(plan.days||{})};delete nextServings[id];delete nextChefs[id];delete nextDays[id];return[key,{...plan,selected:plan.selected.filter(recipeId=>recipeId!==id),servings:nextServings,chefs:nextChefs,days:nextDays}]})));setActiveRecipe(null)}catch(error){console.error("Failed to delete recipe from database:",error)}};
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
  const recipeGrid=(list:Recipe[])=><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map(r=><article key={r.id} onClick={()=>openRecipe(r)} className={`group relative cursor-pointer overflow-hidden rounded-[1.75rem] border bg-white transition ${selected.includes(r.id)?"border-[#7ea087] shadow-[0_0_0_2px_rgba(65,98,75,.12)]":"border-[#e1ddd3] hover:-translate-y-1 hover:shadow-lg"}`}><div className="absolute left-3 top-3 z-10"><TooltipProvider><Tooltip><TooltipTrigger aria-label={selected.includes(r.id)?`Remove ${r.title} from ${weekRange(weekOffset)}`:`Add ${r.title} to ${weekRange(weekOffset)}`} onClick={event=>{event.stopPropagation();toggle(r.id)}} className={`grid size-11 place-items-center rounded-full border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35 sm:size-10 ${selected.includes(r.id)?"border-[#257F4B] bg-[#257F4B] text-white hover:bg-[#1f6b3f]":"border-[#d8d5cd] bg-white/95 text-[#257F4B] hover:bg-[#edf3ee]"}`}>{selected.includes(r.id)?<Check size={20}/>:<Plus size={21}/>}</TooltipTrigger><TooltipContent side="top" sideOffset={6} className="bg-[#1f3529] text-white">{selected.includes(r.id)?`Remove from ${weekRange(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}</TooltipContent></Tooltip></TooltipProvider></div><div className="absolute right-3 top-3 z-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><DropdownMenu><DropdownMenuTrigger asChild><button onClick={event=>event.stopPropagation()} aria-label={`More actions for ${r.title}`} className="grid size-11 place-items-center rounded-lg border border-white/40 bg-white/40 text-[#304439] shadow-sm backdrop-blur-sm transition-colors hover:border-[#d8d5cd] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35 sm:size-10"><MoreHorizontal size={21}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-44 bg-white"><DropdownMenuItem onClick={event=>{event.stopPropagation();openEditRecipe(r)}}><Pencil/>Edit recipe</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={event=>{event.stopPropagation();setRecipeToDelete(r)}}><Trash2/>Delete recipe</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{(r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")} alt={r.title} className="h-44 w-full object-cover"/> : <div className="grid h-36 place-items-center bg-[#edf2eb] text-5xl">{r.emoji}</div>}<div className="min-w-0 p-5"><h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3><div className="mt-1.5 flex flex-wrap items-center gap-2"><button type="button" onClick={event=>{event.stopPropagation();setTagFilter(recipeTag(r));setQuery("")}} className="rounded-full bg-[#eef1e9] px-2 py-0.5 text-xs font-semibold text-[#45644e] hover:bg-[#dfeade] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35">{recipeTag(r)}</button>{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-[#45644e] underline decoration-[#45644e]/35 underline-offset-2 hover:decoration-[#45644e]" onClick={event=>event.stopPropagation()}>{r.sourceName||"View original recipe"}</a>}</div></div></article>)}</div>;

  const planRecipeGrid=(list:Recipe[])=><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map((r,i)=><article key={r.id} onClick={()=>openRecipe(r)} className="group relative cursor-pointer overflow-hidden rounded-[1.75rem] border border-[#e1ddd3] bg-white transition hover:-translate-y-1 hover:shadow-lg"><div className="absolute right-3 top-3 z-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button onClick={event=>{event.stopPropagation();toggle(r.id)}} aria-label={`Remove ${r.title} from ${weekOffset===0?"this week":"next week"}`} className="grid size-11 place-items-center rounded-lg border border-white/40 bg-white/40 text-[#304439] shadow-sm backdrop-blur-sm transition-colors hover:border-[#d7a39a] hover:bg-white hover:text-[#a33f32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35 sm:size-10"><X size={20}/></button></div>{(r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")} alt={r.title} className="h-44 w-full object-cover"/> : <div className="grid h-36 place-items-center bg-[#edf2eb] text-5xl">{r.emoji}</div>}<div className="min-w-0 p-5"><h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3><div className="mt-3 grid min-w-0 grid-cols-2 gap-2" onClick={event=>event.stopPropagation()}>
        <Select value={days[r.id]||"none"} onValueChange={value=>{const day=value==="none"?"":value;setDay(r.id,day);setCommittedDays(previous=>({...previous,[r.id]:day}))}}>
          <SelectTrigger aria-label={`Day for ${r.title}`} className="h-11 w-full rounded-lg border-[#ddd4c3] bg-white text-sm font-semibold text-[#FF7060] shadow-none focus-visible:border-[#FF7060] focus-visible:ring-[#FF7060]/20"><SelectValue placeholder="Add day"/></SelectTrigger>
          <SelectContent position="popper" side="top" sideOffset={6} align="start" className="max-h-none overflow-visible rounded-xl bg-white p-1 shadow-lg"><SelectItem value="none">Add day</SelectItem>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day=><SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={chefs[r.id]||"none"} onValueChange={value=>setChef(r.id,value==="none"?"":value)}>
          <SelectTrigger aria-label={`Chef cooking ${r.title}`} className={`h-11 w-full rounded-lg border-[#ddd4c3] bg-white text-sm shadow-none focus-visible:border-[#9a735e] focus-visible:ring-[#9a735e]/20 ${chefs[r.id]?"font-semibold text-[#1f3529]":"text-[#9a9f9b]"}`}><SelectValue placeholder="Add chef name"/></SelectTrigger>
          <SelectContent position="popper" side="top" sideOffset={6} align="end" className="max-h-none overflow-visible rounded-xl bg-white p-1 shadow-lg"><SelectItem value="none">Add chef name</SelectItem>{["Rory","Maria","Emma","Maya"].map(chef=><SelectItem key={chef} value={chef}>{chef}</SelectItem>)}</SelectContent>
        </Select>
      </div></div></article>)}</div>;

  if(open) {
    const fieldClass="mt-2 min-h-14 rounded-xl border-[#c9d6cb] bg-white px-4 py-3 text-base text-[#1f3529] shadow-none placeholder:text-[#8a9187] focus-visible:border-[#257F4B] focus-visible:ring-4 focus-visible:ring-[#257F4B]/15";
    const textAreaClass="mt-2 min-h-40 rounded-xl border-[#c9d6cb] bg-white px-4 py-3 text-base leading-relaxed text-[#1f3529] shadow-none placeholder:text-[#8a9187] focus-visible:border-[#257F4B] focus-visible:ring-4 focus-visible:ring-[#257F4B]/15";
    return <main className="min-h-screen bg-[#faf9f5] text-[#1f3529]" style={{scrollbarGutter:"stable"}}>
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Button type="button" onClick={()=>{setOpen(false);resetAdd()}} className="h-12 rounded-xl border-0 bg-[#257F4B] px-4 text-white hover:bg-[#1f6b3f] hover:text-white"><ArrowLeft size={18}/>Back</Button>
          <span className="text-right text-xs font-bold uppercase tracking-[.16em] text-[#78907c]">Cameron Family Table</span>
        </div>
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-[#FF7060]">{editingRecipeId?"Edit recipe":"New recipe"}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight sm:text-5xl">{editingRecipeId?"Make it just right":"Add a recipe to the table"}</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#6d786f]">{addMode==="url"?"Start with a recipe link, or enter a family favorite yourself.":addMode==="review"?"Check the imported details, then make any changes before saving.":"Tell us about the recipe using the roomy fields below."}</p>
        </div>
        {addMode==="url"&&<section className="rounded-3xl border border-[#ddd4c3] bg-[#fffdf8] p-5 shadow-[0_4px_20px_rgba(45,61,50,.05)] sm:p-8">
          <label className="block text-base font-bold text-[#244832]">Recipe link</label>
          <p className="mt-1 text-sm text-[#6d786f]">We’ll try to bring in the title, ingredients, directions, and image.</p>
          <Input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/favorite-recipe" aria-label="Recipe URL" className={fieldClass}/>
          <Button type="button" className="mt-5 h-14 w-full rounded-xl bg-[#45644e] text-base font-bold text-white hover:bg-[#305a3c]" disabled={!url.trim()||importing} onClick={importRecipe}>{importing?"Importing recipe…":"Import recipe"}</Button>
          {importError&&<p role="alert" className="mt-4 rounded-xl bg-[#fbe9e2] p-4 text-sm leading-relaxed text-[#9a402d]">{importError}</p>}
          <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-[#ddd4c3]"/><span className="text-sm text-[#7b837c]">or</span><span className="h-px flex-1 bg-[#ddd4c3]"/></div>
          <Button type="button" variant="outline" className="h-14 w-full rounded-xl border-[#b9cabb] bg-white text-base font-bold text-[#45644e] hover:bg-[#edf3ee]" onClick={()=>setAddMode("manual")}>Enter recipe manually</Button>
        </section>}
        {(addMode==="review"||addMode==="manual")&&<section className="space-y-6 rounded-3xl border border-[#ddd4c3] bg-[#fffdf8] p-5 shadow-[0_4px_20px_rgba(45,61,50,.05)] sm:p-8">
          {imageUrl&&<img src={imageUrl} alt="Recipe preview" className="h-48 w-full rounded-2xl object-cover sm:h-64"/>}
          <div><label className="block text-base font-bold text-[#244832]">Recipe name <span className="font-normal text-[#a33f32]">*</span></label><Input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Sunday tomato sauce" aria-required="true" className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#244832]">Tag <span className="font-normal text-[#6d786f]">(optional)</span></label><p className="mt-1 text-sm text-[#6d786f]">Use a cuisine or any label your family will recognize. Leave blank to infer one.</p><Input value={tag} onChange={e=>setTag(e.target.value)} placeholder="e.g. Italian, Weeknight, Favorite" className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#244832]">Image URL <span className="font-normal text-[#6d786f]">(optional)</span></label><Input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." className={fieldClass}/></div>
          <div><label className="block text-base font-bold text-[#244832]">Ingredients</label><p className="mt-1 text-sm text-[#6d786f]">Add one ingredient per line.</p><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder={"2 apples\n1 cup flour\nA pinch of salt"} rows={7} className={textAreaClass}/></div>
          <div><label className="block text-base font-bold text-[#244832]">Directions</label><p className="mt-1 text-sm text-[#6d786f]">Add one step per line.</p><Textarea value={directions} onChange={e=>setDirections(e.target.value)} placeholder={"Heat oven to 375°F\nMix ingredients\nBake until golden"} rows={7} className={textAreaClass}/></div>
          {addMode==="review"&&<p className="rounded-xl bg-[#edf3ee] p-4 text-sm leading-relaxed text-[#45644e]">Everything is editable before you save it.</p>}
          {saveError&&<p role="alert" className="rounded-xl bg-[#fbe9e2] p-4 text-sm leading-relaxed text-[#9a402d]">{saveError}</p>}
          <Button type="button" className="h-14 w-full rounded-xl bg-[#45644e] text-base font-bold text-white hover:bg-[#305a3c]" disabled={savingRecipe} onClick={saveRecipe}>{savingRecipe?"Saving…":editingRecipeId?"Save changes":`Save and add to ${weekRange(weekOffset)}`}</Button>
          {!editingRecipeId&&<Button type="button" variant="ghost" className="h-12 w-full rounded-xl text-base font-semibold text-[#45644e] hover:bg-[#edf3ee] hover:text-[#244832]" onClick={()=>setAddMode(addMode==="review"?"url":"url")}>{addMode==="review"?"Use a different link":"Back to recipe link"}</Button>}
        </section>}
      </div>
    </main>;
  }

  return <main className="min-h-screen bg-[#faf9f5] text-[#1f3529]" style={{scrollbarGutter:'stable'}}>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {activeRecipe ? <article>
        <div className="mb-5 flex items-center justify-between gap-2">
          <BackButton onClick={()=>setActiveRecipe(null)}/>
          <div className="flex min-w-0 gap-2"><Button onClick={()=>toggle(activeRecipe.id)} variant="outline" size="icon" className={`shrink-0 rounded-lg border-[#d8d5cd] bg-white sm:h-9 sm:w-auto sm:px-4 ${selected.includes(activeRecipe.id)?"text-[#257F4B] hover:bg-[#eaf4ee]":"text-[#257F4B] hover:bg-[#edf3ee]"}`} aria-label={selected.includes(activeRecipe.id)?`Added to ${weekRange(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}>{selected.includes(activeRecipe.id)?<Check size={18}/>:<Plus size={18}/>}<span className="hidden sm:inline">{selected.includes(activeRecipe.id)?`Added to ${weekRange(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}</span></Button><Button variant="outline" size="icon" className="shrink-0 rounded-lg border-[#d8d5cd] bg-white text-[#257F4B] hover:bg-[#edf3ee] sm:h-9 sm:w-auto sm:px-3" onClick={()=>openEditRecipe(activeRecipe)} aria-label="Edit"><Pencil size={18}/><span className="hidden sm:inline">Edit</span></Button><Button variant="outline" size="icon" className="shrink-0 rounded-lg border-[#d7a39a] bg-white text-[#a33f32] hover:bg-[#fbe9e2] hover:text-[#8c3025] sm:h-9 sm:w-auto sm:px-3" onClick={()=>setRecipeToDelete(activeRecipe)} aria-label="Delete"><Trash2 size={18}/><span className="hidden sm:inline">Delete</span></Button></div>
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-[#dedbd2] bg-white">
          {(activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")} alt={activeRecipe.title} className="h-64 w-full object-cover sm:h-80 lg:h-[28rem]"/> : <div className="grid h-56 place-items-center bg-[#e8f0e8] text-8xl">{activeRecipe.emoji}</div>}
          <div className="p-6 sm:p-9 lg:p-12">
            <div className="border-b border-[#e8e3da] pb-8">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.2em]"><span className="rounded-full bg-[#e6efe7] px-2.5 py-1 text-[#257F4B]">{recipeTag(activeRecipe)}</span>{activeRecipe.sourceUrl&&<a href={activeRecipe.sourceUrl} target="_blank" rel="noreferrer" className="text-[#477457] underline decoration-[#477457]/40 underline-offset-2 hover:decoration-[#477457]">{activeRecipe.sourceName||"View original recipe"}</a>}</div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
                <h2 className="min-w-0 flex-1 font-serif text-3xl font-bold leading-tight sm:text-5xl">{activeRecipe.title}</h2>
                <div className="mt-6 flex max-w-md shrink-0 items-center justify-between gap-3 rounded-2xl bg-[#f2ecdf] p-3 sm:mt-0"><span className="font-medium">Cooking for</span><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(activeRecipe.id,-1)}><Minus size={17} className="sm:hidden"/><Minus size={15} className="hidden sm:block"/></Button><strong className="min-w-20 text-center">{servings[activeRecipe.id]||4} people</strong><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(activeRecipe.id,1)}><Plus size={17} className="sm:hidden"/><Plus size={15} className="hidden sm:block"/></Button></div></div>
              </div>
            </div>

            <div className="mt-10">
              <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[#f2ecdf] p-1" role="tablist" aria-label="Recipe details">
                <button type="button" role="tab" aria-selected={recipeTab==="ingredients"} onClick={()=>setRecipeTab("ingredients")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${recipeTab==="ingredients"?"bg-white text-[#257F4B] shadow-sm":"text-[#6d786f] hover:text-[#244832]"}`}>Ingredients</button>
                <button type="button" role="tab" aria-selected={recipeTab==="directions"} onClick={()=>setRecipeTab("directions")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${recipeTab==="directions"?"bg-white text-[#257F4B] shadow-sm":"text-[#6d786f] hover:text-[#244832]"}`}>Directions</button>
              </div>
              {recipeTab==="ingredients"
                ? <section className="min-w-0"><button onClick={()=>setIngredientsCollapsed(v=>!v)} aria-expanded={!ingredientsCollapsed} aria-controls="ingredients-list" className="flex w-full items-center justify-between gap-3 text-left"><h3 className="font-serif text-2xl font-bold">Ingredients</h3><span aria-label={ingredientsCollapsed?"Expand ingredients":"Collapse ingredients"} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d8d5cd] bg-white text-[#257F4B] hover:bg-[#f1f4ef]">{ingredientsCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span></button>{!ingredientsCollapsed&&<div id="ingredients-list" className="mt-4 space-y-5">{(["To use","Used"] as const).map((heading,index)=>{const sectionKey=index===0?"toUse":"used";const isCollapsed=ingredientSectionsCollapsed[sectionKey];const items=(Array.isArray(activeRecipe.ingredients)?activeRecipe.ingredients:[]).map((raw,itemIndex)=>({item:normalizeIngredient(raw),index:itemIndex})).filter(({item,index:itemIndex})=>item&& (index===0?!((checkedIngredients[activeRecipe.id]||[]).includes(itemIndex)):((checkedIngredients[activeRecipe.id]||[]).includes(itemIndex))));return <section key={heading} className="overflow-hidden"><button type="button" onClick={()=>setIngredientSectionsCollapsed(previous=>({...previous,[sectionKey]:!previous[sectionKey]}))} aria-expanded={!isCollapsed} className="flex w-full items-center justify-between bg-[#f6f1e7] px-4 py-3 text-left hover:bg-[#f1ead9]"><span className="flex items-center gap-2 font-serif text-xl font-bold text-[#45644e]"><span className="grid size-8 place-items-center rounded-full bg-[#e6efe7] text-[#257F4B]">{index===0?<Plus size={16}/>:<Check size={16}/>}</span>{heading}<span className="text-sm font-sans font-medium text-[#8a9187]">({items.length})</span></span><span className="grid size-8 place-items-center text-[#45644e]" aria-hidden="true">{isCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span></button>{!isCollapsed&&<div className="space-y-1 p-2">{items.map(({item,index:itemIndex})=>{if(!item)return null;const amount=item.amount*(servings[activeRecipe.id]||4)/(activeRecipe.serves||4);const phrase=formatIngredientPhrase(item,amount);const done=(checkedIngredients[activeRecipe.id]||[]).includes(itemIndex);return <label key={itemIndex} className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-xl leading-relaxed transition sm:text-base ${done?"text-[#9a9f9b] line-through":"text-[#1f3529] hover:bg-[#f5f0e6]"}`}><Checkbox className="size-6 shrink-0 sm:size-5" checked={done} onCheckedChange={()=>toggleIngredientDone(activeRecipe.id,itemIndex)} aria-label={`${done?"Uncheck":"Check off"} ${phrase}`}/><span className="min-w-0 flex-1">{phrase}</span></label>})}{!items.length&&<p className="rounded-xl border border-dashed border-[#cfc5b2] p-5 text-sm text-[#6d786f]">{index===0?"Everything is marked used.":"Used ingredients will appear here."}</p>}</div>}</section>})}</div>}</section>
                : <section className="min-w-0"><h3 className="font-serif text-2xl font-bold">Directions</h3>{activeRecipe.directions?.length?<>
                  <ol className="mt-5 space-y-2">{activeRecipe.directions.map((step,index)=>{const done=completedSteps.includes(index);const text=directionText(step);const image=directionImage(step);return <li key={index}><button onClick={()=>toggleStepDone(index)} className={`flex w-full min-w-0 flex-wrap items-start gap-3 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35 ${done?"border-[#bcd6c1] bg-[#eaf3ea]":"border-[#ddd4c3] bg-[#fffdf8] hover:border-[#bcd6c1] hover:bg-[#f5f8f4]"}`}><span className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${done?"bg-[#257F4B]":"border-2 border-[#9aa69c] bg-transparent text-transparent"}`}>{done&&<Check size={16}/>}</span><span className="min-w-0 flex-1"><p className={`text-lg leading-relaxed sm:text-base ${done?"text-[#78907c] line-through":"text-[#1f3529]"}`}>{text}</p>{image&&<img src={image} alt="" className="mt-3 max-h-72 w-full rounded-xl object-cover" />}</span></button></li>})}</ol>
                  {completedSteps.length===activeRecipe.directions.length&&<div className="mt-6 rounded-2xl border border-[#bcd6c1] bg-[#eaf3ea] p-5 text-center"><Check className="mx-auto mb-2 text-[#257F4B]"/><p className="font-semibold text-[#244832]">All steps done — enjoy!</p></div>}
                </>:<p className="mt-4 rounded-xl bg-[#f2ecdf] p-4 text-sm text-[#6d786f]">Directions weren’t included with this saved recipe. Re-import it from its recipe page to add them.</p>}</section>}
            </div>
          </div>
        </div>
      </article> : <><Tabs value={view} onValueChange={changeView}>
      {view!=="recipes"&&<header className="relative -mx-4 -mt-6 mb-3 overflow-hidden rounded-none sm:mx-0 sm:mt-0 sm:rounded-[1.75rem]">
        <div className="absolute inset-0" aria-hidden="true">{headerImages.map((src,i)=><img key={src+i} src={src} alt="" className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${i===headerImageIndex?"opacity-100":"opacity-0"}`}/>)}</div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#172c20]/70 via-[#172c20]/55 to-[#172c20]/35" aria-hidden="true"/>
        <div className="relative flex flex-col gap-4 px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div className="pr-24 sm:pr-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d5e7d8]">Cameron Family Table</p>
            <h2 className="mt-1 min-h-[5.625rem] font-serif text-2xl font-medium leading-tight transition-opacity duration-500 sm:min-h-[7.03125rem] sm:text-3xl lg:min-h-[8.4375rem] lg:text-4xl">{headerTagline}</h2>
          </div>
          <Button type="button" onClick={()=>goAway("recipes")} className="absolute right-4 top-4 z-10 flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-full border-0 bg-[#FF7060] p-0 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#ff5c48] sm:size-32 sm:gap-1.5"><BookOpen size={20} className="sm:hidden"/><BookOpen size={30} className="hidden sm:block"/><span>Recipes</span></Button>
        </div>
        <div className="relative flex items-stretch gap-2 px-5 py-3 sm:px-8">
          <Select value={view==="history"?"history":String(weekOffset)} onValueChange={value=>{if(value==="history"){goAway("history")}else{setWeekOffset(Number(value) as 0|1);if(view==="history")setView(preRecipesView)}}}><SelectTrigger aria-label="Choose planning week" className="data-[size=default]:h-11 min-w-0 shrink rounded-lg border-0 bg-[#257F4B] px-3 text-sm font-semibold text-white shadow-none [&_svg]:!text-white sm:shrink-0">{view==="history"?<HistoryIcon size={16} className="hidden shrink-0 text-white sm:block"/>:<CalendarDays size={16} className="hidden shrink-0 text-white sm:block"/>}<SelectValue className="truncate">{view==="history"?"History":<><span className="sm:hidden">{weekLabelShort}</span><span className="hidden sm:inline">{weekLabel}</span></>}</SelectValue></SelectTrigger><SelectContent position="popper" sideOffset={4} align="start" className="min-w-56 rounded-xl border-0 bg-white p-2 shadow-lg">{[0,1].map(offset=><SelectItem key={offset} value={String(offset)} className="rounded-lg py-2.5 pl-3 text-base">{offset===0?"This week":"Next week"} · {weekRange(offset as 0|1)}</SelectItem>)}<SelectItem value="history" className="rounded-lg py-2.5 pl-3 text-base">History</SelectItem></SelectContent></Select>
          <TabsList className="flex !h-11 flex-none items-stretch gap-0 overflow-hidden rounded-lg border-0 bg-white/15 p-0 shadow-none backdrop-blur-sm">
            {nav.map(({value,label,icon:Icon})=><TabsTrigger key={value} value={value} className="relative flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-0 bg-transparent px-4 text-xs font-semibold text-white/80 shadow-none transition first:rounded-l-md last:rounded-r-md hover:bg-white/10 hover:text-white data-[state=active]:bg-[#257F4B] data-[state=active]:text-white data-[state=active]:shadow-none sm:px-5 sm:text-sm"><Icon size={16} className="hidden shrink-0 sm:block"/><span>{label}</span>{value==="plan"&&selected.length>0&&<b className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-bold leading-none text-white">{selected.length}</b>}</TabsTrigger>)}
          </TabsList>
        </div>
      </header>}
        {view==="recipes"
          ? <div className="mb-4 flex items-center justify-between gap-2 pb-2 pt-4 sm:pt-3">
              <BackButton onClick={()=>setView(preRecipesView)}/>
              <div className="flex items-center gap-2">
                <Button onClick={()=>{resetAdd();setOpen(true)}} variant="outline" aria-label="Add a recipe" className="h-12 shrink-0 rounded-xl border-[#d9d5cc] bg-white px-4 text-sm font-semibold text-[#45644e] shadow-none transition-colors hover:bg-[#257F4B] hover:text-white sm:h-9"><Plus size={18}/>Add recipe</Button>
                {searchOpen
                  ? <div className="relative flex min-w-0 flex-1 items-center sm:w-56 sm:flex-none">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#526158]" size={17}/>
                      <Input autoFocus className="h-11 w-full rounded-lg border-[#d9d5cc] bg-white pl-9 pr-9 shadow-none sm:h-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or cuisine" onBlur={()=>{if(!query)setSearchOpen(false)}}/>
                      <button type="button" aria-label="Close search" onClick={()=>{setQuery("");setSearchOpen(false)}} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#6d786f] hover:bg-[#f0ede4]"><X size={16}/></button>
                    </div>
                  : <Button type="button" variant="outline" aria-label="Search recipes" onClick={()=>setSearchOpen(true)} className="size-11 shrink-0 rounded-lg border-[#d9d5cc] bg-white p-0 text-[#45644e] shadow-none sm:size-9"><Search size={18}/></Button>
                }
              </div>
            </div>
          : null}
        {view==="recipes"&&tagFilter&&<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#c9d6cb] bg-[#edf3ee] px-4 py-3 text-sm text-[#45644e]"><span>Showing <strong>{tagFilter}</strong> recipes</span><button type="button" onClick={()=>setTagFilter("")} className="font-bold underline underline-offset-2">Show all</button></div>}


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
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#526158]" size={17}/>
                      <Input autoFocus className="h-11 w-full rounded-lg border-[#d9d5cc] bg-white pl-9 pr-9 shadow-none sm:h-9" value={planQuery} onChange={e=>setPlanQuery(e.target.value)} placeholder="Search by name or cuisine" onBlur={()=>{if(!planQuery)setPlanSearchOpen(false)}}/>
                      <button type="button" aria-label="Close search" onClick={()=>{setPlanQuery("");setPlanSearchOpen(false)}} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#6d786f] hover:bg-[#f0ede4]"><X size={16}/></button>
                    </div>
                  : <Button type="button" variant="outline" aria-label="Search recipes" onClick={()=>setPlanSearchOpen(true)} className="size-11 shrink-0 rounded-lg border-[#d9d5cc] bg-white p-0 text-[#45644e] shadow-none sm:size-9"><Search size={18}/></Button>
                }
              </div>
              {recipeGrid(recipes.filter(r=>recipeMatchesQuery(r,planQuery,"")))}
            </div>
          : <div>{orderedSelectedRecipes.length?planRecipeGrid(orderedSelectedRecipes):null}{selected.length>0&&<Button type="button" variant="outline" onClick={()=>setPlanPicking(true)} className="mt-4 w-full rounded-2xl border-dashed border-[#c9d6cb] bg-transparent py-6 text-[#45644e] shadow-none hover:bg-[#f2f5f1] hover:text-[#244832]"><Plus size={18}/>Add another recipe</Button>}{selected.length===0&&<div role="button" tabIndex={0} onClick={()=>setPlanPicking(true)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPlanPicking(true)}}} className="cursor-pointer rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center transition hover:border-[#9fae9e] hover:bg-[#f2f5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35"><ChefHat className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Choose recipes to plan {weekOffset===0?"this week":"next week"}.</p></div>}</div>}</TabsContent>

        <TabsContent value="shop">
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[#f2ecdf] p-1" role="tablist" aria-label="Shopping list source">
            <button type="button" role="tab" aria-selected={shopTab==="meals"} onClick={()=>setShopTab("meals")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${shopTab==="meals"?"bg-white text-[#257F4B] shadow-sm":"text-[#6d786f] hover:text-[#244832]"}`}>From meals</button>
            <button type="button" role="tab" aria-selected={shopTab==="global"} onClick={()=>setShopTab("global")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${shopTab==="global"?"bg-white text-[#257F4B] shadow-sm":"text-[#6d786f] hover:text-[#244832]"}`}>Global</button>
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
                        <section key={cat} className="min-w-0 w-full overflow-hidden rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] shadow-[0_2px_10px_rgba(45,61,50,.04)]">
                          <button type="button" onClick={()=>setCollapsed(prev=>({...prev,[cat]:!prev[cat]}))} aria-expanded={!collapsed[cat]} aria-controls={`cat-${cat}`} className="flex w-full items-center justify-between border-b border-[#ebe6dc] bg-[#f6f1e7] px-3 py-1.5 text-left hover:bg-[#f1ead9] sm:px-4 sm:py-3">
                            <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-[#45644e]">{cat}</h3>
                            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md text-[#45644e] sm:size-8">{collapsed[cat]?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span>
                          </button>
                          <div id={`cat-${cat}`} className={collapsed[cat]?"hidden p-1 sm:p-2":"p-1 sm:p-2"}>
                            {items.map(i=>{const key=`${i.name.toLowerCase()}|${i.unit.toLowerCase()}|${i.category}`;const done=syncedChecked.includes(key);const phrase=formatIngredientPhrase(i);return (
                              <label key={key} className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl px-1 py-1.5 sm:gap-3.5 sm:px-2 sm:py-3 ${done?"text-[#9a9f9b] line-through":"hover:bg-[#f5f0e6]"}`}>
                                <Checkbox className="mt-1 size-5 shrink-0 sm:mt-1 sm:size-4" checked={done} onCheckedChange={()=>toggleShoppingItemSync(key,!done)}/>
                                <span className="min-w-0 flex-1 text-base leading-normal text-[#1f3529] sm:text-base sm:leading-relaxed">{phrase}</span>
                              </label>
                            )})}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div> : <div role="button" tabIndex={0} onClick={()=>goAway("recipes")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();goAway("recipes")}}} className="cursor-pointer rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center transition hover:border-[#9fae9e] hover:bg-[#f2f5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#257F4B]/35"><ShoppingBasket className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Add meals to build your shopping list.</p></div>) : <div className="space-y-6">
                <div className="flex gap-2">
                  <Input value={globalItemText} onChange={event=>setGlobalItemText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();addGlobalItem()}}} placeholder="Add a task or item" aria-label="Global shopping task" className="bg-white"/>
                  <Button type="button" onClick={addGlobalItem} disabled={!globalItemText.trim()||savingGlobalItem} className="shrink-0 bg-[#257F4B] text-white hover:bg-[#1f6b3f]">{savingGlobalItem?"Adding…":"Add a task"}</Button>
                </div>
                {globalItemError&&<p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{globalItemError}</p>}
                {(["To get","Completed"] as const).map((heading,index)=>{
                  const sectionKey=index===0?"toGet":"completed";
                const items=globalItems.filter(item=>index===0?!item.checked:item.checked);
                  const isCollapsed=globalSectionsCollapsed[sectionKey];
                  return <section key={heading} className="overflow-hidden rounded-2xl border border-[#ddd4c3] bg-[#fffdf8]">
                    <button type="button" onClick={()=>setGlobalSectionsCollapsed(previous=>({...previous,[sectionKey]:!previous[sectionKey]}))} aria-expanded={!isCollapsed} className="flex w-full items-center justify-between bg-[#f6f1e7] px-4 py-3 text-left hover:bg-[#f1ead9]">
                      <span className="flex items-center gap-2 font-serif text-xl font-bold text-[#45644e]"><span className="grid size-8 place-items-center rounded-full bg-[#e6efe7] text-[#257F4B]">{index===0?<Plus size={16}/>:<Check size={16}/>}</span>{heading}<span className="text-sm font-sans font-medium text-[#8a9187]">({items.length})</span></span>
                      <span className="grid size-8 place-items-center text-[#45644e]" aria-hidden="true">{isCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span>
                    </button>
                    {!isCollapsed&&<div className="space-y-2 p-2">{items.map(item=><div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] px-3 py-3 shadow-[0_2px_10px_rgba(45,61,50,.04)]"><Checkbox className="size-6 shrink-0 sm:size-5" checked={item.checked} onCheckedChange={()=>toggleGlobalItem(item)} aria-label={`${item.checked?"Uncheck":"Complete"} ${item.ingredient_name}`}/><span className={`min-w-0 flex-1 text-lg leading-relaxed ${item.checked?"text-[#8a9187] line-through":"text-[#1f3529]"}`}>{globalItemPhrase(item)}</span><button type="button" onClick={()=>removeGlobalItem(item)} aria-label={`Remove ${item.ingredient_name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[#78907c] hover:bg-[#fbe9e2] hover:text-[#a33f32]"><X size={16}/></button></div>)}{!items.length&&<p className="rounded-2xl border border-dashed border-[#cfc5b2] p-5 text-sm text-[#6d786f]">{index===0?"Everything is checked off.":"Completed items will appear here."}</p>}</div>}
                  </section>
                })}
              </div>}
          </TabsContent>

        <TabsContent value="history"><div className="space-y-4">{history.map(week=><article key={week.id} className="rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9a735e]">Meal plan</p><h3 className="font-serif text-xl font-bold">{week.label}</h3></div><span className="text-xs text-[#778078]">Saved {new Date(week.savedAt).toLocaleDateString()}</span></div><div className="grid gap-2 sm:grid-cols-2">{week.meals.map(meal=><div key={meal.id} className="flex items-center gap-3 rounded-xl bg-[#f3ede1] p-3"><span className="text-2xl">{meal.emoji}</span><div className="min-w-0"><p className="truncate font-medium">{meal.title}</p><p className="text-xs text-[#6d786f]">{meal.day?`${meal.day} · `:""}For {meal.people} people{meal.chef?` · Chef ${meal.chef}`:""}</p></div></div>)}</div></article>)}{!history.length&&<div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center"><HistoryIcon className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">No completed weeks yet.</p><p className="mt-1 text-sm text-[#6d786f]">A week will appear here automatically after it ends.</p></div>}</div></TabsContent>
      </Tabs>
      </>}
    </div>
    <button type="button" onClick={hardRefresh} disabled={syncing} aria-label="Refresh app" title="Refresh app" className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-[#257F4B] text-white shadow-lg transition-colors hover:bg-[#1f6b3f] disabled:opacity-60"><RefreshCw size={20} className={syncing?"animate-spin":""}/></button>
    <AlertDialog open={!!recipeToDelete} onOpenChange={value=>{if(!value)setRecipeToDelete(null)}}><AlertDialogContent className="bg-[#fffdf8]"><AlertDialogHeader><AlertDialogTitle>Delete “{recipeToDelete?.title}”?</AlertDialogTitle><AlertDialogDescription>This removes the recipe from your collection, this week’s plan, and the shopping list. Previously saved week history will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep recipe</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>recipeToDelete&&deleteRecipe(recipeToDelete.id)}>Delete recipe</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
