/* Optional offline shell. Government API data is NEVER stored in service-worker caches. */
const SHELL_CACHE='tenderatlas-shell-v10.6.0';
const FILES=['/','/index.html','/assets/app.js','/assets/styles.css','/assets/logo.svg','/assets/icon-192.png','/assets/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tenderatlas-')&&k!==SHELL_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const u=new URL(req.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){e.respondWith(fetch(req).catch(async()=>{const cache=await caches.open(SHELL_CACHE);return await cache.match('/index.html')||new Response('Offline app shell unavailable',{status:503});}));return;}
 if(FILES.includes(u.pathname)){e.respondWith(fetch(req).then(async res=>{if(res.ok){const c=await caches.open(SHELL_CACHE);c.put(req,res.clone()).catch(()=>{});}return res;}).catch(()=>caches.match(req)));}
});
