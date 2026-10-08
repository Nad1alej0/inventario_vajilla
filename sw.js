const C="vajilla-v4";
const A=["./","index.html","styles.css","app.js?v=4","config.js?v=4","manifest.webmanifest","icon.svg"];
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)));
});
self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{
        const copy=r.clone();
        caches.open(C).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});