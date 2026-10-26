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
  const boundaries=new Map();
  const wordIndexAt=pos=>{let lo=0,hi=words.length;while(lo<hi){const mid=(lo+hi)>>>1;if(words[mid].index<pos)lo=mid+1;else hi=mid;}return lo;};
  const add=(pos,priority,kind)=>{
    if(pos<=0||pos>=text.length)return;
    const count=wordIndexAt(pos);
    if(count<=0||count>=totalWords)return;
    const old=boundaries.get(pos);
    if(!old||priority>old.priority)boundaries.set(pos,{pos,priority,kind,wordIndex:count});
  };
  const lineRe=/[^\r\n]*(?:\r\n|\n|\r|$)/gu;
  let lineMatch;
  while((lineMatch=lineRe.exec(text))){
    if(!lineMatch[0]){if(lineRe.lastIndex>=text.length)break;continue;}
    const line=lineMatch[0],pos=lineRe.lastIndex,next=text.slice(pos).match(/^[^\r\n]*(?:\r\n|\n|\r|$)/u)?.[0]||'';
    const marker=/^\s*(?:={3,}\s*page\s+\d+\s*={0,}|#{1,6}\s*(?:chapter|episode|season)\b|(?:chapter|episode|season)\s+(?:\d+|[ivxlcdm]+)\b|\*\s*\*\s*\*|[-—_]{3,})\s*$/iu.test(line.trim());
    if(marker)add(pos,6,'scene/chapter marker');
    else if(!line.trim()||!next.trim())add(pos,5,'paragraph/scene break');
    else if(line.trim())add(pos,1,'line break');
  }
  const sentenceRe=/[.!?…]["'’”)]*(?:[ \t]+|\r?\n|$)/gu;
  let sm;
  while((sm=sentenceRe.exec(text))){const p=sm.index+sm[0].length;if(p<text.length)add(p,3,'sentence end');if(!sm[0].length)sentenceRe.lastIndex++;}
  const sorted=[...boundaries.values()].sort((a,b)=>a.pos-b.pos);
  const chunks=[];
  let cursor=0,cursorWord=0,guard=0;
  while(totalWords-cursorWord>660&&guard++<totalWords+5){
    const remaining=totalWords-cursorWord;
    const options=sorted.filter(b=>b.pos>cursor&&b.wordIndex>cursorWord&&b.wordIndex-cursorWord>=400&&b.wordIndex-cursorWord<=660&&remaining-(b.wordIndex-cursorWord)>=400);
    let pick;
    if(options.length){
      pick=options.reduce((best,b)=>{
        const score=x=>x.priority*100-Math.abs((x.wordIndex-cursorWord)-600);
        return score(b)>score(best)?b:best;
      });
    }else{
      const relaxed=sorted.filter(b=>b.pos>cursor&&b.wordIndex>cursorWord&&b.wordIndex-cursorWord<=700&&remaining-(b.wordIndex-cursorWord)>=1);
      if(relaxed.length)pick=relaxed.reduce((best,b)=>Math.abs((b.wordIndex-cursorWord)-600)<Math.abs((best.wordIndex-cursorWord)-600)?b:best);
      else{
        const target=Math.min(cursorWord+600,totalWords-1),w=words[target];
        if(!w||w.index<=cursor)break;
        pick={pos:w.index,wordIndex:target,kind:'word-boundary fallback',priority:0};
      }
    }
    if(!pick||pick.pos<=cursor||pick.wordIndex<=cursorWord)break;
    chunks.push(text.slice(cursor,pick.pos));cursor=pick.pos;cursorWord=pick.wordIndex;
  }
  if(cursor<text.length)chunks.push(text.slice(cursor));
  if(chunks.length>1&&trueWordCount(chunks[chunks.length-1])<400){
    const last=chunks[chunks.length-1],prev=chunks[chunks.length-2];
    if(trueWordCount(prev)+trueWordCount(last)<=700)chunks.splice(chunks.length-2,2,prev+last);
  }
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
function renderSavedEpisodes(){const el=$('savedEpisodeList');if(!el)return;const q=($('episodeSearch')?.value||'').trim().toLowerCase();const all=get('episodes').map((x,i)=>({...x,_index:i})).filter(x=>!q||[x.title,x.seasonTitle,x.content].some(v=>String(v||'').toLowerCase().includes(q)));$('savedEpisodeCount').textContent=`${all.length} episode${all.length===1?'':'s'}`;if(!all.length){el.innerHTML='<div class="empty-state">No saved episodes match. Create a preview above and save the episodes you need.</div>';return;}el.innerHTML=all.slice().reverse().map(ep=>`<article class="list-item"><p class="episode-number">${esc(ep.seasonTitle||'Season')} · Episode ${esc(ep.episodeNumber||'—')}</p><h3>${esc(ep.title)}</h3><p class="small muted">${(ep.content||'').length.toLocaleString()} characters · ${(ep.content||'').trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words · ${esc(ep.date||'Saved locally')}</p><div class="episode-content-preview">${esc((ep.content||'').slice(0,300))}${(ep.content||'').length>300?'…':''}</div><div class="item-actions"><button class="button primary" data-episode-open="${esc(ep.id)}">Read</button><button class="button ghost" data-episode-edit="${esc(ep.id)}">Rename</button><button class="button ghost" data-episode-delete="${esc(ep.id)}">Delete</button></div></article>`).join('');}
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
episodeDraft=split.chunks.map((content,i)=>{
const meta=episodeMetadata(content);
return {id:uid(),storyId:story.id,seasonTitle:story.title,seasonNumber:story.seasonNumber||1,episodeNumber:i+1,title:(story.title||'Season')+' — S'+(story.seasonNumber||1)+' E'+String(i+1).padStart(2,'0'),content,method:'scene-breaks-and-word-count',wordCount:meta.words,readTime:meta.minutes,firstEight:meta.first,lastEight:meta.last};
});
const joined=episodeDraft.map(ep=>ep.content).join('');
const sumWords=episodeDraft.reduce((sum,ep)=>sum+ep.wordCount,0);
if(joined!==original||sumWords!==split.totalWords||episodeDraft.length===0){
episodeDraft=[];toast('The whole-season check failed. Nothing was saved. Try again.');return;
}
$('episodePreview').innerHTML='<div class="panel full"><h3>Season coverage: PASS ✓</h3><p><b>Total season words:</b> '+split.totalWords.toLocaleString()+' · <b>Episodes created:</b> '+episodeDraft.length+' · <b>Episode word total:</b> '+sumWords.toLocaleString()+'</p><p class="small muted">Automatic scene/paragraph splitting with sentence-boundary fallback. Reading time uses 220 words per minute. Full text is preserved exactly.</p><p class="small muted">First word: '+esc((wordMatches(original)[0]||[])[0]||'')+' · Last word: '+esc((wordMatches(original).slice(-1)[0]||[])[0]||'')+' · complete: true</p></div>'+episodeDraft.map((ep,i)=>{
const meta=episodeMetadata(ep.content);
return '<article class="list-item"><p class="episode-number">Episode '+(i+1)+' of '+episodeDraft.length+'</p><h3>'+esc(ep.title)+'</h3><p class="small muted"><b>'+meta.words.toLocaleString()+' words</b> · '+meta.minutes+' min read · '+ep.content.length.toLocaleString()+' characters</p><p><b>First 8 words:</b> '+esc(meta.first||'—')+'</p><p><b>Last 8 words:</b> '+esc(meta.last||'—')+'</p><details><summary>Read the complete episode text</summary><pre class="episode-full-text">'+esc(ep.content)+'</pre></details></article>';
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
