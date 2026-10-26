(function(){
'use strict';
const $=id=>document.getElementById(id);
const store=()=>window.StudioStore;
const getTasks=()=>{try{return store().get('tasks',[])||[]}catch(e){return []}};
const setTasks=items=>store().set('tasks',items);
const getChannels=()=>{try{return store().get('channels',[])||[]}catch(e){return []}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fillChannels(){
 const select=$('taskChannel');if(!select)return;
 const current=select.value,channels=getChannels();
 select.innerHTML='<option value="">Choose a saved channel…</option>'+channels.filter(c=>c.url).map(c=>`<option value="${esc(c.url)}">${esc(c.name||c.url)}</option>`).join('');
 if([...select.options].some(o=>o.value===current))select.value=current;
 if(!channels.some(c=>c.url))select.title='Open Channels and save a channel URL first.';
}
function dueTasks(){
 const now=Date.now();
 return getTasks().map((t,i)=>({...t,_index:i})).filter(t=>(t.type||'post')==='post'&&!t.done&&t.date&&Number.isFinite(new Date(t.date).getTime())&&new Date(t.date).getTime()<=now);
}
function renderDue(){
 let panel=$('duePostPanel');
 if(!panel){
  panel=document.createElement('section');panel.id='duePostPanel';panel.className='panel due-post-panel';
  const form=$('taskForm')?.closest('section');
  if(form)form.insertAdjacentElement('afterend',panel);
  else return;
 }
 const due=dueTasks();
 if(!due.length){panel.innerHTML='<p class="small muted">⏰ No posts are due right now.</p>';return;}
 panel.innerHTML='<div class="section-heading"><div><p class="eyebrow">POSTING TIME</p><h2>⏰ Posts ready to publish</h2></div><span class="pill">'+due.length+' due</span></div>'+due.map(t=>`<article class="list-item due-post-item"><h3>${esc(t.title||'Planned post')}</h3><p class="small muted">${esc(t.channelName||'Selected channel')} · scheduled ${esc(new Date(t.date).toLocaleString())}</p><p class="due-post-copy">${esc(t.postText||t.title||'')}</p><div class="item-actions"><button class="button primary" type="button" data-publish-task="${esc(t.id)}">📋 Copy post & open channel</button></div></article>`).join('')+'<p class="small muted">Channel Studio prepares the post and opens the channel. You still need to tap Send/Post in WhatsApp.</p>';
}
async function copyAndOpen(taskId){
 const tasks=getTasks(),idx=tasks.findIndex(t=>String(t.id)===String(taskId));
 if(idx<0)return;
 const task=tasks[idx],text=String(task.postText||task.title||''),url=String(task.channelUrl||'');
 if(!url){window.studioToast?.('No channel URL is saved for this post. Edit the channel in Channels and schedule the post again.');return;}
 // Open synchronously during the click so mobile browsers are less likely to block it.
 const win=window.open(url,'_blank','noopener');
 let copied=false;
 try{await navigator.clipboard.writeText(text);copied=true;}catch(e){
   const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();
   try{copied=document.execCommand('copy')}catch(err){}area.remove();
 }
 if(!copied){window.prompt('Copy your post text, then return to the channel:',text);}
 tasks[idx]={...task,done:true,completedAt:new Date().toISOString(),completionNote:'Channel opened and post prepared for manual publishing'};
 setTasks(tasks);
 window.studioToast?.(copied?'Post copied and channel opened. Paste it in WhatsApp to publish.':'Channel opened. Copy the post text from the prompt and publish manually.');
 renderDue();
 document.dispatchEvent(new Event('planner:posts-updated'));$('taskFilter')?.dispatchEvent(new Event('change'));
}
function checkDue(){
 const due=dueTasks();if(!due.length)return;
 const seenKey='channelStudioDuePostNotice';
 let seen={};try{seen=JSON.parse(sessionStorage.getItem(seenKey)||'{}')}catch(e){}
 for(const task of due){
  const key=String(task.id)+'|'+String(task.date);
  if(seen[key])continue;seen[key]=true;
  try{if('Notification'in window&&Notification.permission==='granted')new Notification('Channel Studio: posting time 📣',{body:(task.title||'Your planned post')+' is ready. Open Planner to copy and publish it.'})}catch(e){}
  window.studioToast?.('Posting time reached: '+(task.title||'Your planned post')+'. Open Planner to copy and publish it.');
 }
 try{sessionStorage.setItem(seenKey,JSON.stringify(seen))}catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{
 fillChannels();
 $('taskForm')?.addEventListener('submit',()=>setTimeout(()=>{fillChannels();renderDue()},120));
 $('taskList')?.addEventListener('click',()=>setTimeout(renderDue,80));
 $('duePostPanel')?.addEventListener('click',e=>{const b=e.target.closest('[data-publish-task]');if(b)copyAndOpen(b.dataset.publishTask)});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-publish-task]');if(b)copyAndOpen(b.dataset.publishTask)});
 window.addEventListener('focus',()=>{fillChannels();checkDue();renderDue()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkDue();renderDue();fillChannels()}});
 setInterval(()=>{checkDue();renderDue()},30000);
 renderDue();checkDue();
});
})();
