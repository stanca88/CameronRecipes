import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, BookOpen, CalendarDays, Check, ChefHat, History as HistoryIcon, Minus, MoreHorizontal, Plus, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthScreen } from "./components/AuthScreen";
import { JoinFamilyScreen } from "./components/JoinFamilyScreen";
import { supabase } from "./lib/supabase";
import { useFamilyAuth } from "./lib/useFamilyAuth";

type Ingredient = { name: string; amount: number; unit: string; category: string };
type Recipe = { id: string; title: string; emoji: string; time: string; serves: number; author: string; ingredients: Ingredient[]; image?: string; directions?: string[]; sourceUrl?: string; sourceName?: string };
type WeeklyPlan = { selected: string[]; servings: Record<string,number>; checked: string[]; chefs: Record<string,string>; days: Record<string,string> };
type SavedWeek = { id: string; label: string; savedAt: string; meals: { id: string; title: string; emoji: string; people: number; chef?: string; day?: string }[] };

const emptyPlan = ():WeeklyPlan => ({selected:[],servings:{},checked:[],chefs:{},days:{}});

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

function categoryFor(name:string) {
  const value=name.toLowerCase();
  if(/chicken|beef|turkey|pork|sausage|bacon|salmon|shrimp|fish/.test(value)) return "Meat & seafood";
  if(/milk|cheese|cream|yogurt|butter|egg/.test(value)) return "Dairy & eggs";
  if(/bread|tortilla|bun|roll|pita/.test(value)) return "Bakery";
  if(/tomato|onion|garlic|pepper|lettuce|lemon|lime|potato|cucumber|apple|carrot|celery|herb|parsley|basil|cilantro/.test(value)) return "Produce";
  return "Pantry";
}

