/* Paboo service worker v5 — fast repeat visits, safe prices.
   - HTML pages ........ network first (always fresh), cached copy only when offline
   - css/js/icons ...... stale-while-revalidate (file names carry ?v=, so updates arrive at once)
   - product images .... cache first, newest 150 kept
   - Google Fonts ...... cache first
   - Supabase data/API, admin pages ... never cached, always live                          */
const V='paboo-v5',STATIC=V+'-static',IMG=V+'-img',FONT=V+'-font',MAX_IMG=150;
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keep=[STATIC,IMG,FONT];
  for(const k of await caches.keys())if(!keep.includes(k))await caches.delete(k);
  await self.clients.claim();
})()));
async function trim(name,max){const c=await caches.open(name),ks=await c.keys();for(let i=0;i<ks.length-max;i++)await c.delete(ks[i]);}
async function cacheFirst(req,name,max){
  const c=await caches.open(name),hit=await c.match(req);if(hit)return hit;
  const res=await fetch(req);
  if(res&&(res.ok||res.type==='opaque')){c.put(req,res.clone());if(max)trim(name,max);}
  return res;
}
async function swr(req,name){
  const c=await caches.open(name),hit=await c.match(req);
  const net=fetch(req).then(res=>{if(res&&res.ok)c.put(req,res.clone());return res}).catch(()=>hit);
  return hit||net;
}
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  /* never touch the admin panel or live data */
  if(u.origin===location.origin&&/\/admin/i.test(u.pathname))return;
  if(/supabase\.co$/.test(u.hostname)&&!/\/storage\/v1\/object\/public\//.test(u.pathname))return;
  if(u.origin===location.origin){
    if(r.mode==='navigate'||/\.html?$/.test(u.pathname)||u.pathname.endsWith('/')){
      e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(STATIC).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(h=>h||caches.match('index.html'))));return;
    }
    if(/\.(css|js|png|jpe?g|webp|svg|ico|webmanifest|woff2?)$/i.test(u.pathname)){e.respondWith(swr(r,STATIC));return;}
    return;
  }
  if(/\/storage\/v1\/object\/public\//.test(u.pathname)||r.destination==='image'){e.respondWith(cacheFirst(r,IMG,MAX_IMG).catch(()=>fetch(r)));return;}
  if(u.hostname==='fonts.gstatic.com'){e.respondWith(cacheFirst(r,FONT,40));return;}
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='cdn.jsdelivr.net'){e.respondWith(swr(r,FONT));return;}
});
