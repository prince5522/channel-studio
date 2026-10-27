(function(){
'use strict';
const $=id=>document.getElementById(id);
const store=()=>window.StudioStore;
const getTasks=()=>{try{return store().get('tasks',[])||[]}catch(e){return []}};
const setTasks=items=>store().set('tasks',items);
const getChannels=()=>{try{return store().get('channels',[])||[]}catch(e){return []}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dueKey=t=>String(t.id||t.title)+'|'+String(t.date||'');
function fillChannels(){
 const select=$('taskChannel');if(!select)return;
 const current=select.value,channels=getChannels();
 select.innerHTML='<option value="">Choose a saved channel…</option>'+channels.filter(c=>c.url).map(c=>`<option value="${esc(c.url)}">${esc(c.name||c.url)}</option>`).join('');
 if([...select.options].some(o=>o.value===current))select.value=current;
 if(!channels.some(c=>c.url))select.title='Open Channels and save a channel URL first.';
}
function dueTasks(){const now=Date.now();return getTasks().map((t,i)=>({...t,_index:i})).filter(t=>(t.type||'post')==='post'&&!t.done&&t.date&&Number.isFinite(new Date(t.date).getTime())&&new Date(t.date).getTime()<=now)}
function renderDue(){
 let panel=$('duePostPanel');
 if(!panel){panel=document.createElement('section');panel.id='duePostPanel';panel.className='panel due-post-panel';const form=$('taskForm')?.closest('section');if(form)form.insertAdjacentElement('afterend',panel);else return;}
 const due=dueTasks();
 if(!due.length){panel.innerHTML='<p class="small muted">⏰ No posts are due right now.</p>';return;}
 panel.innerHTML='<div class="section-heading"><div><p class="eyebrow">POSTING TIME</p><h2>⏰ Posting alarm — your posts are due</h2></div><span class="pill">'+due.length+' due</span></div>'+due.map(t=>`<article class="list-item due-post-item"><h3>📣 ${esc(t.title||'Planned post')}</h3><p class="small muted">${esc(t.channelName||'Selected channel')} · scheduled ${esc(new Date(t.date).toLocaleString())}</p><p class="due-post-copy">${esc(t.postText||t.title||'')}</p><div class="item-actions"><button class="button primary" type="button" data-publish-task="${esc(t.id)}">📋 Copy post & open channel</button><button class="button ghost" type="button" data-confirm-posted="${esc(t.id)}">✅ I’ve posted it</button></div><p class="small muted">First copy and open the channel, publish it in WhatsApp, then tap “I’ve posted it”.</p></article>`).join('')+'<p class="small muted">For privacy and safety, Channel Studio cannot paste into WhatsApp or verify that WhatsApp published the post automatically.</p>';
}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch(e){const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch(err){}area.remove();return ok}}
async function copyAndOpen(taskId){
 const tasks=getTasks(),idx=tasks.findIndex(t=>String(t.id)===String(taskId));if(idx<0)return;
 const task=tasks[idx],text=String(task.postText||task.title||''),url=String(task.channelUrl||'');
 if(!url){window.studioToast?.('No channel URL is saved for this post. Open Channels and save the channel link first.');return;}
 // Open on the user's tap: mobile browsers block apps being launched automatically in the background.
 const win=window.open(url,'_blank');
 const copied=await copyText(text);
 tasks[idx]={...task,postPreparedAt:new Date().toISOString(),postPrepared:true};setTasks(tasks);
 if(!copied)window.prompt('Copy your post text, then return to the channel:',text);
 window.studioToast?.(copied?'Post copied. The channel was opened; paste and publish it there.':'Channel opened. Copy the post text from the prompt and publish it manually.');
 renderDue();document.dispatchEvent(new Event('planner:posts-updated'));$('taskFilter')?.dispatchEvent(new Event('change'));
}
function confirmPosted(taskId){const tasks=getTasks(),idx=tasks.findIndex(t=>String(t.id)===String(taskId));if(idx<0)return;const task=tasks[idx];if(!confirm('Mark this post as completed? Confirm only after you have published it in WhatsApp.'))return;tasks[idx]={...task,done:true,completedAt:new Date().toISOString(),completionNote:'User confirmed that the post was published in WhatsApp'};setTasks(tasks);window.studioToast?.('Post marked completed. ✅');renderDue();document.dispatchEvent(new Event('planner:posts-updated'));$('taskFilter')?.dispatchEvent(new Event('change'));}
function readSeen(){try{return JSON.parse(localStorage.getItem('channelStudioDuePostAlarms')||'{}')}catch(e){return {}}}
function checkDue(){
 const due=dueTasks();if(!due.length)return;const seen=readSeen();let changed=false;
 for(const task of due){const key=dueKey(task);if(seen[key])continue;seen[key]=Date.now();changed=true;
  const body=(task.title||'Your planned post')+' is due now. Open Channel Studio to copy the post and publish it.';
  try{if('Notification'in window&&Notification.permission==='granted'){const n=new Notification('⏰ Channel Studio posting alarm',{body,tag:'channel-studio-'+key,requireInteraction:true});n.onclick=()=>{try{window.focus()}catch(e){}window.location.href='planner.html';n.close()}}}catch(e){}
  try{window.StudioNotify?.playTone?.(true)}catch(e){}
  window.studioToast?.('⏰ Posting time reached: '+(task.title||'Your planned post')+'. Copy it, publish it in WhatsApp, then confirm completion.');
 }
 if(changed)try{localStorage.setItem('channelStudioDuePostAlarms',JSON.stringify(seen))}catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{
 fillChannels();
 $('enableNotifications')?.addEventListener('click',async()=>{const status=$('notificationStatus');if(!('Notification'in window)){if(status)status.textContent='This browser does not support notifications.';return}const result=await Notification.requestPermission();if(status)status.textContent=result==='granted'?'✅ Posting-time notifications enabled. Keep Channel Studio open for the most reliable alarm.':result==='denied'?'Notifications are blocked. Enable them in your browser/site settings.':'Notifications were not enabled.';window.studioToast?.(result==='granted'?'Posting alerts enabled.':'Notification permission: '+result)});
 $('taskForm')?.addEventListener('submit',()=>setTimeout(()=>{fillChannels();renderDue()},120));
 $('taskList')?.addEventListener('click',()=>setTimeout(renderDue,80));
 document.addEventListener('click',e=>{const pub=e.target.closest('[data-publish-task]');if(pub){copyAndOpen(pub.dataset.publishTask);return}const done=e.target.closest('[data-confirm-posted]');if(done)confirmPosted(done.dataset.confirmPosted)});
 window.addEventListener('focus',()=>{fillChannels();checkDue();renderDue()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkDue();renderDue();fillChannels()}});
 setInterval(()=>{checkDue();renderDue()},15000);renderDue();checkDue();
});
})();
