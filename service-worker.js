Tt/* Channel Studio v14 service worker
   Versioned shell cache ensures updated CSS/JS replace stale v13 assets. */
const CACHE='channel-studio-shell-v14';
const CORE=[
 './','index.html','home.html','stories.html','docs.html','episodes.html',
 'ready-made.html','planner.html','publish.html','hype.html','media.html',
 'channels.html','complaints.html','reviews.html','notifications.html',
 'backup.html','settings.html','manifest.webmanifest',
 'css/styles.css','css/animations.css','css/themes.css','css/ready-made.css',
 'js/app-shell-behavior.js','js/storage.js','js/themes.js','js/transitions.js',
 'js/effects.js','js/notifications.js','js/feedback.js','js/app.js',
 'js/story-engine.js','js/story-split-post.js','js/documents.js','js/creator-lab.js',
 'js/media.js','js/media-attach.js','js/planner-media.js','js/planner-stage3.js',
 'js/planner-stage4.js','js/planner-publish.js','js/ready-made.js','js/supabase-cloud.js',
 'assets/icons/icon-192.png','assets/icons/icon-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(CORE.map(async path=>{
   try{await cache.add(new Request(path,{cache:'reload'}))}
   catch(error){console.warn('[Channel Studio] Could not precache:',path,error)}
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('channel-studio-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data&&event.notification.data.url||'notifications.html';
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target);return}
  }
  if(self.clients.openWindow)await self.clients.openWindow(target);
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const isAsset=/\.(css|js)$/i.test(url.pathname);
 if(isAsset){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const fresh=await fetch(request,{cache:'no-cache'});
    if(fresh&&fresh.ok)cache.put(request,fresh.clone());
    return fresh;
   }catch(error){const cached=await cache.match(request);if(cached)return cached;throw error}
  })());
  return;
 }
 event.respondWith((async()=>{
  const cached=await caches.match(request);
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response&&response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone())}
   return response;
  }catch(error){
   if(request.mode==='navigate')return (await caches.match('index.html'))||Response.error();
   throw error;
  }
 })());
});