function normalizeIngredient(raw:unknown):Ingredient|null {
  if(typeof raw==="string") return parseIngredientLine(raw);
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

type RecipeRow = {
  id: string; name: string; servings: number | null; image_url: string | null; source_url: string | null;
  source_name: string | null; emoji: string | null; time_label: string | null; ingredients: unknown;
  directions: unknown; created_by: string | null;
};

function recipeFromRow(row: RecipeRow, authorName: string): Recipe {
  return {
    id: row.id,
    title: row.name,
    emoji: row.emoji || "🍽️",
    time: row.time_label || "Family recipe",
    serves: row.servings || 4,
    author: authorName,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients as Ingredient[] : [],
    image: row.image_url || undefined,
    directions: Array.isArray(row.directions) ? row.directions as string[] : undefined,
    sourceUrl: row.source_url || undefined,
    sourceName: row.source_name || undefined,
  };
}

type PlanRow = { week_key: string; selected: string[] | null; servings: Record<string,number> | null; checked: string[] | null; chefs: Record<string,string> | null; days: Record<string,string> | null };

function planFromRow(row?: PlanRow | null): WeeklyPlan {
  if (!row) return emptyPlan();
  return { selected: row.selected || [], servings: row.servings || {}, checked: row.checked || [], chefs: row.chefs || {}, days: row.days || {} };
}

export default function App() {
  const auth = useFamilyAuth();
  if (auth.status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-[#faf9f5]"><Spinner className="text-[#45644e]" /></main>;
  }
  if (auth.status === "signed-out") return <AuthScreen auth={auth} />;
  if (auth.status === "needs-join") return <JoinFamilyScreen auth={auth} />;
  return <FamilyTable auth={auth} />;
}

function FamilyTable({ auth }: { auth: ReturnType<typeof useFamilyAuth> }) {
  const userId = auth.user!.id;
  const displayName = auth.profile?.display_name || auth.user?.email || "Family";

  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [weekOffset,setWeekOffset]=useState<0|1>(0);
  const [plans,setPlans]=useState<Record<string,WeeklyPlan>>({});
  const [history,setHistory]=useState<SavedWeek[]>([]);
  const [dataLoading,setDataLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [url,setUrl]=useState("");
  const [ingredients,setIngredients]=useState("");
  const [directions,setDirections]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [activeRecipe,setActiveRecipe]=useState<Recipe|null>(null);
  const [recipeToDelete,setRecipeToDelete]=useState<Recipe|null>(null);
  const [addMode,setAddMode]=useState<"url"|"review"|"manual">("url");
  const [importing,setImporting]=useState(false);
  const [importError,setImportError]=useState("");
  const [view,setView]=useState("recipes");
  const activeWeekKey=weekKey(weekOffset);
  const activePlan=plans[activeWeekKey]||emptyPlan();
  const selected=activePlan.selected;
  const servings=activePlan.servings;
  const checked=activePlan.checked;
  const chefs=activePlan.chefs||{};
  const days=activePlan.days||{};
  const weekLabel=weekRange(weekOffset);

  const fetchRecipes = useCallback(async () => {
    const [{ data: rows }, { data: profiles }] = await Promise.all([
      supabase.from("cameron_recipes").select("*").order("created_at",{ ascending:false }),
      supabase.from("cameron_profiles").select("*"),
    ]);
    const names = Object.fromEntries((profiles||[]).map((p:{user_id:string;display_name:string|null})=>[p.user_id,p.display_name]));
    setRecipes((rows||[]).map((row: RecipeRow) => recipeFromRow(row, (row.created_by && names[row.created_by]) || "Family")));
  }, []);

  const fetchPlans = useCallback(async () => {
    const keys=[weekKey(0),weekKey(1)];
    const { data } = await supabase.from("cameron_weekly_plans").select("*").in("week_key",keys);
    const next:Record<string,WeeklyPlan>={};
    for(const key of keys) next[key]=planFromRow((data||[]).find((row:PlanRow)=>row.week_key===key));
    setPlans(next);
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from("cameron_weekly_history").select("*").order("saved_at",{ ascending:false });
    setHistory((data||[]).map((row:{id:string;label:string;saved_at:string;meals:SavedWeek["meals"]})=>({ id:row.id, label:row.label, savedAt:row.saved_at, meals:row.meals||[] })));
  }, []);

  useEffect(()=>{
    let active=true;
    (async ()=>{
      await Promise.all([fetchRecipes(),fetchPlans(),fetchHistory()]);
      if(active) setDataLoading(false);
    })();
    const channel = supabase.channel("family-table-sync")
      .on("postgres_changes",{ event:"*", schema:"public", table:"cameron_recipes" }, fetchRecipes)
      .on("postgres_changes",{ event:"*", schema:"public", table:"cameron_weekly_plans" }, fetchPlans)
      .on("postgres_changes",{ event:"*", schema:"public", table:"cameron_weekly_history" }, fetchHistory)
      .subscribe();
    return ()=>{ active=false; supabase.removeChannel(channel); };
  },[fetchRecipes,fetchPlans,fetchHistory]);

  const updatePlan = useCallback((key:string, updater:(plan:WeeklyPlan)=>WeeklyPlan)=>{
    setPlans(all=>{
      const next=updater(all[key]||emptyPlan());
      void supabase.from("cameron_weekly_plans").upsert({
        week_key:key, selected:next.selected, servings:next.servings, checked:next.checked,
        chefs:next.chefs, days:next.days, updated_by:userId, updated_at:new Date().toISOString(),
      });
      return {...all,[key]:next};
    });
  },[userId]);

  const setSelected=(update:(current:string[])=>string[])=>updatePlan(activeWeekKey,plan=>({...plan,selected:update(plan.selected)}));
  const setServings=(update:(current:Record<string,number>)=>Record<string,number>)=>updatePlan(activeWeekKey,plan=>({...plan,servings:update(plan.servings)}));
  const setChecked=(update:(current:string[])=>string[])=>updatePlan(activeWeekKey,plan=>({...plan,checked:update(plan.checked)}));
  const setChef=(id:string,name:string)=>updatePlan(activeWeekKey,plan=>({...plan,chefs:{...(plan.chefs||{}),[id]:name}}));
  const setDay=(id:string,day:string)=>updatePlan(activeWeekKey,plan=>({...plan,days:{...(plan.days||{}),[id]:day}}));

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

  const toggle=(id:string)=>{setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);setServings(v=>({...v,[id]:v[id]||4}))};
  const changeServings=(id:string,delta:number)=>setServings(v=>({...v,[id]:Math.max(1,(v[id]||4)+delta)}));
  const openRecipe=(recipe:Recipe)=>{setActiveRecipe(recipe);window.scrollTo({top:0,behavior:"smooth"})};
  const parsedIngredients=()=>ingredients.split("\n").filter(Boolean).map(parseIngredientLine);
  const resetAdd=()=>{setTitle("");setUrl("");setIngredients("");setDirections("");setImageUrl("");setSourceName("");setAddMode("url");setImportError("");setImporting(false)};

  const saveRecipe=async ()=>{
    if(!title.trim())return;
    const { data, error } = await supabase.from("cameron_recipes").insert({
      name:title.trim(), servings:4, emoji:"🍽️", time_label:"Family recipe",
      ingredients:parsedIngredients(), directions:directions.split("\n").filter(Boolean).map(x=>x.trim()),
      image_url:imageUrl||null, source_url:url||null, source_name:sourceName||null, created_by:userId,
    }).select().single();
    if(error||!data){setImportError(error?.message||"We couldn't save that recipe.");return}
    await fetchRecipes();
    const id=data.id as string;
    setSelected(v=>v.includes(id)?v:[...v,id]);
    setServings(v=>({...v,[id]:4}));
    resetAdd();setOpen(false);setView("plan");
  };

  const importRecipe=async()=>{
    if(!url.trim())return;setImporting(true);setImportError("");
    try{
      const token=auth.session?.access_token;
      const response=await fetch("/api/import",{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({url})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"We couldn't import that recipe.");
      setTitle(data.title||"");setIngredients((data.ingredients||[]).join("\n"));setDirections((data.directions||[]).join("\n"));setImageUrl(data.image||"");setSourceName(data.sourceName||"");setAddMode("review")
    }catch(error){setImportError(error instanceof Error?error.message:"We couldn't import that recipe.")}finally{setImporting(false)}
  };

  const saveWeek=async ()=>{
    const meals=recipes.filter(r=>selected.includes(r.id)).map(r=>({id:r.id,title:r.title,emoji:r.emoji,people:servings[r.id]||4,chef:chefs[r.id]?.trim()||undefined,day:days[r.id]?.trim()||undefined}));
    if(!meals.length)return;
    await supabase.from("cameron_weekly_history").delete().eq("label",weekLabel);
    await supabase.from("cameron_weekly_history").insert({ label:weekLabel, meals, saved_by:userId });
    await fetchHistory();
    setView("history");
  };

  const deleteRecipe=async (id:string)=>{
    await supabase.from("cameron_recipes").delete().eq("id",id);
    const { data: rows } = await supabase.from("cameron_weekly_plans").select("*");
    for(const row of (rows||[]) as PlanRow[]){
      if(!(row.selected||[]).includes(id))continue;
      const nextServings={...(row.servings||{})};delete nextServings[id];
      const nextChefs={...(row.chefs||{})};delete nextChefs[id];
      const nextDays={...(row.days||{})};delete nextDays[id];
      await supabase.from("cameron_weekly_plans").update({
        selected:(row.selected||[]).filter(recipeId=>recipeId!==id), servings:nextServings, chefs:nextChefs, days:nextDays,
      }).eq("week_key",row.week_key);
    }
    await Promise.all([fetchRecipes(),fetchPlans()]);
    setActiveRecipe(null);
  };

  const nav=[{value:"recipes",label:"Recipes",icon:BookOpen},{value:"plan",label:"Plan",icon:ChefHat},{value:"shop",label:"Shop",icon:ShoppingBasket}];

  if(dataLoading){
    return <main className="grid min-h-screen place-items-center bg-[#faf9f5]"><Spinner className="text-[#45644e]" /></main>;
  }

  return <main className="min-h-screen bg-[#faf9f5] text-[#1f3529]">
    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)resetAdd()}}><DialogContent className="bg-[#fffdf8]"><DialogHeader><DialogTitle>{addMode==="url"?"Add from a recipe link":addMode==="review"?"Review imported recipe":"Add a recipe manually"}</DialogTitle></DialogHeader>
        {addMode==="url"&&<div className="space-y-4"><p className="text-sm text-[#6d786f]">Paste a recipe link and we’ll fill in the title and ingredients for you.</p><Input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/favorite-recipe"/><Button className="w-full bg-[#45644e] text-white" disabled={!url.trim()||importing} onClick={importRecipe}>{importing?"Importing recipe…":"Import recipe"}</Button>{importError&&<p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{importError}</p>}<div className="flex items-center gap-3"><span className="h-px flex-1 bg-[#ddd4c3]"/><span className="text-xs text-[#7b837c]">or</span><span className="h-px flex-1 bg-[#ddd4c3]"/></div><Button variant="outline" className="w-full" onClick={()=>setAddMode("manual")}>Add manually</Button></div>}
        {addMode==="review"&&<div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">{imageUrl&&<img src={imageUrl} alt="Imported recipe" className="h-40 w-full rounded-2xl object-cover"/>}<div><label className="mb-1 block text-sm font-medium">Title</label><Input value={title} onChange={e=>setTitle(e.target.value)}/></div><div><label className="mb-1 block text-sm font-medium">Ingredients</label><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} rows={7}/></div><div><label className="mb-1 block text-sm font-medium">Directions</label><Textarea value={directions} onChange={e=>setDirections(e.target.value)} rows={7}/></div><p className="text-xs text-[#6d786f]">Everything is editable before you save it.</p><Button className="w-full bg-[#45644e] text-white" onClick={saveRecipe}>Save and add to this week</Button><Button variant="ghost" className="w-full" onClick={()=>setAddMode("url")}>Use a different link</Button></div>}
        {addMode==="manual"&&<div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"><Input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Recipe name"/><Input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Image URL (optional)"/><Textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder={'One ingredient per line\n2 apples\n1 cup flour'} rows={7}/><Textarea value={directions} onChange={e=>setDirections(e.target.value)} placeholder={'One direction per line\nHeat oven to 375°F\nMix ingredients'} rows={7}/><Button className="w-full bg-[#45644e] text-white" onClick={saveRecipe}>Save and add to this week</Button><Button variant="ghost" className="w-full" onClick={()=>setAddMode("url")}>Back to add from URL</Button></div>}
    </DialogContent></Dialog>

    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {activeRecipe ? <article>
        <Button variant="ghost" className="mb-5 -ml-2 rounded-lg text-[#315d43] hover:bg-[#e8f0e8]" onClick={()=>setActiveRecipe(null)}><ArrowLeft size={18}/>Back to recipes</Button>
        <div className="overflow-hidden rounded-[1.75rem] border border-[#dedbd2] bg-white">
          {activeRecipe.image?<img src={activeRecipe.image} alt={activeRecipe.title} className="h-64 w-full object-cover sm:h-80 lg:h-[28rem]"/>:<div className="grid h-56 place-items-center bg-[#e8f0e8] text-8xl">{activeRecipe.emoji}</div>}
          <div className="p-6 sm:p-9 lg:p-12">
            <div className="flex flex-col gap-5 border-b border-[#e8e3da] pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#477457]">Family recipe</p><h2 className="max-w-3xl font-serif text-3xl font-bold leading-tight sm:text-5xl">{activeRecipe.title}</h2><p className="mt-3 text-sm text-[#6d786f]">{activeRecipe.sourceUrl?<a href={activeRecipe.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#45644e] underline decoration-[#45644e]/35 underline-offset-2 hover:decoration-[#45644e]">{activeRecipe.sourceName||"Recipe source"}</a>:(activeRecipe.time==="Imported recipe"?"Family recipe":activeRecipe.time)} · Added by {activeRecipe.author}</p></div>
              <div className="flex flex-wrap gap-2"><Button onClick={()=>toggle(activeRecipe.id)} variant={selected.includes(activeRecipe.id)?"secondary":"default"} className={`rounded-lg ${selected.includes(activeRecipe.id)?"bg-[#e6efe7] text-[#244832] hover:bg-[#dce8de]":"bg-[#315d43] text-white hover:bg-[#274d37]"}`}>{selected.includes(activeRecipe.id)?<><Check/>Added to this week</>:<><Plus/>Add to this week</>}</Button><Button variant="outline" className="rounded-lg border-[#d7a39a] bg-white text-[#a33f32] hover:bg-[#fbe9e2] hover:text-[#8c3025]" onClick={()=>setRecipeToDelete(activeRecipe)}><Trash2/>Delete</Button></div>
            </div>
            <div className="mt-8 flex max-w-md items-center justify-between rounded-2xl bg-[#f2ecdf] p-3"><span className="font-medium">Cooking for</span><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={()=>changeServings(activeRecipe.id,-1)}><Minus size={15}/></Button><strong className="min-w-20 text-center">{servings[activeRecipe.id]||4} people</strong><Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={()=>changeServings(activeRecipe.id,1)}><Plus size={15}/></Button></div></div>
            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
              <section className="min-w-0"><h3 className="font-serif text-2xl font-bold">Ingredients</h3><div className="mt-4 divide-y divide-[#e8e0d1]">{(Array.isArray(activeRecipe.ingredients)?activeRecipe.ingredients:[]).map((raw,index)=>{const item=normalizeIngredient(raw);if(!item)return null;const amount=item.amount*(servings[activeRecipe.id]||4)/(activeRecipe.serves||4);return <div key={index} className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-4 py-3"><strong className="whitespace-nowrap text-[#45644e]">{Math.round(amount*100)/100} {item.unit}</strong><span className="min-w-0 leading-6">{item.name}</span></div>})}</div></section>
              <section className="min-w-0"><h3 className="font-serif text-2xl font-bold">Directions</h3>{activeRecipe.directions?.length?<ol className="mt-5 space-y-6">{activeRecipe.directions.map((step,index)=><li key={index} className="flex min-w-0 gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#45644e] font-semibold text-white">{index+1}</span><p className="min-w-0 pt-1 leading-7">{step}</p></li>)}</ol>:<p className="mt-4 rounded-xl bg-[#f2ecdf] p-4 text-sm text-[#6d786f]">Directions weren’t included with this saved recipe. Re-import it from its recipe page to add them.</p>}</section>
            </div>
          </div>
        </div>
      </article> : <>
      <header className="relative mb-8 min-h-[300px] overflow-hidden rounded-[1.75rem] sm:min-h-[350px]">
        <img src="/family-taco-night.png" alt="Fresh ingredients prepared for family taco night" className="absolute inset-0 h-full w-full object-cover object-center"/>
        <div className="absolute inset-0 bg-gradient-to-r from-[#172c20]/95 via-[#172c20]/72 to-[#172c20]/10" aria-hidden="true"/>
        <Button onClick={()=>setOpen(true)} aria-label="Add a recipe" className="absolute right-4 top-4 z-10 h-10 rounded-lg bg-white px-4 text-sm font-semibold text-[#244832] shadow-none hover:bg-[#f4f7f3] sm:right-6 sm:top-6"><Plus size={18}/>Add recipe</Button>
        <div className="relative flex min-h-[300px] max-w-2xl flex-col justify-center px-5 py-7 text-white sm:min-h-[350px] sm:px-10 lg:px-12"><div className="w-fit max-w-full rounded-2xl bg-[#13271d]/75 py-5 pl-5 pr-10 shadow-sm backdrop-blur-sm sm:py-7 sm:pl-7 sm:pr-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#d5e7d8]">Cameron Family Table</p>
          <h2 className="whitespace-nowrap font-serif text-2xl font-medium leading-tight sm:text-4xl lg:text-5xl">Good food, happy family.</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/85">Keep the recipes everyone loves, plan the week together, and bring one tidy list to the store.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Select value={String(weekOffset)} onValueChange={value=>setWeekOffset(Number(value) as 0|1)}><SelectTrigger aria-label="Choose planning week" className="h-9 rounded-lg border-0 bg-white/90 px-3 text-sm font-semibold text-[#244832] shadow-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white/50"><CalendarDays size={16}/><SelectValue>{weekLabel}</SelectValue></SelectTrigger><SelectContent className="bg-white"><SelectItem value="0">This week · {weekRange(0)}</SelectItem><SelectItem value="1">Next week · {weekRange(1)}</SelectItem></SelectContent></Select><span className="inline-flex items-center rounded-lg bg-white/90 px-3 py-2 text-sm text-[#244832]"><strong className="mr-1">{selected.length}</strong> meals planned</span></div>
        </div></div>
      </header>

      <Tabs value={view} onValueChange={setView}>
        <div className="mb-8 flex w-full items-end gap-1 overflow-x-auto border-b border-[#dedbd2]">
          <TabsList className="flex h-auto shrink-0 items-center justify-start gap-1 rounded-none bg-transparent p-0 shadow-none">
            {nav.map(({value,label,icon:Icon})=><TabsTrigger key={value} value={value} className="relative flex-none gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2.5 py-3 text-xs font-semibold text-[#68716a] shadow-none transition hover:bg-transparent hover:text-[#315d43] data-[state=active]:border-[#315d43] data-[state=active]:bg-transparent data-[state=active]:text-[#244832] data-[state=active]:shadow-none sm:px-5 sm:text-sm"><Icon size={18}/><span>{label}</span>{value==="plan"&&selected.length>0&&<b className="rounded-full bg-[#315d43] px-1.5 py-0.5 text-[10px] leading-none text-white sm:px-2 sm:text-xs">{selected.length}</b>}</TabsTrigger>)}
          </TabsList>
          <DropdownMenu><DropdownMenuTrigger aria-label="More navigation" className={`grid h-11 w-11 shrink-0 place-items-center border-b-2 bg-transparent text-[#68716a] transition hover:bg-[#f2f5f1] hover:text-[#315d43] ${view==="history"?"border-[#315d43] text-[#244832]":"border-transparent"}`}><MoreHorizontal size={20}/></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-40 bg-white"><DropdownMenuItem onClick={()=>setView("history")}><HistoryIcon/>History</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <div className="relative ml-auto hidden shrink-0 pb-3 sm:block"><Search className="absolute left-3 top-2.5 text-[#526158]" size={17}/><Input className="h-9 w-56 rounded-lg border-[#d9d5cc] bg-white pl-9 shadow-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search recipes"/></div>
        </div>

        <TabsContent value="recipes">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{recipes.filter(r=>r.title.toLowerCase().includes(query.toLowerCase())).map(r=><article key={r.id} onClick={()=>openRecipe(r)} className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white transition ${selected.includes(r.id)?"border-[#7ea087] shadow-[0_0_0_2px_rgba(65,98,75,.12)]":"border-[#e1ddd3] hover:-translate-y-1 hover:shadow-lg"}`}><div className="absolute left-3 top-3 z-10"><TooltipProvider><Tooltip><TooltipTrigger aria-label={selected.includes(r.id)?`Remove ${r.title} from week`:`Add ${r.title} to week`} onClick={event=>{event.stopPropagation();toggle(r.id)}} className={`grid size-10 place-items-center rounded-full border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35 ${selected.includes(r.id)?"border-[#315d43] bg-[#315d43] text-white hover:bg-[#274d37]":"border-[#d8d5cd] bg-white/95 text-[#315d43] hover:bg-[#edf3ee]"}`}>{selected.includes(r.id)?<Check size={19}/>:<Plus size={20}/>}</TooltipTrigger><TooltipContent side="top" sideOffset={6} className="bg-[#1f3529] text-white">{selected.includes(r.id)?"Remove from week":"Add to week"}</TooltipContent></Tooltip></TooltipProvider></div><div className="absolute right-3 top-3 z-10 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><DropdownMenu><DropdownMenuTrigger asChild><button onClick={event=>event.stopPropagation()} aria-label={`More actions for ${r.title}`} className="grid size-10 place-items-center rounded-lg border border-[#d8d5cd] bg-white/95 text-[#304439] shadow-sm hover:bg-[#f1f4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d43]/35"><MoreHorizontal size={20}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-44 bg-white"><DropdownMenuItem variant="destructive" onClick={event=>{event.stopPropagation();setRecipeToDelete(r)}}><Trash2/>Delete recipe</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{r.image?<img src={r.image} alt={r.title} className="h-44 w-full object-cover"/>:<div className="grid h-36 place-items-center bg-[#edf2eb] text-5xl">{r.emoji}</div>}<div className="min-w-0 p-5"><h3 className="truncate font-serif text-xl font-bold" title={r.title}>{r.title}</h3><p className="mt-1 text-sm text-[#6d786f]">{r.sourceUrl?<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-[#45644e] underline decoration-[#45644e]/35 underline-offset-2 hover:decoration-[#45644e]" onClick={event=>event.stopPropagation()}>{r.sourceName||"Recipe source"}</a>:(r.time==="Imported recipe"?"Family recipe":r.time)}</p><div className="mt-5 border-t border-[#ebe7df] pt-4"><span className="text-xs text-[#788078]">Added by {r.author}</span></div></div></article>)}</div>
          {!recipes.length && <div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-[#fffdf8]/60 p-10 text-center"><BookOpen className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">No recipes yet. Add your first family favorite.</p></div>}
        </TabsContent>

        <TabsContent value="plan"><div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="font-serif text-2xl font-bold">{weekOffset===0?"This week’s meals":"Next week’s meals"}</h2><p className="text-sm text-[#6d786f]">{weekLabel} · Set servings separately for every recipe.</p></div><Button onClick={saveWeek} disabled={!selected.length} className="rounded-full bg-[#45644e] text-white"><Archive/>Save this week</Button></div><div className="space-y-3">{recipes.filter(r=>selected.includes(r.id)).map((r,i)=><div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-4 sm:flex-nowrap sm:gap-4">{r.image?<img src={r.image} alt="" className="size-14 shrink-0 rounded-xl object-cover sm:size-16"/>:<div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#eee5d4] text-2xl sm:size-16">{r.emoji}</div>}<div className="min-w-0 flex-1"><Input aria-label={`Day for ${r.title}`} value={days[r.id]||""} onChange={event=>setDay(r.id,event.target.value)} placeholder={`Meal ${i+1}`} className="h-6 w-28 rounded-none border-0 border-b border-transparent bg-transparent px-0 py-0 text-xs font-semibold uppercase tracking-wide text-[#9a735e] shadow-none placeholder:text-[#9a9f9b] hover:border-[#ddd4c3] focus-visible:border-[#9a735e] focus-visible:ring-0"/><h3 className="truncate font-serif text-lg font-bold">{r.title}</h3></div><Input aria-label={`Chef cooking ${r.title}`} value={chefs[r.id]||""} onChange={event=>setChef(r.id,event.target.value)} placeholder="Chef cooking" className="order-3 h-9 w-full rounded-lg border-transparent bg-transparent px-2 text-sm shadow-none transition placeholder:text-[#9a9f9b] hover:bg-[#f6f2ea] focus-visible:border-[#c9d6cb] focus-visible:bg-white sm:order-none sm:w-36"/><div className="order-4 flex w-full items-center justify-between rounded-xl bg-[#f2ecdf] p-2 sm:order-none sm:w-auto sm:justify-start"><span className="ml-1 text-sm font-medium sm:hidden">Cooking for</span><Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={()=>changeServings(r.id,-1)}><Minus size={15}/></Button><strong className="min-w-20 text-center text-sm">{servings[r.id]||4} people</strong><Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={()=>changeServings(r.id,1)}><Plus size={15}/></Button></div><Button size="icon" variant="ghost" onClick={()=>toggle(r.id)} aria-label="Remove meal"><X/></Button></div>)}{selected.length===0&&<div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-[#fffdf8]/60 p-10 text-center"><ChefHat className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Choose recipes to plan {weekOffset===0?"this week":"next week"}.</p></div>}</div></TabsContent>

        <TabsContent value="shop"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl font-bold">Shopping list</h2><p className="text-sm text-[#6d786f]">{weekLabel} · {grocery.length} items for {selected.length} recipes</p></div><Button variant="outline" className="w-fit rounded-full bg-[#fffdf8]" onClick={()=>setChecked(()=>[])}>Clear checks</Button></div>{grocery.length?<div className="min-w-0 columns-1 gap-4 md:columns-2 xl:columns-3">{categories.map(cat=>{const items=grocery.filter(i=>i.category===cat);return <section key={cat} className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] shadow-[0_2px_10px_rgba(45,61,50,.04)]"><div className="flex items-center justify-between border-b border-[#ebe6dc] bg-[#f6f1e7] px-4 py-3"><h3 className="font-serif text-lg font-bold">{cat}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#6d786f]">{items.length}</span></div><div className="p-2">{items.map(i=>{const key=i.name+i.unit;const done=checked.includes(key);return <label key={key} className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl px-2 py-2.5 ${done?"text-[#9a9f9b] line-through":"hover:bg-[#f5f0e6]"}`}><Checkbox className="mt-0.5 shrink-0" checked={done} onCheckedChange={()=>setChecked(v=>done?v.filter(x=>x!==key):[...v,key])}/><strong className="shrink-0 whitespace-nowrap text-sm leading-6 text-[#45644e]">{Math.round(i.amount*100)/100} {i.unit}</strong><span className="min-w-0 flex-1 break-words leading-6">{i.name}</span></label>})}</div></section>})}</div>:<div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-[#fffdf8]/60 p-10 text-center"><ShoppingBasket className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">Add meals to build your shopping list.</p></div>}</TabsContent>

        <TabsContent value="history"><div className="mb-5"><h2 className="font-serif text-2xl font-bold">Meal-week history</h2><p className="text-sm text-[#6d786f]">Saved weekly plans stay here so you can reuse family favorites.</p></div><div className="space-y-4">{history.map(week=><article key={week.id} className="rounded-2xl border border-[#ddd4c3] bg-[#fffdf8] p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9a735e]">Meal plan</p><h3 className="font-serif text-xl font-bold">{week.label}</h3></div><span className="text-xs text-[#778078]">Saved {new Date(week.savedAt).toLocaleDateString()}</span></div><div className="grid gap-2 sm:grid-cols-2">{week.meals.map(meal=><div key={meal.id} className="flex items-center gap-3 rounded-xl bg-[#f3ede1] p-3"><span className="text-2xl">{meal.emoji}</span><div className="min-w-0"><p className="truncate font-medium">{meal.title}</p><p className="text-xs text-[#6d786f]">{meal.day?`${meal.day} · `:""}For {meal.people} people{meal.chef?` · Chef ${meal.chef}`:""}</p></div></div>)}</div></article>)}{!history.length&&<div className="rounded-3xl border border-dashed border-[#cfc5b2] bg-[#fffdf8]/60 p-10 text-center"><HistoryIcon className="mx-auto mb-3 text-[#78907c]"/><p className="font-medium">No saved weeks yet.</p><p className="mt-1 text-sm text-[#6d786f]">Open This Week and choose “Save this week.”</p></div>}</div></TabsContent>
      </Tabs>
      </>}
    </div>
    <AlertDialog open={!!recipeToDelete} onOpenChange={value=>{if(!value)setRecipeToDelete(null)}}><AlertDialogContent className="bg-[#fffdf8]"><AlertDialogHeader><AlertDialogTitle>Delete “{recipeToDelete?.title}”?</AlertDialogTitle><AlertDialogDescription>This removes the recipe from your family's collection, this week's plan, and the shopping list. Previously saved week history will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep recipe</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>recipeToDelete&&deleteRecipe(recipeToDelete.id)}>Delete recipe</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <footer className="mt-8 flex flex-col items-center gap-1 border-t border-[#ddd4c3] py-6 text-center text-sm text-[#7b837c]">
      <span>Made for the Cameron family · Synced for everyone signed in</span>
      <span>Signed in as {displayName} · <button className="underline decoration-[#7b837c]/50 underline-offset-2 hover:text-[#45644e]" onClick={()=>auth.signOut()}>Sign out</button></span>
    </footer>
  </main>;
}
