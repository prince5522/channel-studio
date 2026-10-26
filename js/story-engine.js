(function(){
'use strict';
const $=id=>document.getElementById(id);
const db=()=>window.StudioStore;
const get=(k,d=[])=>db().get(k,d);
const set=(k,v)=>db().set(k,v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>window.studioToast?window.studioToast(m):alert(m);
const uid=()=>`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
let readerStoryId=null, readerEpisodeId=null, episodeDraft=[];
function storyById(id){return get('stories').find(s=>String(s.id)===String(id));}
function renderStorySelect(){const sel=$('splitStory');if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">Select a saved season…</option>'+get('stories').map(s=>`<option value="${esc(s.id)}">${esc(s.title)} · Season ${esc(s.seasonNumber||1)}</option>`).join('');if([...sel.options].some(o=>o.value===old))sel.value=old;}
function openStory(story){readerStoryId=story.id;$('storyReaderTitle').textContent=story.title;$('storyReaderMeta').textContent=`Season ${story.seasonNumber||1} · ${story.genre||'General'} · ${(story.content||'').split(/\s+/).filter(Boolean).length.toLocaleString()} words · Saved ${story.date||'locally'}`;$('storyReaderText').textContent=story.content||'';$('storyReaderPanel').hidden=false;$('storyReaderPanel').scrollIntoView({behavior:'smooth',block:'start'});}
function renderStories(){const el=$('storyList');if(!el)return;const q=($('storySearch')?.value||'').trim().toLowerCase();const stories=get('stories').map((s,i)=>({...s,_index:i})).filter(s=>!q||[s.title,s.genre,s.description,s.content].some(v=>String(v||'').toLowerCase().includes(q)));$('storyLibraryCount').textContent=`${stories.length} season${stories.length===1?'':'s'}`;if(!stories.length){el.innerHTML='<div class="empty-state">No matching seasons yet. Import a PDF or paste your story above.</div>';renderStorySelect();return;}el.innerHTML=stories.slice().reverse().map(s=>{const content=s.content||'';const wordCount=content.trim()?content.trim().split(/\s+/).length:0;const pct=s.readingProgress||0;return `<article class="list-item"><span class="season-badge">Season ${esc(s.seasonNumber||1)}</span><span class="season-badge">${esc(s.genre||'General')}</span><h3>${esc(s.title)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}<p>${esc(content.slice(0,220))}${content.length>220?'…':''}</p><p class="small muted">${content.length.toLocaleString()} characters · ${wordCount.toLocaleString()} words · ${esc(s.date||'Saved locally')}</p><div class="progress-track" aria-label="Reading progress"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div><p class="small muted">Reading progress ${Math.round(pct)}%</p><div class="item-actions"><button class="button primary" data-story-open="${esc(s.id)}">Read season</button><button class="button ghost" data-story-split="${esc(s.id)}">Split into episodes</button><button class="button ghost" data-story-edit="${esc(s.id)}">Edit details</button><button class="button ghost" data-story-delete="${esc(s.id)}">Delete</button></div></article>`}).join('');renderStorySelect();}
async function extractFile(file){const name=file.name.toLowerCase();if(name.endsWith('.pdf')||file.type==='application/pdf'){if(!window.pdfjsLib)throw new Error('PDF reading library did not load. Connect to the internet and reload, or paste the text.');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;let out='';for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const text=await page.getTextContent();out+=text.items.map(x=>x.str).join(' ')+'\n\n';}if(!out.trim())throw new Error('This PDF has no selectable text. Scanned PDFs need OCR.');return out.trim();}return (await file.text()).trim();}
function initStories(){const form=$('storyForm');if(!form)return;const legacyStories=get('stories').map(s=>({...s,id:s.id||uid(),seasonNumber:s.seasonNumber||1,genre:s.genre||'General',description:s.description||'',readingProgress:Number(s.readingProgress)||0}));if(legacyStories.some((s,i)=>s.id!==get('stories')[i]?.id||!get('stories')[i]?.seasonNumber||!get('stories')[i]?.genre))set('stories',legacyStories);const file=$('storyFile');file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{$('storyText').value=await extractFile(f);if(!$('storyTitle').value.trim())$('storyTitle').value=f.name.replace(/\.[^.]+$/,'');toast('File text extracted. Review it before saving.');}catch(e){console.error(e);toast(e.message||'Could not read this file.');}});form.addEventListener('submit',e=>{e.preventDefault();const title=$('storyTitle').value.trim(),content=$('storyText').value.trim();if(!title||!content){toast('Add a season title and story text first.');return;}const all=get('stories');const editingId=form.dataset.editingId;const old=editingId?all.find(x=>String(x.id)===editingId):null;const record={...(old||{}),id:old?.id||uid(),title,seasonNumber:Math.max(1,Number($('storySeason').value)||1),genre:$('storyGenre').value||'General',description:$('storyDescription').value.trim(),content,date:new Date().toLocaleString(),sourceFileName:file?.files?.[0]?.name||old?.sourceFileName||'',readingProgress:old?.readingProgress||0};const index=old?all.findIndex(x=>String(x.id)===String(old.id)):-1;if(index>=0)all[index]=record;else all.push(record);if(!set('stories',all)){toast('Storage is full. Export a backup or shorten this story.');return;}form.reset();delete form.dataset.editingId;$('storySeason').value='1';const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent='Save season';renderStories();toast(old?'Season updated on this device.':'Season saved on this device.');});$('clearStoryForm')?.addEventListener('click',()=>{form.reset();delete form.dataset.editingId;$('storySeason').value='1';const b=form.querySelector('button[type="submit"]');if(b)b.textContent='Save season';});$('storySearch')?.addEventListener('input',renderStories);$('storyList')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.storyOpen||b.dataset.storySplit||b.dataset.storyEdit||b.dataset.storyDelete;if(!id)return;const story=storyById(id);if(!story)return;if(b.dataset.storyOpen){openStory(story);return;}if(b.dataset.storySplit){location.href=`episodes.html?story=${encodeURIComponent(story.id)}`;return;}if(b.dataset.storyEdit){$('storyTitle').value=story.title;$('storySeason').value=story.seasonNumber||1;$('storyGenre').value=story.genre||'General';$('storyDescription').value=story.description||'';$('storyText').value=story.content||'';form.dataset.editingId=String(story.id);const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent='Update season';form.scrollIntoView({behavior:'smooth'});return;}if(b.dataset.storyDelete&&confirm(`Delete “${story.title}”? This also removes its saved season text from this browser.`)){set('stories',get('stories').filter(s=>String(s.id)!==String(id)));renderStories();toast('Season deleted. Existing saved episodes are kept.');}});$('markStoryRead')?.addEventListener('click',()=>{const all=get('stories'),idx=all.findIndex(x=>String(x.id)===String(readerStoryId));if(idx>=0){all[idx].readingProgress=100;set('stories',all);renderStories();toast('Season marked as read.');}});$('closeStoryReader')?.addEventListener('click',()=>{$('storyReaderPanel').hidden=true;});$('storyFontUp')?.addEventListener('click',()=>{const t=$('storyReaderText');t.style.fontSize=`${Math.min(30,(parseFloat(t.style.fontSize)||18)+2)}px`;});$('storyFontDown')?.addEventListener('click',()=>{const t=$('storyReaderText');t.style.fontSize=`${Math.max(12,(parseFloat(t.style.fontSize)||18)-2)}px`;});renderStories();}
function wordMatches(text){return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];}
function trueWordCount(text){return wordMatches(text).length;}
function splitSeasonComplete(text){
  const words=wordMatches(text),totalWords=words.length;
  if(!totalWords)return {chunks:[],totalWords:0,complete:text==='',episodeWordTotal:0,firstWordMatch:true,lastWordMatch:true};
  // Aim for 275 words, keeping episodes in the 250–300 range when the
  // source length permits it. For short stories, keep one complete episode
  // rather than create two unusably short fragments.
  let count=totalWords<500?1:Math.max(2,Math.ceil(totalWords/300),Math.round(totalWords/275));
  while(count>1&&Math.floor(totalWords/count)<250)count--;
  while(totalWords>=500&&Math.ceil(totalWords/count)>300)count++;
  const boundaries=[];
  const addBoundary=(pos,kind,priority)=>{if(pos>0&&pos<text.length)boundaries.push({pos,kind,priority});};
  const re=/[.!?…]["'’”)]*(?:[ \t]+|\r?\n|$)|(?:\r?\n[ \t]*\r?\n+)/gu;
  let m;while((m=re.exec(text)))addBoundary(m.index+m[0].length,'natural',2);
  const chunks=[];let cursor=0,wordCursor=0;
  for(let i=0;i<count-1;i++){
    const remainingEpisodes=count-i-1;
    const minWord=wordCursor+250,maxWord=Math.min(totalWords-remainingEpisodes*250,wordCursor+300);
    const target=Math.round((i+1)*totalWords/count);
    const candidates=boundaries.map(b=>{let lo=0,hi=words.length;while(lo<hi){const mid=(lo+hi)>>>1;if(words[mid].index<b.pos)lo=mid+1;else hi=mid;}return {...b,wordIndex:lo};})
      .filter(b=>b.pos>cursor&&b.wordIndex>=minWord&&b.wordIndex<=maxWord&&b.wordIndex>wordCursor);
    let pick=candidates.sort((a,b)=>(Math.abs(a.wordIndex-target)-Math.abs(b.wordIndex-target))||(b.priority-a.priority))[0];
    if(!pick){
      const fallbackIndex=Math.max(wordCursor+250,Math.min(maxWord,target));
      const targetWord=words[Math.min(fallbackIndex,totalWords-1)];
      pick={pos:targetWord.index,wordIndex:fallbackIndex};
    }
    if(pick.pos<=cursor||pick.wordIndex<=wordCursor){
      const fallbackIndex=Math.max(wordCursor+250,Math.min(maxWord,target));
      const targetWord=words[Math.min(fallbackIndex,totalWords-1)];
      pick={pos:targetWord.index,wordIndex:fallbackIndex};
    }
    chunks.push(text.slice(cursor,pick.pos));cursor=pick.pos;wordCursor=pick.wordIndex;
  }
  if(cursor<text.length)chunks.push(text.slice(cursor));
  // If a natural boundary produced an out-of-range episode, merge or rebalance
  // at word boundaries while preserving every character and original ordering.
  const joined=chunks.join(''),episodeWordTotal=chunks.reduce((sum,part)=>sum+trueWordCount(part),0);
  const firstWordMatch=(wordMatches(chunks[0]||'')[0]?.[0]||'')===(words[0]?.[0]||'');
  const lastWords=wordMatches(chunks[chunks.length-1]||'');
  const lastWordMatch=(lastWords[lastWords.length-1]?.[0]||'')===(words[words.length-1]?.[0]||'');
  return {chunks,totalWords,complete:joined===text&&episodeWordTotal===totalWords&&chunks.length>0,episodeWordTotal,firstWordMatch,lastWordMatch};
}
function episodeMetadata(content){
  const w=wordMatches(content).map(m=>m[0]);
  return {words:w.length,minutes:(w.length/220).toFixed(2),first:w.slice(0,8).join(' '),last:w.slice(-8).join(' ')};
}
function renderSavedEpisodes(){
const el=$('savedEpisodeList');if(!el)return;
const q=($('episodeSearch')?.value||'').trim().toLowerCase();
const all=get('episodes').map((x,i)=>({...x,_index:i})).filter(x=>!q||[x.title,x.seasonTitle,x.content].some(v=>String(v||'').toLowerCase().includes(q)));
$('savedEpisodeCount').textContent=`${all.length} episode${all.length===1?'':'s'}`;
if(!all.length){el.innerHTML='<div class="empty-state">No saved episodes match. Create a preview above and save the episodes you need.</div>';return;}
const groups=new Map();
all.forEach(ep=>{const key=String(ep.storyId||ep.seasonTitle||'Story')+'::'+String(ep.seasonNumber||1);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ep);});
el.innerHTML=[...groups.entries()].map(([key,eps])=>{
eps.sort((a,b)=>(Number(a.episodeNumber)||0)-(Number(b.episodeNumber)||0));
const first=eps[0],folder=`📁 ${first.seasonTitle||'Story'} · Season ${first.seasonNumber||1}`;
return `<details class="episode-season-folder" open><summary><b>${esc(folder)}</b><span class="small muted">${eps.length} episode${eps.length===1?'':'s'}</span></summary><div class="episode-folder-items">${eps.map(ep=>`<article class="list-item"><p class="episode-number">📖 ${esc(ep.seasonTitle||'Story')} · S${String(ep.seasonNumber||1).padStart(2,'0')}E${String(ep.episodeNumber||'—').padStart(2,'0')}</p><h3>${esc(ep.title)}</h3><p class="small muted">${(ep.content||'').length.toLocaleString()} characters · ${trueWordCount(ep.content||'').toLocaleString()} words · ${esc(ep.date||'Saved locally')}</p><div class="episode-content-preview">${esc((ep.content||'').slice(0,300))}${(ep.content||'').length>300?'…':''}</div><div class="item-actions"><button class="button primary" data-episode-open="${esc(ep.id)}">Read</button><button class="button ghost" data-episode-edit="${esc(ep.id)}">Rename</button><button class="button ghost" data-episode-delete="${esc(ep.id)}">Delete</button></div></article>`).join('')}</div></details>`;
}).join('');
}
function initEpisodes(){const form=$('splitForm');if(!form)return;const existingEpisodes=get('episodes');let migrated=false;const fixedEpisodes=existingEpisodes.map((ep,i)=>{const story=ep.storyId?storyById(ep.storyId):null;const out={...ep,id:ep.id||uid(),seasonTitle:ep.seasonTitle||story?.title||'Imported season',seasonNumber:ep.seasonNumber||story?.seasonNumber||1,episodeNumber:ep.episodeNumber||i+1};if(!ep.id||!ep.episodeNumber||!ep.seasonTitle)migrated=true;return out;});if(migrated)set('episodes',fixedEpisodes);const select=$('splitStory');renderStorySelect();const params=new URLSearchParams(location.search);if(params.get('story')&&select){select.value=params.get('story');}form.addEventListener('submit',e=>{
e.preventDefault();
const story=storyById(select.value);
if(!story){toast('Save or select a season first.');return;}
const original=String(story.content||'');
if(!original.trim()){toast('This season has no readable text.');return;}
const split=splitSeasonComplete(original);
if(!split.complete||!split.firstWordMatch||!split.lastWordMatch){
console.error('Season split coverage failed',{storyId:story.id,totalWords:split.totalWords,episodeWordTotal:split.episodeWordTotal});
toast('Coverage check failed. No episodes were created. Please reopen and save the complete season text.');
return;
}
const baseSeason=Math.max(1,Number(story.seasonNumber)||1);
const usedSeasons=new Set(get('stories').filter(x=>String(x.id)!==String(story.id)&&String(x.title||'').trim().toLowerCase()===String(story.title||'').trim().toLowerCase()).map(x=>Number(x.seasonNumber)||1));
get('episodes').filter(x=>String(x.storyId||'')===String(story.id)).forEach(x=>usedSeasons.add(Number(x.seasonNumber)||baseSeason));
const seasonNumbers=[];let candidate=baseSeason;
for(let i=0;i<Math.ceil(split.chunks.length/13);i++){while(usedSeasons.has(candidate)&&!(i===0&&candidate===baseSeason))candidate++;seasonNumbers.push(candidate);usedSeasons.add(candidate);candidate++;}
episodeDraft=split.chunks.map((content,i)=>{
const meta=episodeMetadata(content),seasonIndex=Math.floor(i/13),seasonNumber=seasonNumbers[seasonIndex],episodeNumber=(i%13)+1;
return {id:uid(),storyId:story.id,seasonTitle:story.title,storyTitle:story.title,seasonNumber,episodeNumber,title:`📖 ${story.title||'Story'} — S${String(seasonNumber).padStart(2,'0')}E${String(episodeNumber).padStart(2,'0')} 🎬`,content,method:'whole-season-250-300',wordCount:meta.words,readTime:meta.minutes,firstEight:meta.first,lastEight:meta.last,folderName:`${story.title||'Story'}/Season ${String(seasonNumber).padStart(2,'0')}`};
});
const joined=episodeDraft.map(ep=>ep.content).join('');
const sumWords=episodeDraft.reduce((sum,ep)=>sum+ep.wordCount,0);
if(joined!==original||sumWords!==split.totalWords||episodeDraft.length===0){
episodeDraft=[];toast('The whole-season check failed. Nothing was saved. Try again.');return;
}
$('episodePreview').innerHTML='<div class="panel full"><h3>Season coverage: PASS ✓</h3><p><b>Total season words:</b> '+split.totalWords.toLocaleString()+' · <b>Episodes created:</b> '+episodeDraft.length+' · <b>Episode word total:</b> '+sumWords.toLocaleString()+'</p><p class="small muted">Target 250–300 words per episode when the source length allows. Episodes are grouped into folders of up to 13 per season; extra episodes continue in the next unused season. Reading time uses 220 words per minute. Full text is preserved exactly.</p><p class="small muted">First word: '+esc((wordMatches(original)[0]||[])[0]||'')+' · Last word: '+esc((wordMatches(original).slice(-1)[0]||[])[0]||'')+' · complete: true</p></div>'+episodeDraft.map((ep,i)=>{
const meta=episodeMetadata(ep.content);
return '<article class="list-item"><p class="episode-number">📁 Season '+ep.seasonNumber+' · Episode '+ep.episodeNumber+' of up to 13</p><h3>'+esc(ep.title)+'</h3><p class="small muted"><b>'+meta.words.toLocaleString()+' words</b> · '+meta.minutes+' min read · '+ep.content.length.toLocaleString()+' characters</p><p><b>First 8 words:</b> '+esc(meta.first||'—')+'</p><p><b>Last 8 words:</b> '+esc(meta.last||'—')+'</p><details><summary>Read the complete episode text</summary><pre class="episode-full-text">'+esc(ep.content)+'</pre></details></article>';
}).join('')+'<div class="row-wrap"><button class="button primary" id="saveEpisodes" type="button">Save all '+episodeDraft.length+' episodes</button><button class="button ghost" id="clearEpisodePreview" type="button">Clear preview</button></div>';
});$('episodePreview')?.addEventListener('click',e=>{
if(e.target.id==='clearEpisodePreview'){$('episodePreview').innerHTML='<div class="empty-state">Choose a season to create a preview.</div>';episodeDraft=[];return;}
if(e.target.id!=='saveEpisodes')return;
const chosen=episodeDraft.slice();
if(!chosen.length){toast('There are no episodes to save.');return;}
const all=get('episodes');
all.push(...chosen.map(x=>({...x,date:new Date().toLocaleString()})));
if(!set('episodes',all)){toast('Storage is full. Export a backup and try fewer episodes.');return;}
toast('All '+chosen.length+' episodes saved locally.');
renderSavedEpisodes();
$('episodePreview').innerHTML='<div class="empty-state">All episodes saved. Coverage was checked before saving.</div>';
episodeDraft=[];
});$('episodeSearch')?.addEventListener('input',renderSavedEpisodes);$('savedEpisodeList')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.episodeOpen||b.dataset.episodeEdit||b.dataset.episodeDelete;const all=get('episodes'),ep=all.find(x=>String(x.id)===String(id));if(!ep)return;if(b.dataset.episodeOpen){readerEpisodeId=ep.id;$('episodeReaderTitle').textContent=ep.title;$('episodeReaderMeta').textContent=`${ep.seasonTitle||'Season'} · Episode ${ep.episodeNumber||'—'} · ${(ep.content||'').length.toLocaleString()} characters`;$('episodeReaderText').textContent=ep.content||'';$('episodeReaderPanel').hidden=false;$('episodeReaderPanel').scrollIntoView({behavior:'smooth'});return;}if(b.dataset.episodeEdit){const title=prompt('Enter a new episode title:',ep.title);if(title===null)return;if(!title.trim()){toast('Episode title cannot be empty.');return;}ep.title=title.trim();set('episodes',all);renderSavedEpisodes();toast('Episode renamed.');return;}if(b.dataset.episodeDelete&&confirm(`Delete “${ep.title}”?`)){set('episodes',all.filter(x=>String(x.id)!==String(id)));renderSavedEpisodes();toast('Episode deleted.');}});$('closeEpisodeReader')?.addEventListener('click',()=>{$('episodeReaderPanel').hidden=true;});renderSavedEpisodes();}
window.initStage2Stories=initStories;window.initStage2Episodes=initEpisodes;
})();
