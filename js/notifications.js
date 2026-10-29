/* Channel Studio notification helper: browser permission, system notifications and optional tones. */
(function(){
'use strict';
function store(){return window.StudioStore}
function enabled(){return store()?store().get('notificationToneEnabled',true):true}
function tone(){return store()?store().get('notificationTone','chime'):'chime'}
function playTone(force){
 if(!force&&!enabled())return false;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
 let ctx;
 try{
  ctx=new AC();const kind=tone(),notes=kind==='bell'?[740,980,740]:kind==='ping'?[1046]:[660,880,1046];
  let start=ctx.currentTime+.02;
  notes.forEach(hz=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='bell'?'sine':'triangle';osc.frequency.setValueAtTime(hz,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.10,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+.22);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.24);start+=kind==='bell'?.17:.13});
  setTimeout(()=>{try{ctx.close()}catch(e){}},1200);return true;
 }catch(e){try{ctx?.close()}catch(_){}return false}
}
async function request(){
 if(!('Notification'in window))return 'This browser does not support notifications.';
 try{return await Notification.requestPermission()}catch(e){return 'Permission request failed.'}
}
async function send(title,body,options={}){
 playTone(false);
 if(!('Notification'in window)||Notification.permission!=='granted')return null;
 const opts={body:String(body||''),tag:options.tag||'channel-studio-'+Date.now(),data:{url:options.url||'notifications.html'},renotify:false,icon:'assets/icons/icon-192.png',badge:'assets/icons/icon-192.png'};
 try{
  if('serviceWorker'in navigator){
   const reg=await navigator.serviceWorker.ready;
   if(reg&&reg.showNotification){await reg.showNotification(String(title||'Channel Studio'),opts);return true}
  }
 }catch(e){}
 try{
  const n=new Notification(String(title||'Channel Studio'),opts);
  n.onclick=()=>{try{window.focus()}catch(e){}if(options.url)window.location.href=options.url;n.close()};
  return n;
 }catch(e){return null}
}
window.StudioNotify={request,send,playTone};
})();