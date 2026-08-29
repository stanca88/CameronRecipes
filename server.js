import express from 'express';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = 'https://yveqzlpemdxjgzlxvocs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vPv7fZZUYOKIIwCDJHfCSA_EM9qXM8Z';

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/vendor/supabase.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'));
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    return n === '::1' || n === '::' || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('fe80:');
  }
  return true;
}

async function validateRemoteUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https recipe links are allowed.');
  if (['localhost', 'localhost.localdomain'].includes(url.hostname.toLowerCase())) throw new Error('That address is not allowed.');
  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) throw new Error('Private network addresses are not allowed.');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('That address is not allowed.');
  return url;
}

async function fetchHtml(raw) {
  let current = await validateRemoteUrl(raw);
  for (let i = 0; i < 5; i++) {
    const r = await fetch(current, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CameronRecipes/1.0)',
        'accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(12000)
    });
    if ([301,302,303,307,308].includes(r.status)) {
      const location = r.headers.get('location');
      if (!location) throw new Error('Recipe site returned an invalid redirect.');
      current = await validateRemoteUrl(new URL(location, current).href);
      continue;
    }
    if (!r.ok) throw new Error(`Recipe site returned ${r.status}.`);
    const type = r.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('application/xhtml')) throw new Error('That link did not return a web page.');
    const text = await r.text();
    if (text.length > 4_000_000) throw new Error('That recipe page is too large to import safely.');
    return { html: text, finalUrl: current.href };
  }
  throw new Error('Too many redirects while importing that recipe.');
}

function decodeEntities(s='') {
  return s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;|&#x27;/gi,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&frac12;/g,'1/2').replace(/&frac14;/g,'1/4').replace(/&frac34;/g,'3/4')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function stripTags(s='') { return decodeEntities(String(s).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim(); }
function collectJsonLd(html) {
  const out=[]; const re=/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m=re.exec(html))) { try { out.push(JSON.parse((m[1]||'').trim().replace(/^\uFEFF/,''))); } catch {} }
  return out;
}
function flatten(node,out=[]) {
  if (Array.isArray(node)) node.forEach(x=>flatten(x,out));
  else if (node && typeof node === 'object') { out.push(node); if (node['@graph']) flatten(node['@graph'],out); if (node.mainEntity) flatten(node.mainEntity,out); }
  return out;
}
function isRecipeNode(o) { const t=o?.['@type']; return Array.isArray(t) ? t.some(x=>String(x).toLowerCase().includes('recipe')) : String(t||'').toLowerCase().includes('recipe'); }
function firstString(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) { for (const x of v) { const s=firstString(x); if (s) return s; } }
  if (v && typeof v === 'object') return firstString(v.url || v.contentUrl || v.name || v.text);
  return null;
}
function servings(v) { const m=String(firstString(v)||'').match(/\d+/); const n=m?Number(m[0]):4; return n>0&&n<100?n:4; }
function instructions(v) {
  const steps=[]; const walk=(x)=>{ if(!x)return; if(typeof x==='string'){const t=stripTags(x);if(t)steps.push(t);return;} if(Array.isArray(x)){x.forEach(walk);return;} if(typeof x==='object'){if(x.itemListElement)return walk(x.itemListElement); walk(x.text||x.name);} }; walk(v); return steps;
}
function meta(html, property) {
  const a=new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,'i');
  const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,'i');
  const m=html.match(a)||html.match(b); return m?decodeEntities(m[1]):null;
}

async function requireFamily(req) {
  const auth = req.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Sign in required.'), { status: 401 });
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, authorization: auth } });
  if (!userRes.ok) throw Object.assign(new Error('Your sign-in has expired.'), { status: 401 });
  const user = await userRes.json();
  const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/cameron_family_members?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, {
    headers: { apikey: SUPABASE_KEY, authorization: auth }
  });
  const rows = memberRes.ok ? await memberRes.json() : [];
  if (!rows.length) throw Object.assign(new Error('Join the Cameron family first.'), { status: 403 });
  return user;
}

app.post('/api/import', async (req,res) => {
  try {
    await requireFamily(req);
    const raw = String(req.body?.url || '').trim();
    if (!raw) return res.status(400).json({ error: 'Paste a recipe URL first.' });
    const { html, finalUrl } = await fetchHtml(raw);
    const nodes = collectJsonLd(html).flatMap(x=>flatten(x,[]));
    const recipe = nodes.find(isRecipeNode);
    if (recipe) {
      const rawIng = recipe.recipeIngredient || recipe.ingredients || [];
      return res.json({
        name: firstString(recipe.name) || meta(html,'og:title') || 'Imported recipe',
        image_url: firstString(recipe.image) || meta(html,'og:image'),
        servings: servings(recipe.recipeYield || recipe.yield),
        ingredients: (Array.isArray(rawIng)?rawIng:[]).map(stripTags).filter(Boolean),
        directions: instructions(recipe.recipeInstructions),
        source_url: finalUrl
      });
    }
    const title = meta(html,'og:title') || stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
    return res.json({ name:title||'Imported recipe', image_url:meta(html,'og:image'), servings:4, ingredients:[], directions:[], source_url:finalUrl, partial:true });
  } catch (e) {
    console.error('Import error:', e.message);
    res.status(e.status || 400).json({ error: e.message || 'Could not import that recipe.' });
  }
});

app.get('*path', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`Cameron Recipes running on port ${PORT}`));
