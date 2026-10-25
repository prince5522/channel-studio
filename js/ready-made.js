(async function(){
'use strict';
if (window.ChannelStudioCloud && window.ChannelStudioCloud.ready) await window.ChannelStudioCloud.ready;
const $=id=>document.getElementById(id);
const KEY='readyMadeEpisodes';
const get=()=>window.StudioStore.get(KEY,[]);
const set=a=>window.StudioStore.set(KEY,a);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const countWords=s=>(String(s||'').trim().match(/\S+/g)||[]).length;
const readMins=s=>Math.ceil(countWords(s)/200);
let importPreview=[];
let editingId=null;
function toast(msg){if(window.studioToast)window.studioToast(msg);else alert(msg)}
function newId(){return 'rm_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function nextNumber(season){const a=get().filter(x=>Number(x.season_number)===Number(season));return a.length?Math.max(...a.map(x=>Number(x.episode_number)||0))+1:1}
function safeDate(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString()}
function formatDate(v){if(!v)return 'Not scheduled';const d=new Date(v);return Number.isNaN(d.getTime())?'Not scheduled':d.toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function defaultReminderEnabled(){return $('rmNotifyToggle')?.checked!==false}
function draftFromFields(){
 const season=Number($('rmSeason').value), supplied=$('rmNumber').value.trim();
 const number=supplied?Number(supplied):nextNumber(season);
 const text=$('rmText').value;
 return {id:newId(),season_number:season,episode_number:number,episode_name:$('rmTitle').value.trim(),episode_subtitle:$('rmSubtitle').value.trim(),episode_text:text,word_count:countWords(text),reading_time_min:readMins(text),content_rating:/\b(18\+|explicit|mature content)\b/i.test(text)?'18+':'general',source:'manual_ready_made',scheduled_post_at:null,reminder_enabled:false,reminder_channel:{push:true,in_app:true,whatsapp_sms:false},reminder_type:'one_off',status:'draft',posted_at:null,created_at:new Date().toISOString(),author_approved:false,auto_post_enabled:false,reminder_sent_at:null};
}
function updateMetrics(){const t=$('rmText').value; $('rmWordCount').textContent=countWords(t).toLocaleString()+' words'; $('rmReadTime').textContent=readMins(t)+' min read';}
function setFormBlank(){ $('rmForm').reset();$('rmSeason').value='1';$('rmWordCount').textContent='0 words';$('rmReadTime').textContent='0 min read';editingId=null; }
function render(){
 const all=get(); const fs=$('rmFilterSeason')?.value||'all', fst=$('rmFilterStatus')?.value||'all';
 const seasons=[...new Set(all.map(x=>Number(x.season_number)||1))].sort((a,b)=>a-b);
 const sel=$('rmFilterSeason'); if(sel){const old=sel.value;sel.innerHTML='<option value="all">All seasons</option>'+seasons.map(n=>`<option value="${n}">Season ${n}</option>`).join('');sel.value=seasons.includes(Number(old))?old:'all';}
 const shown=all.filter(x=>(fs==='all'||Number(x.season_number)===Number(fs))&&(fst==='all'||x.status===fst)).sort((a,b)=>(a.season_number-b.season_number)||(a.episode_number-b.episode_number));
 const el=$('rmEpisodeList');
 if(!shown.length){el.innerHTML='<div class="empty-state">No ready-made episodes match this filter. Add one above or change the filter.</div>';return}
 let lastSeason=null, out='';
 shown.forEach(ep=>{
  if(lastSeason!==ep.season_number){lastSeason=ep.season_number;out+=`<h3 class="rm-season-heading">Season ${ep.season_number} · ${shown.filter(x=>x.season_number===ep.season_number).length} episode(s)</h3>`}
  const title=ep.episode_name||`Episode ${ep.episode_number}`;
  const status=ep.status||'draft';
  const preview=(ep.episode_text||'').slice(0,260);
  out+=`<article class="rm-episode" data-ep-id="${esc(ep.id)}">
   <div class="rm-episode-head"><div><h3>Ep ${esc(ep.episode_number)} · ${esc(title)}</h3><p class="muted">${esc(ep.episode_subtitle||'No subtitle provided')}</p></div><span class="rm-pill ${esc(status)}">${esc(status)}</span></div>
   <div class="rm-meta"><span>Season ${esc(ep.season_number)}</span><span>· ${Number(ep.word_count)||countWords(ep.episode_text)} words</span><span>· ${Number(ep.reading_time_min)||readMins(ep.episode_text)} min read</span><span>· ${esc(ep.content_rating||'general')}</span></div>
   <p>${esc(preview)}${(ep.episode_text||'').length>260?'…':''}</p>
   <p class="small muted">${status==='posted'?'Posted '+formatDate(ep.posted_at):status==='scheduled'?'Scheduled '+formatDate(ep.scheduled_post_at)+' · Reminder '+(ep.reminder_enabled?'on':'off'):'Draft · not visible to readers'}</p>
   <div class="rm-episode-actions">
    <button class="button ghost" data-action="edit">Edit</button>
    <button class="button ghost" data-action="schedule">Schedule / remind</button>
    <button class="button ghost" data-action="reminder">${ep.reminder_enabled?'Turn reminder off':'Turn reminder on'}</button>
    <button class="button ghost" data-action="share">Prepare post</button>
    <button class="button ghost" data-action="posted">${status==='posted'?'Unpublish':'Mark posted'}</button>
    <button class="button ghost" data-action="duplicate">Duplicate</button>
    <button class="button ghost" data-action="delete">Delete</button>
   </div>
   <div class="rm-edit-panel" hidden></div>
  </article>`;
 });
 el.innerHTML=out;
}
function saveOne(ep){const a=get();const i=a.findIndex(x=>x.id===ep.id);if(i<0)a.push(ep);else a[i]=ep;set(a);render();}
function parseMarkerText(text){
 const normalized=String(text||'').replace(/\r\n?/g,'\n');
 const marker=/^\s*(?:#{1,6}\s*)?(?:episode|ep)\s*#?\s*(\d{1,3})(?:\s*[:—–-]\s*(.*))?\s*$/gim;
 const matches=[...normalized.matchAll(marker)];
 if(!matches.length)return [{number:null,title:'',subtitle:'',text:normalized.trim()}].filter(x=>x.text);
 return matches.map((m,i)=>{const start=m.index+m[0].length;const end=i+1<matches.length?matches[i+1].index:normalized.length;let body=normalized.slice(start,end).trim();let title=(m[2]||'').trim();let subtitle='';const lines=body.split('\n');if(lines.length&&/^subtitle\s*:/i.test(lines[0])){subtitle=lines.shift().replace(/^subtitle\s*:/i,'').trim();body=lines.join('\n').trim()}return {number:Number(m[1]),title,subtitle,text:body}}).filter(x=>x.text||x.title||x.subtitle);
}
async function readFile(file){
 const name=file.name||'';
 if(/\.docx$/i.test(name)){
  if(!window.mammoth)throw new Error('DOCX reader is still loading. Try again online or save as TXT.');
  const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return result.value||'';
 }
 if(/\.(txt|md)$/i.test(name)||file.type.startsWith('text/'))return await file.text();
 throw new Error('Unsupported file type: '+name);
}
function renderImportPreview(){
 const box=$('rmImportPreview');
 if(!importPreview.length){box.innerHTML='<div class="empty-state">No episodes detected. Try clear episode markers or paste the text manually.</div>';$('rmSaveImport').disabled=true;return}
 box.innerHTML=`<p class="small muted">${importPreview.length} episode(s) detected. Confirm names, numbers and text before saving. Blank titles/subtitles remain blank.</p>`+importPreview.map((x,i)=>`<article class="rm-import-row" data-import="${i}">
 <div class="rm-import-top"><b>Detected episode ${i+1}</b><button class="button ghost small-button" type="button" data-import-remove="${i}">Remove</button></div>
 <div class="rm-edit-grid">
 <label>Episode number<input type="number" min="1" data-field="number" value="${esc(x.number||i+1)}"></label>
 <label>Title (optional)<input type="text" data-field="title" value="${esc(x.title||'')}"></label>
 <label class="full">Subtitle (optional)<input type="text" data-field="subtitle" value="${esc(x.subtitle||'')}"></label>
 <label class="full">Episode text<textarea data-field="text">${esc(x.text||'')}</textarea></label>
 </div><p class="rm-word-preview">${countWords(x.text)} words · ${readMins(x.text)} min read</p></article>`).join('');
 $('rmSaveImport').disabled=false;
}
async function parseFiles(){
 const files=[...($('rmFiles').files||[])];if(!files.length){toast('Choose one or more files first.');return}
 importPreview=[];
 try{
  for(const file of files){const text=await readFile(file);const found=parseMarkerText(text);const filenameMatch=file.name.match(/(?:episode|ep)\s*[-_ ]*0*(\d+)/i);if(found.length===1&&found[0].number==null&&filenameMatch)found[0].number=Number(filenameMatch[1]);found.forEach(x=>{if(!x.title&&found.length===1){/* Do not invent a title. */}x.filename=file.name;importPreview.push(x)});}
  renderImportPreview();toast(importPreview.length+' episode(s) ready to review.');
 }catch(err){console.error(err);toast(err.message||'Could not read file. Try TXT or paste the text.')}
}
function saveImported(){
 const season=Number($('rmImportSeason').value)||1;const cards=[...document.querySelectorAll('.rm-import-row')];
 cards.forEach((card,i)=>{const value=field=>card.querySelector(`[data-field="${field}"]`)?.value||'';const text=value('text').trim();if(!text)return;const number=Number(value('number'))||nextNumber(season);const ep={id:newId(),season_number:season,episode_number:number,episode_name:value('title').trim(),episode_subtitle:value('subtitle').trim(),episode_text:text,word_count:countWords(text),reading_time_min:readMins(text),content_rating:/\b(18\+|explicit|mature content)\b/i.test(text)?'18+':'general',source:'manual_ready_made',scheduled_post_at:null,reminder_enabled:false,reminder_channel:{push:true,in_app:true,whatsapp_sms:false},reminder_type:'one_off',status:'draft',posted_at:null,created_at:new Date().toISOString(),author_approved:false,auto_post_enabled:false,reminder_sent_at:null,original_filename:importPreview[i]?.filename||''};const a=get();a.push(ep);set(a)});
 const saved=cards.filter(c=>(c.querySelector('[data-field="text"]')?.value||'').trim()).length;importPreview=[];$('rmFiles').value='';renderImportPreview();render();toast(saved+' ready-made episode(s) saved as drafts.');
}
function editPanel(card,ep){
 const p=card.querySelector('.rm-edit-panel');p.hidden=false;p.innerHTML=`<div class="rm-edit-grid">
 <label>Season<input type="number" min="1" data-edit="season" value="${esc(ep.season_number)}"></label>
 <label>Episode number<input type="number" min="1" data-edit="number" value="${esc(ep.episode_number)}"></label>
 <label class="full">Title<input type="text" data-edit="title" value="${esc(ep.episode_name||'')}"></label>
 <label class="full">Subtitle<input type="text" data-edit="subtitle" value="${esc(ep.episode_subtitle||'')}"></label>
 <label class="full">Text<textarea data-edit="text">${esc(ep.episode_text||'')}</textarea></label>
 </div><div class="rm-episode-actions"><button class="button primary" data-action="save-edit">Save changes</button><button class="button ghost" data-action="cancel-edit">Cancel</button></div>`;
}
async function shareEpisode(ep){
 const title=ep.episode_name||`Episode ${ep.episode_number}`;
 const text=[title,ep.episode_subtitle||'',ep.episode_text||''].filter(Boolean).join('\n\n');
 try{
  if(navigator.share){await navigator.share({title,text});toast('Share sheet opened. Choose WhatsApp if available, then select your Channel and send manually.');return}
  await navigator.clipboard.writeText(text);toast('Episode copied. Open WhatsApp, choose your Channel and paste it.');
 }catch(err){if(err?.name!=='AbortError'){try{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Episode copied. Paste it into your Channel manually.')}catch(e){toast('Select the episode text and copy it manually.')}}}
}
async function enableNotification(){
 if(!('Notification'in window)){toast('This browser does not support browser notifications.');return false}
 try{const p=await Notification.requestPermission();if(p!=='granted'){toast('Notification permission was not granted. In-app reminders still appear when you open the app.');return false}toast('Browser notifications enabled where supported.');return true}catch(e){toast('Could not request notification permission.');return false}
}
function checkReminders(){
 const all=get();let changed=false;const now=Date.now();
 all.forEach(ep=>{
  if(!ep.reminder_enabled||ep.status==='posted'||!ep.scheduled_post_at)return;
  const at=new Date(ep.scheduled_post_at).getTime();if(!Number.isFinite(at)||at>now||ep.reminder_sent_at&&new Date(ep.reminder_sent_at).getTime()>=at)return;
  ep.reminder_sent_at=new Date().toISOString();changed=true;
  const title=ep.episode_name||`Episode ${ep.episode_number}`;
  const body=ep.episode_subtitle||`Time to post Episode ${ep.episode_number}`;
  if('Notification'in window&&Notification.permission==='granted'){try{new Notification(title,{body,tag:ep.id})}catch(e){}}
  toast('Reminder: '+title+' is ready to post.');
 });
 if(changed)set(all);
}
function scheduleEpisode(ep){
 const when=prompt('Enter date and time (YYYY-MM-DDTHH:MM), for example 2026-11-02T20:00',ep.scheduled_post_at?ep.scheduled_post_at.slice(0,16):'');
 if(when===null)return;
 const iso=safeDate(when);if(!iso){toast('That date/time is invalid.');return}
 ep.scheduled_post_at=iso;ep.reminder_enabled=true;ep.status='scheduled';ep.reminder_type='one_off';ep.reminder_sent_at=null;saveOne(ep);if(defaultReminderEnabled())enableNotification();toast('Episode scheduled with a reminder. Keep in mind browser background delivery is not guaranteed.');
}
function applyCadence(){
 const count=Number($('rmCadence').value)||2;const start=safeDate($('rmCadenceStart').value);
 if(!start){toast('Choose the first posting date and time.');return}
 const drafts=get().filter(x=>x.status==='draft').sort((a,b)=>(a.season_number-b.season_number)||(a.episode_number-b.episode_number));
 if(!drafts.length){toast('There are no draft episodes to schedule.');return}
 const intervalDays=7/count;const first=new Date(start);const a=get();let offset=0;
 drafts.forEach(ep=>{const date=new Date(first.getTime()+Math.round(offset*intervalDays)*86400000);ep.scheduled_post_at=date.toISOString();ep.reminder_enabled=true;ep.status='scheduled';ep.reminder_type='smart_cadence';ep.reminder_sent_at=null;offset++;});
 set(a);render();if(defaultReminderEnabled())enableNotification();toast('Scheduled '+drafts.length+' draft episode(s) with a '+count+'x/week cadence.');
}
$('rmText').addEventListener('input',updateMetrics);
$('rmForm').addEventListener('submit',e=>{e.preventDefault();const text=$('rmText').value.trim();if(!text){toast('Episode text is required.');return}const ep=draftFromFields();if(!Number.isFinite(ep.season_number)||ep.season_number<1||!Number.isFinite(ep.episode_number)||ep.episode_number<1){toast('Enter a valid season and episode number.');return}const a=get();if(a.some(x=>x.season_number===ep.season_number&&x.episode_number===ep.episode_number)){if(!confirm('That episode number already exists in this season. Save another episode with the same number?'))return}a.push(ep);set(a);setFormBlank();render();toast('Ready-made episode saved as a draft. Text and title were not AI-modified.')});
$('rmClear').addEventListener('click',setFormBlank);
$('rmParseFiles').addEventListener('click',parseFiles);
$('rmSaveImport').addEventListener('click',saveImported);
$('rmFilterSeason').addEventListener('change',render);$('rmFilterStatus').addEventListener('change',render);
$('rmImportPreview').addEventListener('input',e=>{const card=e.target.closest('[data-import]');if(!card)return;const i=Number(card.dataset.import);if(!importPreview[i])return;const f=e.target.dataset.field;if(f==='number')importPreview[i].number=Number(e.target.value)||null;if(f==='title')importPreview[i].title=e.target.value;if(f==='subtitle')importPreview[i].subtitle=e.target.value;if(f==='text'){importPreview[i].text=e.target.value;const metric=card.querySelector('.rm-word-preview');if(metric)metric.textContent=countWords(e.target.value)+' words · '+readMins(e.target.value)+' min read'}});
$('rmImportPreview').addEventListener('click',e=>{const b=e.target.closest('[data-import-remove]');if(!b)return;importPreview.splice(Number(b.dataset.importRemove),1);renderImportPreview()});
$('rmSaveImport').disabled=true;
$('rmNotifyToggle').addEventListener('change',async e=>{if(e.target.checked)await enableNotification();else toast('Browser notifications preference switched off. Existing reminders remain in the list.')});
$('rmAutoPostToggle').addEventListener('change',()=>{toast('Automatic WhatsApp Channel posting is not supported in this build. Episodes must be sent manually.')});
$('rmEpisodeList').addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;const card=b.closest('[data-ep-id]');const id=card?.dataset.epId;let all=get();const ep=all.find(x=>x.id===id);if(!ep)return;
 switch(b.dataset.action){
 case 'edit': editPanel(card,ep);break;
 case 'cancel-edit': card.querySelector('.rm-edit-panel').hidden=true;break;
 case 'save-edit':{
  const p=card.querySelector('.rm-edit-panel');const val=k=>p.querySelector(`[data-edit="${k}"]`).value;
  const season=Number(val('season')),number=Number(val('number')),text=val('text');
  if(season<1||number<1||!text.trim()){toast('Season, episode number and text are required.');return}
  ep.season_number=season;ep.episode_number=number;ep.episode_name=val('title').trim();ep.episode_subtitle=val('subtitle').trim();ep.episode_text=text;ep.word_count=countWords(text);ep.reading_time_min=readMins(text);ep.content_rating=/\b(18\+|explicit|mature content)\b/i.test(text)?'18+':'general';saveOne(ep);toast('Episode updated.');break}
 case 'schedule':scheduleEpisode(ep);break;
 case 'reminder':ep.reminder_enabled=!ep.reminder_enabled;if(ep.reminder_enabled&&ep.scheduled_post_at&&ep.status==='draft')ep.status='scheduled';if(!ep.reminder_enabled&&ep.status==='scheduled'&&!ep.scheduled_post_at)ep.status='draft';saveOne(ep);toast('Reminder '+(ep.reminder_enabled?'enabled':'disabled')+'.');break;
 case 'share':await shareEpisode(ep);break;
 case 'posted':if(ep.status==='posted'){if(confirm('Unpublish this episode from the app library? It will become a draft; this cannot remove a post already sent to WhatsApp.')){ep.status='draft';ep.posted_at=null;ep.scheduled_post_at=null;ep.reminder_enabled=false;ep.reminder_sent_at=null;saveOne(ep);toast('Moved to draft. Remove the existing WhatsApp post separately if needed.')}}else if(confirm('Mark this episode as posted? Only do this after you have sent it in WhatsApp.')){ep.status='posted';ep.posted_at=new Date().toISOString();ep.reminder_enabled=false;saveOne(ep);toast('Marked as posted.')}break;
 case 'duplicate':{const copy={...ep,id:newId(),episode_number:nextNumber(ep.season_number),status:'draft',scheduled_post_at:null,reminder_enabled:false,posted_at:null,reminder_sent_at:null,created_at:new Date().toISOString()};all.push(copy);set(all);render();toast('Episode duplicated as a draft.');break}
 case 'delete':if(confirm('Delete this ready-made episode from this device?')){set(all.filter(x=>x.id!==id));render();toast('Episode deleted.')}break;
 }
});
$('rmApplyCadence').addEventListener('click',applyCadence);
const start=$('rmCadenceStart');if(start){const d=new Date(Date.now()+3600000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);start.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
render();checkReminders();setInterval(checkReminders,30000);
window.addEventListener('channelstudio:cloud-ready',()=>{render();toast('Your ready-made episode library is connected to Supabase.');});
window.addEventListener('channelstudio:cloud-error',e=>{console.warn('Cloud sync issue:',e.detail);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders()});
window.addEventListener('focus',checkReminders);
})();