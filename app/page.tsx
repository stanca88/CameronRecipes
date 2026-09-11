"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeft, BookOpen, CalendarDays, Check, ChefHat, ChevronDown, ChevronUp, History as HistoryIcon, Minus, MoreHorizontal, Pencil, Plus, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeToShoppingList, saveShoppingList, toggleShoppingItem, subscribeToWeeklyPlan, saveWeeklyPlan, fetchWeeklyPlan, subscribeToHistory, fetchHistory, saveHistoryWeek } from "@/app/lib/realtime";

type Ingredient = { name: string; amount: number; unit: string; category: string };
type Recipe = { id: string; title: string; emoji: string; time: string; serves: number; author: string; ingredients: Ingredient[]; image?: string; directions?: string[]; sourceUrl?: string; sourceName?: string };
type WeeklyPlan = { selected: string[]; servings: Record<string,number>; checked: string[]; chefs: Record<string,string>; days: Record<string,string> };
type SavedWeek = { id: string; label: string; savedAt: string; meals: { id: string; title: string; emoji: string; people: number; chef?: string; day?: string }[] };
type ShoppingItem = { id: string; ingredient_key: string; ingredient_name: string; ingredient_amount: number; ingredient_unit: string; ingredient_category: string; checked: boolean };

const starterRecipes: Recipe[] = [
  {id:"roasted-veg-bowl",title:"Roasted Vegetable Grain Bowl",emoji:"🥗",time:"35 min",serves:4,author:"Maria",image:"/veg-bowl.jpg",ingredients:[
    {name:"quinoa",amount:1,unit:"cup",category:"Pantry"},{name:"sweet potato",amount:2,unit:"",category:"Produce"},{name:"chickpeas",amount:1,unit:"can",category:"Pantry"},{name:"spinach",amount:3,unit:"cups",category:"Produce"},{name:"feta",amount:4,unit:"oz",category:"Dairy"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Roast cubed sweet potato and chickpeas at 425°F until golden.","Cook quinoa per package instructions.","Toss quinoa with roasted veg, spinach, feta, olive oil, lemon, salt, and pepper."]},
  {id:"lemon-herb-chicken",title:"Lemon Herb Chicken",emoji:"🍗",time:"40 min",serves:4,author:"Dad",image:"/lemon-chicken.jpg",ingredients:[
    {name:"chicken breasts",amount:4,unit:"",category:"Meat"},{name:"lemons",amount:2,unit:"",category:"Produce"},{name:"garlic cloves",amount:3,unit:"",category:"Produce"},{name:"olive oil",amount:2,unit:"tbsp",category:"Pantry"},{name:"rosemary",amount:1,unit:"tsp",category:"Pantry"}],directions:["Marinate chicken with lemon, garlic, olive oil, rosemary, salt, and pepper.","Roast at 425°F for 25–30 minutes until cooked through.","Rest 5 minutes before serving."]},
  {id:"beef-stew",title:"Hearty Beef Stew",emoji:"🥘",time:"2 hr",serves:6,author:"Dad",image:"/beef-stew.jpg",ingredients:[
    {name:"beef chuck",amount:2,unit:"lb",category:"Meat"},{name:"carrots",amount:3,unit:"",category:"Produce"},{name:"potatoes",amount:3,unit:"",category:"Produce"},{name:"onion",amount:1,unit:"",category:"Produce"},{name:"beef broth",amount:4,unit:"cups",category:"Pantry"},{name:"tomato paste",amount:2,unit:"tbsp",category:"Pantry"}],directions:["Brown beef in batches, set aside.","Sauté onion, add carrots and potato, then return beef to pot.","Add broth and tomato paste, simmer covered 1.5–2 hours until beef is tender."]}
];

function weekStart(offset = 0, date = new Date()) {
  const start = new Date(date); const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
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

function weekRangeFromKey(key:string) {
  const [year,month,day]=key.split("-").map(Number);
  const start=new Date(year,month-1,day);
  const end=new Date(start); end.setDate(start.getDate()+6);
  const left=start.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const right=end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  return `${left} – ${right}`;
}

const CUISINE_RULES:{label:string;pattern:RegExp}[]=[
  {label:"Mexican",pattern:/taco|burrito|enchilada|quesadilla|salsa|guacamole|tortilla|fajita|chorizo|carnitas|pico de gallo|elote|tamale|mole\b/i},
  {label:"Italian",pattern:/pasta|spaghetti|lasagna|risotto|parmesan|marinara|pesto|bolognese|carbonara|ravioli|gnocchi|pizza|italian/i},
  {label:"Japanese",pattern:/sushi|teriyaki|ramen|miso|tempura|udon|edamame|soy sauce|wasabi|japanese/i},
  {label:"Chinese",pattern:/stir.?fry|kung pao|fried rice|dumpling|hoisin|szechuan|lo mein|chow mein|wonton|chinese/i},
  {label:"Thai",pattern:/pad thai|thai|curry paste|coconut curry|satay|tom yum/i},
  {label:"Indian",pattern:/curry|tikka|masala|naan|paneer|tandoori|biryani|dal\b|indian/i},
  {label:"Mediterranean",pattern:/hummus|falafel|tzatziki|pita|tabbouleh|shawarma|gyro|mediterranean/i},
  {label:"Greek",pattern:/greek|feta|tzatziki|souvlaki/i},
  {label:"French",pattern:/french|baguette|croissant|ratatouille|quiche|béchamel|bechamel/i},
  {label:"Korean",pattern:/kimchi|bulgogi|gochujang|korean/i},
  {label:"American",pattern:/burger|bbq|barbecue|meatloaf|mac and cheese|mac & cheese|casserole|chili\b|cornbread|pot pie|american/i},
];

function cuisineFor(recipe:Recipe):string|null {
  const haystack=[recipe.title,...(recipe.ingredients||[]).map(i=>i.name)].join(" ");
  for(const rule of CUISINE_RULES){
    if(rule.pattern.test(haystack)) return rule.label;
  }
  return null;
}

function recipeMatchesQuery(recipe:Recipe, query:string) {
  const q=query.trim().toLowerCase();
  if(!q)return true;
  if(recipe.title.toLowerCase().includes(q))return true;
  const cuisine=cuisineFor(recipe);
  if(cuisine&&cuisine.toLowerCase().includes(q))return true;
  return false;
}

function categoryFor(name:string) {
  const value=name.toLowerCase();
  if(/chicken|beef|turkey|pork|sausage|bacon|salmon|shrimp|fish/.test(value)) return "Meat & seafood";
  if(/milk|cheese|cream|yogurt|butter|egg/.test(value)) return "Dairy & eggs";
  if(/bread|tortilla|bun|roll|pita/.test(value)) return "Bakery";
  if(/tomato|onion|garlic|pepper|lettuce|lemon|lime|potato|cucumber|apple|carrot|celery|herb|parsley|basil|cilantro/.test(value)) return "Produce";
  return "Pantry";
}

function ingredientLineFor(item:Ingredient) {
  const amount=Math.round(item.amount*100)/100;
  const parts=[amount?String(amount):"",item.unit,item.name].filter(Boolean);
  return parts.join(" ");
}

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
  let amount=Number.isFinite(Number(item.amount))?Number(item.amount):1;
  let unit=typeof item.unit==="string"?item.unit:"";
  if(unit.toLowerCase()==="l"&&/^arge\b/i.test(name)){name=`l${name}`;unit=""}
  const trailingFraction=name.match(/^(?:(\d+)\/|\/)(\d+)\s+(.+)$/);
  if(trailingFraction){amount+=Number(trailingFraction[1]||1)/Number(trailingFraction[2]);name=trailingFraction[3]}
  return {name,amount,unit,category:typeof item.category==="string"&&item.category?item.category:categoryFor(name)};
}

function parseIngredientLine(line:string):Ingredient {
  const clean=line.trim();
  const normalized=clean.replace(/^½/,"1/2 ").replace(/^¼/,"1/4 ").replace(/^¾/,"3/4 ").replace(/^⅓/,"1/3 ").replace(/^⅔/,"2/3 ");
  const match=normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+(?:(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kg|ml|liters?|l)\b\s*)?(.*)$/i);
  if(!match)return{name:clean,amount:1,unit:"",category:categoryFor(clean)};
  const rawAmount=match[1]; const amount=rawAmount.split(/\s+/).reduce((total,part)=>{if(!part.includes("/"))return total+Number(part);const [top,bottom]=part.split("/").map(Number);return total+top/bottom},0);
  const name=(match[3]||clean).replace(/^of\s+/i,"").trim();
  return{name,amount,unit:match[2]||"",category:categoryFor(name)};
}

export default function Home() {
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [weekOffset,setWeekOffset]=useState<0|1>(0);
  const [plans,setPlans]=useState<Record<string,WeeklyPlan>>({[weekKey(0)]:{selected:["roasted-veg-bowl","lemon-herb-chicken"],servings:{"roasted-veg-bowl":4,"lemon-herb-chicken":4},checked:[],chefs:{},days:{}}});
  const [history,setHistory]=useState<SavedWeek[]>([]);
  const [query,setQuery]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [url,setUrl]=useState("");
  const [ingredients,setIngredients]=useState("");
  const [directions,setDirections]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [editingRecipeId,setEditingRecipeId]=useState<string|null>(null);
  const [activeRecipe,setActiveRecipe]=useState<Recipe|null>(null);
  const [recipeToDelete,setRecipeToDelete]=useState<Recipe|null>(null);
  const [ingredientsCollapsed,setIngredientsCollapsed]=useState(false);
  const [completedSteps,setCompletedSteps]=useState<number[]>([]);
  const [addMode,setAddMode]=useState<"url"|"review"|"manual">("url");
  const [importing,setImporting]=useState(false);
  const [importError,setImportError]=useState("");
  const [saveError,setSaveError]=useState("");
  const [savingRecipe,setSavingRecipe]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const [loaded,setLoaded]=useState(false);
  const [view,setView]=useState("plan");
  const [preRecipesView,setPreRecipesView]=useState("plan");
  const [planPicking,setPlanPicking]=useState(false);
  const [planQuery,setPlanQuery]=useState("");
  const [planSearchOpen,setPlanSearchOpen]=useState(false);
  useEffect(()=>{if(view!=="recipes"){setSearchOpen(false);setQuery("")}},[view]);
  useEffect(()=>{if(view!=="plan"){setPlanPicking(false);setPlanQuery("");setPlanSearchOpen(false)}},[view]);
  const [syncing,setSyncing]=useState(false);
  const [shoppingItems,setShoppingItems]=useState<ShoppingItem[]>([]);
  const [planSynced,setPlanSynced]=useState<Record<string,boolean>>({});
  const [recipesLoaded,setRecipesLoaded]=useState(false);
  const unsubscribeRef=useRef<(() => void)|null>(null);
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
  const orderedSelectedRecipes=useMemo(()=>recipes.filter(r=>selected.includes(r.id)).sort((a,b)=>dayOrderIndex(days[a.id])-dayOrderIndex(days[b.id])),[recipes,selected,days]);
  const weekLabel=weekRange(weekOffset);
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

  useEffect(()=>{try{const params=new URLSearchParams(window.location.search);if(params.get("resetLocal")==="1"){localStorage.removeItem("cameron-family-table");params.delete("resetLocal");const newUrl=window.location.pathname+(params.toString()?"?"+params.toString():"");window.history.replaceState({},"",newUrl);}const raw=localStorage.getItem("cameron-family-table");if(raw){const s=JSON.parse(raw);setHistory(s.history||[]);setPlans(s.plans||{[weekKey(0)]:{selected:s.selected||[],servings:s.servings||Object.fromEntries((s.selected||[]).map((id:string)=>[id,4])),checked:s.checked||[],chefs:{},days:{}}})}}finally{setLoaded(true);loadSharedRecipes()}},[]);
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
  const loadSharedRecipes=async()=>{try{const response=await fetch("/api/recipes");if(!response.ok)return false;const {recipes:shared}=await response.json();if(Array.isArray(shared)){const normalized=shared.map((r:any)=>({...r,sourceUrl:r.sourceUrl||r.source_url||undefined,sourceName:r.sourceName||r.source_name||undefined,ingredients:Array.isArray(r.ingredients)?r.ingredients.map((i:any)=>normalizeIngredient(i)).filter((i:Ingredient|null):i is Ingredient=>i!==null):[],directions:Array.isArray(r.directions)?r.directions.filter((d:any):d is string=>typeof d==="string"):[]}));setRecipes(normalized);setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>[key,{...plan,selected:plan.selected.filter(id=>normalized.some(recipe=>recipe.id===id)),servings:Object.fromEntries(Object.entries(plan.servings).filter(([id])=>normalized.some(recipe=>recipe.id===id))),checked:plan.checked,chefs:Object.fromEntries(Object.entries(plan.chefs||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id))),days:Object.fromEntries(Object.entries(plan.days||{}).filter(([id])=>normalized.some(recipe=>recipe.id===id)))}])));setRecipesLoaded(true);return true}return false}catch(e){console.error("Failed to load shared recipes:",e);return false}};
  const syncNow=async()=>{setSyncing(true);try{const hasShared=await loadSharedRecipes();if(hasShared){const response=await fetch(`/api/shopping?week_key=${encodeURIComponent(activeWeekKey)}`);if(response.ok){const {items}=await response.json();if(Array.isArray(items))setShoppingItems(items)}}return hasShared}finally{setSyncing(false)}};
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
      const i=/^cups?$/i.test(normalized.unit.trim())?{...normalized,amount:normalized.amount*8,unit:"oz"}:normalized;
      const key=`${i.name.toLowerCase()}|${i.unit.toLowerCase()}|${i.category}`; const old=items.get(key); const people=servings[r.id]||4;
      items.set(key,{...i,amount:(old?.amount||0)+(i.amount*people/(r.serves||4))});
    })); return [...items.values()].sort((a,b)=>a.category.localeCompare(b.category));
  },[recipes,selected,servings]);
  const categories=[...new Set(grocery.map(i=>i.category))];
  const syncedChecked=useMemo(()=>{const localSet=new Set(checked);const syncedKeys=new Set(shoppingItems.filter(s=>s.checked).map(s=>s.ingredient_key));return Array.from(new Set([...localSet,...syncedKeys]));},[checked,shoppingItems]);
  const grocerySignature=useMemo(()=>JSON.stringify(grocery.map(g=>[g.name.toLowerCase(),g.unit.toLowerCase(),g.category,Math.round(g.amount*100)])),[grocery]);
  const lastSavedGrocerySignatureRef=useRef<Record<string,string>>({});
  useEffect(()=>{
    if(!loaded||grocery.length===0)return;
    if(lastSavedGrocerySignatureRef.current[activeWeekKey]===grocerySignature)return;
    (async()=>{
      try{
        const items=grocery.map(g=>({ingredient_key:`${g.name.toLowerCase()}|${g.unit.toLowerCase()}|${g.category}`,ingredient_name:g.name,ingredient_amount:g.amount,ingredient_unit:g.unit,ingredient_category:g.category}));
        await saveShoppingList(activeWeekKey,items);
        lastSavedGrocerySignatureRef.current[activeWeekKey]=grocerySignature;
      }catch(e){console.error("Failed to save shopping list:",e)}
    })();
  },[grocery,activeWeekKey,loaded]);
  useEffect(()=>{
    if(!loaded)return;
    if(unsubscribeRef.current)unsubscribeRef.current();
    unsubscribeRef.current=subscribeToShoppingList(activeWeekKey,(items:ShoppingItem[])=>setShoppingItems(items));
    return()=>{if(unsubscribeRef.current)unsubscribeRef.current()};
  },[activeWeekKey,loaded]);
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
  const openRecipe=(recipe:Recipe)=>{setActiveRecipe(recipe);setIngredientsCollapsed(false);setCompletedSteps([]);window.scrollTo({top:0,behavior:"smooth"})};
  const toggleStepDone=(index:number)=>{setCompletedSteps(prev=>prev.includes(index)?prev.filter(i=>i!==index):[...prev,index])};
  const parsedIngredients=()=>ingredients.split("\n").filter(Boolean).map(parseIngredientLine);
  const resetAdd=()=>{setTitle("");setUrl("");setIngredients("");setDirections("");setImageUrl("");setSourceName("");setAddMode("url");setImportError("");setImporting(false);setEditingRecipeId(null)};
  const openEditRecipe=(recipe:Recipe)=>{setEditingRecipeId(recipe.id);setTitle(recipe.title);setUrl(recipe.sourceUrl||"");setSourceName(recipe.sourceName||"");setImageUrl(recipe.image||"");setIngredients((recipe.ingredients||[]).map(ingredientLineFor).join("\n"));setDirections((recipe.directions||[]).join("\n"));setAddMode("manual");setSaveError("");setOpen(true)};
  const saveRecipe=async()=>{if(!title.trim())return;setSavingRecipe(true);setSaveError("");
    if(editingRecipeId){
      const id=editingRecipeId;
      const updated={title:title.trim(),ingredients:parsedIngredients(),directions:directions.split("\n").filter(Boolean).map(x=>x.trim()),image:imageUrl||undefined,source_url:url||undefined,source_name:sourceName||undefined};
      try{const response=await fetch(`/api/recipes/${id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(updated)});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe changes")}const saved=await syncNow();if(saved){resetAdd();setOpen(false);setActiveRecipe(prev=>prev&&prev.id===id?{...prev,title:updated.title,ingredients:updated.ingredients,directions:updated.directions,image:updated.image,sourceUrl:updated.source_url,sourceName:updated.source_name}:prev)}else{throw new Error("Could not refresh recipes after saving.")}}catch(error){setSaveError(error instanceof Error?error.message:"Failed to save recipe changes");console.error("Failed to save recipe changes:",error)}finally{setSavingRecipe(false)}
      return;
    }
    const id=crypto.randomUUID();const newRecipe={id,title:title.trim(),emoji:"🍽️",time:"Family recipe",serves:4,author:"Family",ingredients:parsedIngredients(),directions:directions.split("\n").filter(Boolean).map(x=>x.trim()),image:imageUrl||undefined,sourceUrl:url||undefined,sourceName:sourceName||undefined};try{const response=await fetch("/api/recipes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,title:newRecipe.title,emoji:newRecipe.emoji,time:newRecipe.time,serves:newRecipe.serves,author:newRecipe.author,ingredients:newRecipe.ingredients,directions:newRecipe.directions,image:newRecipe.image,source_url:newRecipe.sourceUrl,source_name:newRecipe.sourceName})});if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error||"Failed to save recipe to database")}const saved=await syncNow();if(saved){setPlans(all=>{const plan=all[activeWeekKey]||emptyPlan();return{...all,[activeWeekKey]:{...plan,selected:[...plan.selected,id],servings:{...plan.servings,[id]:4},checked:plan.selected.length===0?[]:plan.checked}}});resetAdd();setOpen(false);setView("plan")}else{throw new Error("Could not refresh recipes after saving.")}}catch(error){setSaveError(error instanceof Error?error.message:"Failed to save recipe to database");console.error("Failed to save recipe to database:",error)}finally{setSavingRecipe(false)}};
  const importRecipe=async()=>{if(!url.trim())return;setImporting(true);setImportError("");try{const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});const data=await response.json();if(!response.ok)throw new Error(data.error||"We couldn't import that recipe.");setTitle(data.title||"");setIngredients((data.ingredients||[]).join("\n"));setDirections((data.directions||[]).join("\n"));setImageUrl(data.image||"");setSourceName(data.sourceName||"");setAddMode("review")}catch(error){setImportError(error instanceof Error?error.message:"We couldn't import that recipe.")}finally{setImporting(false)}};
  const deleteRecipe=async(id:string)=>{try{const response=await fetch(`/api/recipes/${id}`,{method:"DELETE"});if(!response.ok)throw new Error("Failed to delete recipe");await syncNow();setPlans(all=>Object.fromEntries(Object.entries(all).map(([key,plan])=>{const nextServings={...plan.servings};const nextChefs={...(plan.chefs||{})};const nextDays={...(plan.days||{})};delete nextServings[id];delete nextChefs[id];delete nextDays[id];return[key,{...plan,selected:plan.selected.filter(recipeId=>recipeId!==id),servings:nextServings,chefs:nextChefs,days:nextDays}]})));setActiveRecipe(null)}catch(error){console.error("Failed to delete recipe from database:",error)}};
  const toggleShoppingItemSync=async(itemKey:string,shouldCheck:boolean)=>{setChecked(v=>shouldCheck?[...v,itemKey]:v.filter(x=>x!==itemKey));setShoppingItems(items=>items.map(si=>si.ingredient_key===itemKey?{...si,checked:shouldCheck}:si));const shoppingItem=shoppingItems.find(si=>si.ingredient_key===itemKey);if(shoppingItem){try{await toggleShoppingItem(shoppingItem.id,shouldCheck)}catch(error){console.error("Failed to sync shopping item:",error)}}};

  const nav=[{value:"plan",label:"Plan",icon:ChefHat},{value:"shop",label:"Shop",icon:ShoppingBasket}];
  const changeView=(v:string)=>{if(v!=="recipes"&&v!=="history")setPreRecipesView(v);setView(v)};
  const goAway=(v:string)=>{if(view!=="recipes"&&view!=="history")setPreRecipesView(view);setView(v)};
  const recipeGrid=(list:Recipe[])=><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.map(r=><article key={r.id} onClick={()=>openRecipe(r)} className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white transition ${selected.includes(r.id)?"border-[#7ea087] shadow-[0_0_0_2px_rgba(65,98,75,.12)]":"border-[#e1ddd3] hover:-translate-y-1 hover:shadow-lg"}`}><div className="absolute left-3 top-3 z-10"><TooltipProvider><Tooltip><TooltipTrigger aria-label={selected.includes(r.id)?`Remove ${r.title} from ${weekRange(weekOffset)}`:`Add ${r.title} to ${weekRange(weekOffset)}`} onClick={event=>{event.stopPropagation();toggle(r.id)}} className={`grid size-11 place-items-center rounded-full border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35 sm:size-10 ${selected.includes(r.id)?"border-[#315d43] bg-[#315d43] text-white hover:bg-[#274d37]":"border-[#d8d5cd] bg-white/95 text-[#315d43] hover:bg-[#edf3ee]"}`}>{selected.includes(r.id)?<Check size={20}/>:<Plus size={21}/>}</TooltipTrigger><TooltipContent side="top" sideOffset={6} className="bg-[#1f3529] text-white">{selected.includes(r.id)?`Remove from ${weekRange(weekOffset)}`:`Add to ${weekRange(weekOffset)}`}</TooltipContent></Tooltip></TooltipProvider></div><div className="absolute right-3 top-3 z-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><DropdownMenu><DropdownMenuTrigger asChild><button onClick={event=>event.stopPropagation()} aria-label={`More actions for ${r.title}`} className="grid size-11 place-items-center rounded-lg border border-white/40 bg-white/40 text-[#304439] shadow-sm backdrop-blur-sm transition-colors hover:border-[#d8d5cd] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35 sm:size-10"><MoreHorizontal size={21}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-44 bg-white"><DropdownMenuItem onClick={event=>{event.stopPropagation();openEditRecipe(r)}}><Pencil/>Edit recipe</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={event=>{event.stopPropagation();setRecipeToDelete(r)}}><Trash2/>Delete recipe</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{(r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={r.image|| (r.id==="roasted-veg-bowl"?"/veg-bowl.jpg": r.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": r.id==="beef-stew"?"/beef-stew.jpg":"")} alt={r.title} className="h-44 w-full object-cover"/> : <div className="grid h-36 place-items-center bg-[#edf2eb] text-5xl">{r.emoji}</div>}<div className="min-w-0 p-5"><h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3>{(()=>{const cuisine=cuisineFor(r);return cuisine||r.sourceUrl?<div className="mt-1.5 flex flex-wrap items-center gap-2">{cuisine&&<span className="rounded-full bg-[#eef1e9] px-2 py-0.5 text-xs font-semibold text-[#45644e]">{cuisine}</span>}{r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-[#45644e] underline decoration-[#45644e]/35 underline-offset-2 hover:decoration-[#45644e]" onClick={event=>event.stopPropagation()}>{r.sourceName||"View original recipe"}</a>}</div>:<p className="mt-1 text-sm text-[#6d786f]">Family recipe</p>})()}</div></article>)}</div>;

  return <main className="min-h-screen bg-[#faf9f5] text-[#1f3529]" style={{scrollbarGutter:'stable'}}>
    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)resetAdd()}}><DialogContent className="bg-[#fffdf8]"><DialogHeader><DialogTitle>{editingRecipeId?"Edit recipe":addMode==="url"?"Add from a recipe link":addMode==="review"?"Review imported recipe":"Add a recipe manually"}</DialogTitle></DialogHeader>
        {addMode==="url"&&<div className="space-y-4"><p className="text-sm text-[#6d786f]">Paste a recipe link and we’ll fill in the title and ingredients for you.</p><Input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/favorite-recipe"/><Button className="w-full bg-[#45644e] text-white" disabled={!url.trim()||importing} onClick={importRecipe}>{importing?"Importing recipe…":"Import recipe"}</Button>{importError&&<p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{importError}</p>}<div className="flex items-center gap-3"><span className="h-px flex-1 bg-[#ddd4c3]"/><span className="text-xs text-[#7b837c]">or</span><span className="h-px flex-1 bg-[#ddd4c3]"/></div><Button variant="outline" className="w-full" onClick={()=>setAddMode("manual")}>Add manually</Button></div>}
        {addMode==="review"&&<div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">{imageUrl&&<img src={imageUrl} alt="Imported recipe" className="h-40 w-full rounded-2xl object-cover"/>}<div><label className="mb-1 block text-sm font-medium">Title</label><Input value={title} onChange={e=>setTitle(e.target.value)}/></div><div><label className="mb-1 block text-sm font-medium">Ingredients</label><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} rows={7}/></div><div><label className="mb-1 block text-sm font-medium">Directions</label><Textarea value={directions} onChange={e=>setDirections(e.target.value)} rows={7}/></div><p className="text-xs text-[#6d786f]">Everything is editable before you save it.</p>{saveError&&<p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{saveError}</p>}<Button className="w-full bg-[#45644e] text-white" disabled={savingRecipe} onClick={saveRecipe}>{savingRecipe?"Saving…":`Save and add to ${weekRange(weekOffset)}`}</Button><Button variant="ghost" className="w-full" onClick={()=>setAddMode("url")}>Use a different link</Button></div>}
        {addMode==="manual"&&<div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"><Input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Recipe name"/><Input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Image URL (optional)"/><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder={'One ingredient per line\n2 apples\n1 cup flour'} rows={7}/><Textarea value={directions} onChange={e=>setDirections(e.target.value)} placeholder={'One direction per line\nHeat oven to 375°F\nMix ingredients'} rows={7}/>{saveError&&<p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{saveError}</p>}<Button className="w-full bg-[#45644e] text-white" disabled={savingRecipe} onClick={saveRecipe}>{savingRecipe?"Saving…":editingRecipeId?"Save changes":`Save and add to ${weekRange(weekOffset)}`}</Button>{!editingRecipeId&&<Button variant="ghost" className="w-full" onClick={()=>setAddMode("url")}>Back to add from URL</Button>}</div>}
    </DialogContent></Dialog>

    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {activeRecipe ? <article>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="-ml-2 rounded-lg text-[#315d43] hover:bg-[#e8f0e8]" onClick={()=>setActiveRecipe(null)}><ArrowLeft size={18}/>Back</Button>
          <div className="flex flex-wrap gap-2"><Button onClick={()=>toggle(activeRecipe.id)} variant={selected.includes(activeRecipe.id)?"secondary":"default"} className={`rounded-lg ${selected.includes(activeRecipe.id)?"bg-[#e6efe7] text-[#244832] hover:bg-[#dce8de]":"bg-[#315d43] text-white hover:bg-[#274d37]"}`}>{selected.includes(activeRecipe.id)?<><Check/>Added to {weekRange(weekOffset)}</>:<><Plus/>Add to {weekRange(weekOffset)}</>}</Button><Button variant="outline" className="rounded-lg border-[#d8d5cd] bg-white text-[#315d43] hover:bg-[#edf3ee]" onClick={()=>openEditRecipe(activeRecipe)}><Pencil/>Edit</Button><Button variant="outline" className="rounded-lg border-[#d7a39a] bg-white text-[#a33f32] hover:bg-[#fbe9e2] hover:text-[#8c3025]" onClick={()=>setRecipeToDelete(activeRecipe)}><Trash2/>Delete</Button></div>
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-[#dedbd2] bg-white">
          {(activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")) ? <img src={activeRecipe.image || (activeRecipe.id==="roasted-veg-bowl"?"/veg-bowl.jpg": activeRecipe.id==="lemon-herb-chicken"?"/lemon-chicken.jpg": activeRecipe.id==="beef-stew"?"/beef-stew.jpg":"")} alt={activeRecipe.title} className="h-64 w-full object-cover sm:h-80 lg:h-[28rem]"/> : <div className="grid h-56 place-items-center bg-[#e8f0e8] text-8xl">{activeRecipe.emoji}</div>}
          <div className="p-6 sm:p-9 lg:p-12">
            <div className="border-b border-[#e8e3da] pb-8">
              {(()=>{const cuisine=cuisineFor(activeRecipe);return <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.2em]">{cuisine&&<span className="rounded-full bg-[#e6efe7] px-2.5 py-1 text-[#315d43]">{cuisine}</span>}{activeRecipe.sourceUrl?<a href={activeRecipe.sourceUrl} target="_blank" rel="noreferrer" className="text-[#477457] underline decoration-[#477457]/40 underline-offset-2 hover:decoration-[#477457]">{activeRecipe.sourceName||"View original recipe"}</a>:!cuisine&&<span className="text-[#477457]">Family recipe</span>}</div>})()}<h2 className="max-w-3xl font-serif text-3xl font-bold leading-tight sm:text-5xl">{activeRecipe.title}</h2>
              <div className="mt-6 flex max-w-md items-center justify-between rounded-2xl bg-[#f2ecdf] p-3"><span className="font-medium">Cooking for</span><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(activeRecipe.id,-1)}><Minus size={17} className="sm:hidden"/><Minus size={15} className="hidden sm:block"/></Button><strong className="min-w-20 text-center">{servings[activeRecipe.id]||4} people</strong><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(activeRecipe.id,1)}><Plus size={17} className="sm:hidden"/><Plus size={15} className="hidden sm:block"/></Button></div></div>
            </div>
            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
              <section className="min-w-0"><button onClick={()=>setIngredientsCollapsed(v=>!v)} aria-expanded={!ingredientsCollapsed} aria-controls="ingredients-list" className="flex w-full items-center justify-between gap-3 text-left"><h3 className="font-serif text-2xl font-bold">Ingredients</h3><span aria-label={ingredientsCollapsed?"Expand ingredients":"Collapse ingredients"} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d8d5cd] bg-white text-[#45644e] hover:bg-[#f1f4ef]">{ingredientsCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</span></button>{!ingredientsCollapsed&&<div id="ingredients-list" className="mt-4 divide-y divide-[#e8e0d1]">{(Array.isArray(activeRecipe.ingredients)?activeRecipe.ingredients:[]).map((raw,index)=>{const item=normalizeIngredient(raw);if(!item)return null;const amount=item.amount*(servings[activeRecipe.id]||4)/(activeRecipe.serves||4);return <div key={index} className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-4 py-3"><strong className="whitespace-nowrap text-[#45644e]">{Math.round(amount*100)/100} {item.unit}</strong><span className="min-w-0 leading-6">{item.name}</span></div>})}</div>}</section>
              <section className="min-w-0"><h3 className="font-serif text-2xl font-bold">Directions</h3>{activeRecipe.directions?.length?<>
                <p className="mt-2 text-sm text-[#6d786f]">Tap a step when you finish it to check it off while you cook.</p>
                <ol className="mt-5 space-y-4">{activeRecipe.directions.map((step,index)=>{const done=completedSteps.includes(index);return <li key={index}><button onClick={()=>toggleStepDone(index)} className={`flex w-full min-w-0 items-start gap-4 rounded-2xl border border-transparent p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35 ${done?"hover:bg-[#f5f8f4]":"hover:border-[#dbe4dc] hover:bg-[#f5f8f4]"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white ${done?"bg-[#c7d3c8]":"bg-[#45644e]"}`}>{done?<Check size={16}/>:index+1}</span><p className={`min-w-0 flex-1 pt-1 leading-7 ${done?"text-[#8a9187] line-through":""}`}>{step}</p></button></li>})}</ol>
                {completedSteps.length===activeRecipe.directions.length&&<div className="mt-6 rounded-2xl border border-[#bcd6c1] bg-[#eaf3ea] p-5 text-center"><Check className="mx-auto mb-2 text-[#315d43]"/><p className="font-semibold text-[#244832]">All steps done — enjoy!</p></div>}
              </>:<p className="mt-4 rounded-xl bg-[#f2ecdf] p-4 text-sm text-[#6d786f]">Directions weren’t included with this saved recipe. Re-import it from its recipe page to add them.</p>}</section>
            </div>
          </div>
        </div>
      </article> : <>
      {view!=="recipes"&&<header className="relative mb-6 overflow-hidden rounded-[1.75rem]">
        <div className="absolute inset-0" aria-hidden="true">{headerImages.map((src,i)=><img key={src+i} src={src} alt="" className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${i===headerImageIndex?"opacity-100":"opacity-0"}`}/>)}</div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#172c20]/70 via-[#172c20]/55 to-[#172c20]/35" aria-hidden="true"/>
        <div className="relative flex flex-col gap-4 px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d5e7d8]">Cameron Family Table</p>
            <h2 className="mt-1 font-serif text-2xl font-medium leading-tight transition-opacity duration-500 sm:text-3xl lg:text-4xl">{headerTagline}</h2>
          </div>
          <Button type="button" onClick={()=>goAway("recipes")} className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-white/40 bg-white/15 px-4 text-sm font-semibold text-white shadow-none backdrop-blur-sm transition-colors hover:bg-white hover:text-[#244832] sm:h-auto sm:w-28 sm:flex-col sm:justify-center sm:gap-2 sm:self-stretch sm:rounded-2xl sm:py-4"><BookOpen size={18} className="sm:hidden"/><BookOpen size={28} className="hidden sm:block"/><span>Recipes</span></Button>
        </div>
      </header>}

      <Tabs value={view} onValueChange={changeView}>
        {view==="recipes"
          ? <div className="mb-4 flex items-center justify-between gap-2 pb-2 pt-4 sm:pt-3">
              <Button variant="ghost" className="-ml-2 shrink-0 rounded-lg text-[#315d43] hover:bg-[#e8f0e8]" onClick={()=>setView(preRecipesView)}><ArrowLeft size={18}/>Back</Button>
              <div className="flex items-center gap-2">
                <Button onClick={()=>setOpen(true)} variant="outline" aria-label="Add a recipe" className="h-11 shrink-0 rounded-lg border-[#d9d5cc] bg-white px-4 text-sm font-semibold text-[#45644e] shadow-none transition-colors hover:bg-[#315d43] hover:text-white sm:h-9"><Plus size={18}/>Add recipe</Button>
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
          : <div className="mb-4 flex items-center gap-2 pb-2 pt-4 sm:pt-3">
              <Select value={view==="history"?"history":String(weekOffset)} onValueChange={value=>{if(value==="history"){goAway("history")}else{setWeekOffset(Number(value) as 0|1);if(view==="history")setView(preRecipesView)}}}><SelectTrigger aria-label="Choose planning week" className="h-11 min-w-0 shrink-0 rounded-lg border-[#d9d5cc] bg-white px-3 text-sm font-semibold text-[#244832] shadow-none sm:h-9">{view==="history"?<HistoryIcon size={16} className="shrink-0"/>:<CalendarDays size={16} className="shrink-0"/>}<SelectValue className="truncate">{view==="history"?"History":weekLabel}</SelectValue></SelectTrigger><SelectContent position="popper" sideOffset={4} align="start" className="bg-white"><SelectItem value="0">This week · {weekRange(0)}</SelectItem><SelectItem value="1">Next week · {weekRange(1)}</SelectItem><SelectItem value="history">History</SelectItem></SelectContent></Select>
              <TabsList className="!h-auto flex flex-1 items-center gap-1 overflow-hidden rounded-lg border border-[#dedbd2] bg-white p-1 shadow-sm sm:flex-none sm:gap-2 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:p-0 sm:shadow-none">
                {nav.map(({value,label,icon:Icon})=><TabsTrigger key={value} value={value} className="relative flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border-0 bg-transparent px-2 text-xs font-semibold text-[#68716a] shadow-none transition hover:bg-[#f2f5f1] hover:text-[#315d43] data-[state=active]:bg-[#315d43] data-[state=active]:text-white data-[state=active]:shadow-none sm:h-9 sm:flex-none sm:gap-2 sm:rounded-none sm:border-b-2 sm:border-transparent sm:px-5 sm:text-sm sm:data-[state=active]:border-[#315d43] sm:data-[state=active]:bg-transparent sm:data-[state=active]:text-[#244832] sm:data-[state=active]:shadow-none"><Icon size={16} className="shrink-0"/><span>{label}</span>{value==="plan"&&selected.length>0&&<b className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${view==="plan"?"bg-white/25 text-white":"bg-[#315d43] text-white"} sm:bg-[#315d43] sm:text-white`}>{selected.length}</b>}</TabsTrigger>)}
              </TabsList>
            </div>}


        <TabsContent value="recipes">
          {recipeGrid(recipes.filter(r=>recipeMatchesQuery(r,query)))}
        </TabsContent>

        <TabsContent value="plan">{planPicking
          ? <div>
              <div className="mb-4 flex items-center gap-2">
                <Button variant="ghost" className="-ml-2 shrink-0 rounded-lg text-[#315d43] hover:bg-[#e8f0e8]" onClick={()=>{setPlanPicking(false);setPlanQuery("");setPlanSearchOpen(false)}}><ArrowLeft size={18}/>Back</Button>
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
              {recipeGrid(recipes.filter(r=>recipeMatchesQuery(r,planQuery)))}
            </div>
          : <div className="space-y-3">{orderedSelectedRecipes.map((r,i)=><div key={r.id} role="button" tabIndex={0} onClick={()=>openRecipe(r)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openRecipe(r)}}} className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-4 transition hover:border-[#9fae9e] hover:bg-[#f6f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35 sm:flex-nowrap sm:gap-4">{r.image?<img src={r.image} alt="" className="size-14 shrink-0 rounded-xl object-cover sm:size-16"/>:<div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#eee5d4] text-2xl sm:size-16">{r.emoji}</div>}<div className="min-w-0 flex-1"><Input aria-label={`Day for ${r.title}`} value={days[r.id]||""} onChange={event=>setDay(r.id,event.target.value)} onClick={event=>event.stopPropagation()} placeholder={`Meal ${i+1}`} className="h-6 w-28 rounded-none border-0 border-b border-transparent bg-transparent px-0 py-0 text-xs font-semibold uppercase tracking-wide text-[#9a735e] shadow-none placeholder:text-[#9a9f9b] hover:border-[#ddd4c3] focus-visible:border-[#9a735e] focus-visible:ring-0"/><h3 className="truncate font-serif text-lg font-bold">{r.title}</h3></div><Input aria-label={`Chef cooking ${r.title}`} value={chefs[r.id]||""} onChange={event=>setChef(r.id,event.target.value)} onClick={event=>event.stopPropagation()} placeholder="Chef cooking" className="order-3 h-9 w-full rounded-lg border-transparent bg-transparent px-2 text-sm shadow-none transition placeholder:text-[#9a9f9b] hover:bg-[#f6f2ea] focus-visible:border-[#c9d6cb] focus-visible:bg-white sm:order-none sm:w-36"/><div className="order-4 flex w-full items-center justify-between rounded-xl bg-[#f2ecdf] p-2 sm:order-none sm:w-auto sm:justify-start" onClick={event=>event.stopPropagation()}><span className="ml-1 text-sm font-medium sm:hidden">Cooking for</span><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(r.id,-1)}><Minus size={17} className="sm:hidden"/><Minus size={15} className="hidden sm:block"/></Button><strong className="min-w-20 text-center text-sm">{servings[r.id]||4} people</strong><Button size="icon" variant="ghost" className="size-11 rounded-full sm:size-8" onClick={()=>changeServings(r.id,1)}><Plus size={17} className="sm:hidden"/><Plus size={15} className="hidden sm:block"/></Button></div><Button size="icon" variant="ghost" onClick={event=>{event.stopPropagation();toggle(r.id)}} aria-label="Remove meal" className="size-11 sm:size-9"><X size={19} className="sm:hidden"/><X size={16} className="hidden sm:block"/></Button></div>)}{selected.length>0&&<Button type="button" variant="outline" onClick={()=>setPlanPicking(true)} className="w-full rounded-2xl border-dashed border-[#c9d6cb] bg-transparent py-6 text-[#45644e] shadow-none hover:bg-[#f2f5f1] hover:text-[#244832]"><Plus size={18}/>Add another recipe</Button>}{selected.length===0&&<div role="button" tabIndex={0} onClick={()=>setPlanPicking(true)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPlanPicking(true)}}} className="cursor-pointer rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center transition hover:border-[#9fae9e] hover:bg-[#f2f5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35"><ChefHat className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Choose recipes to plan {weekOffset===0?"this week":"next week"}.</p></div>}</div>}</TabsContent>

        <TabsContent value="shop">{grocery.length?
            <div className="min-w-0">
              {/* Balanced columns implemented in JS to ensure top-aligned cards */}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-4">
                {categoryColumns.map((col,ci)=> (
                  <div key={ci} className="flex-1 flex flex-col gap-4">
                    {col.map(cat=>{
                      const items = grocery.filter(i=>i.category===cat);
                      return (
                        <section key={cat} className="min-w-0 w-full overflow-hidden rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] shadow-[0_2px_10px_rgba(45,61,50,.04)]">
                          <div className="flex items-center justify-between border-b border-[#ebe6dc] bg-[#f6f1e7] px-4 py-3">
                            <h3 className="font-serif text-lg font-bold">{cat}</h3>
                            <button onClick={(e)=>{e.stopPropagation();setCollapsed(prev=>({...prev,[cat]:!prev[cat]}))}} aria-expanded={!collapsed[cat]} aria-controls={`cat-${cat}`} aria-label={collapsed[cat]?`Expand ${cat}`:`Collapse ${cat}`} className="grid size-11 shrink-0 place-items-center rounded-md border border-transparent text-[#45644e] hover:bg-white/80 sm:size-8">{collapsed[cat]?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>
                          </div>
                          <div id={`cat-${cat}`} className={collapsed[cat]?"hidden p-2":"p-2"}>
                            {items.map(i=>{const key=`${i.name.toLowerCase()}|${i.unit.toLowerCase()}|${i.category}`;const done=syncedChecked.includes(key);return (
                              <label key={key} className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl px-2 py-2.5 ${done?"text-[#9a9f9b] line-through":"hover:bg-[#f5f0e6]"}`}>
                                <Checkbox className="mt-0.5 size-5 shrink-0 sm:size-4" checked={done} onCheckedChange={()=>toggleShoppingItemSync(key,!done)}/>
                                <strong className={`shrink-0 whitespace-nowrap text-sm leading-5 ${done?"text-[#9a9f9b]":"text-[#45644e]"}`}>{Math.round(i.amount*100)/100} {i.unit}</strong>
                                <span className="min-w-0 flex-1 break-words leading-5">{i.name}</span>
                              </label>
                            )})}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div> : <div role="button" tabIndex={0} onClick={()=>goAway("recipes")} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();goAway("recipes")}}} className="cursor-pointer rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center transition hover:border-[#9fae9e] hover:bg-[#f2f5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35"><ShoppingBasket className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Add meals to build your shopping list.</p></div>}
          </TabsContent>

        <TabsContent value="history"><div className="space-y-4">{history.map(week=><article key={week.id} className="rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9a735e]">Meal plan</p><h3 className="font-serif text-xl font-bold">{week.label}</h3></div><span className="text-xs text-[#778078]">Saved {new Date(week.savedAt).toLocaleDateString()}</span></div><div className="grid gap-2 sm:grid-cols-2">{week.meals.map(meal=><div key={meal.id} className="flex items-center gap-3 rounded-xl bg-[#f3ede1] p-3"><span className="text-2xl">{meal.emoji}</span><div className="min-w-0"><p className="truncate font-medium">{meal.title}</p><p className="text-xs text-[#6d786f]">{meal.day?`${meal.day} · `:""}For {meal.people} people{meal.chef?` · Chef ${meal.chef}`:""}</p></div></div>)}</div></article>)}{!history.length&&<div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-transparent p-10 text-center"><HistoryIcon className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">No completed weeks yet.</p><p className="mt-1 text-sm text-[#6d786f]">A week will appear here automatically after it ends.</p></div>}</div></TabsContent>
      </Tabs>
      </>}
    </div>
    <AlertDialog open={!!recipeToDelete} onOpenChange={value=>{if(!value)setRecipeToDelete(null)}}><AlertDialogContent className="bg-[#fffdf8]"><AlertDialogHeader><AlertDialogTitle>Delete “{recipeToDelete?.title}”?</AlertDialogTitle><AlertDialogDescription>This removes the recipe from your collection, this week’s plan, and the shopping list. Previously saved week history will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep recipe</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>recipeToDelete&&deleteRecipe(recipeToDelete.id)}>Delete recipe</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
