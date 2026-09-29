const $=id=>document.getElementById(id);
let unit=0,index=0,playing=false,paused=false,sequential=false,played=0,epoch=0,timer=null,audio=null,pending=null;
function stop(){epoch++;clearTimeout(timer);pending=null;if(audio){audio.onended=null;audio.onerror=null;audio.pause();}playing=false;paused=false;played=0;$('toggle').textContent='▶';}
const favoriteKey='ielts-vocabulary.favorites.v1';
const entries=VOCAB.flatMap((u,c)=>u.words.map((w,n)=>({...w,id:c+':'+n,unit:c})));
const validIds=new Set(entries.map(w=>w.id));
let notebook=false,showMeanings=false;
const revealed=new Set(),concealed=new Set();
let favorites=new Set();
try{const saved=JSON.parse(localStorage.getItem(favoriteKey)||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(id=>validIds.has(id)));}catch{}
function words(){return notebook?entries.filter(w=>favorites.has(w.id)):entries.filter(w=>w.unit===unit)}
function resetView(){stop();index=0;render();$('current').textContent='选择一个单词';$('status').textContent='准备好就开始听吧'}
function saveFavorites(){try{localStorage.setItem(favoriteKey,JSON.stringify([...favorites]));$('storageNote').textContent='星标已保存到当前浏览器';}catch{$('storageNote').textContent='浏览器禁止保存，星标仅在本次使用中保留';}}
function toggleFavorite(w){
 favorites.has(w.id)?favorites.delete(w.id):favorites.add(w.id);saveFavorites();
 if(notebook){resetView();}else{const active=index;render();if(playing){$('word-'+active)?.classList.add('selected');status();}}
}
function fillMeaning(element,id){
 element.innerHTML='';
 const data=typeof MEANINGS!=='undefined'?MEANINGS[id]:null;
 if(data?.image){const img=document.createElement('img');img.src=data.image;img.alt='原书中文释义';img.width=data.width;img.loading='lazy';element.append(img)}
 else element.textContent='正在加载原书释义…';
}
function render(){
 applyTheme(unit);
 $('favoriteCount').textContent=favorites.size;
 $('notebook').setAttribute('aria-pressed',String(notebook));
 $('units').innerHTML='';VOCAB.forEach((u,n)=>{const b=document.createElement('button');b.innerHTML='<span>'+String(n+1).padStart(2,'0')+'</span>'+u.name;b.className=!notebook&&n===unit?'active':'';b.setAttribute('aria-current',!notebook&&n===unit?'true':'false');b.onclick=()=>{unit=n;notebook=false;resetView()};$('units').append(b)});
 $('chapter').textContent=notebook?'MY VOCABULARY':'CHAPTER '+String(unit+1).padStart(2,'0');
 $('title').textContent=notebook?'我的单词本':VOCAB[unit].name;
 $('count').textContent=words().length+' 个词条 · '+(notebook?'已加星标，按原书顺序':'按书中分类');
 $('listTitle').textContent=notebook?'星标单词':'单词列表';
 $('words').innerHTML='';
 words().forEach((w,n)=>{
  const row=document.createElement('div');row.className='word';row.id='word-'+n;
  const num=document.createElement('span');num.className='number';num.textContent=String(n+1).padStart(2,'0');row.append(num);
  const body=document.createElement('div');body.className='word-body';
  const b=document.createElement('button');b.className='wordname';b.textContent=w.word;
  const meaning=document.createElement('div');meaning.className='meaning';meaning.id='meaning-'+w.id.replace(':','-');
  meaning.dataset.meaningId=w.id;fillMeaning(meaning,w.id);
  const meaningToggle=document.createElement('button');meaningToggle.className='meaning-toggle';meaningToggle.setAttribute('aria-label',w.word+' 中文释义');meaningToggle.setAttribute('aria-controls',meaning.id);
  const sync=()=>{const visible=showMeanings?!concealed.has(w.id):revealed.has(w.id);meaning.hidden=!visible;meaningToggle.setAttribute('aria-expanded',String(visible));meaningToggle.textContent=visible?'收起中文':'中文';};
  const reveal=()=>{if(showMeanings){concealed.has(w.id)?concealed.delete(w.id):concealed.add(w.id);sync();return;}revealed.has(w.id)?revealed.delete(w.id):revealed.add(w.id);sync()};
  b.onclick=e=>{e.stopPropagation();start(n,false)};meaningToggle.onclick=e=>{e.stopPropagation();reveal()};sync();body.append(b);row.append(body,meaning);
  row.onclick=e=>{if(!e.target.closest('button'))start(n,false)};
  const star=document.createElement('button');star.className='star';star.textContent=favorites.has(w.id)?'★':'☆';star.setAttribute('aria-pressed',String(favorites.has(w.id)));star.setAttribute('aria-label',(favorites.has(w.id)?'移出单词本：':'加入单词本：')+w.word);star.onclick=e=>{e.stopPropagation();toggleFavorite(w)};row.append(star);
  const p=document.createElement('span');p.className='page';p.textContent='p. '+w.page;row.append(p,meaningToggle);
  for(const [accent,label] of [['1','英音'],['2','美音']]){const v=document.createElement('button');v.className='voice';v.textContent='♪ '+label;v.setAttribute('aria-label',w.word+' '+label);v.onclick=e=>{e.stopPropagation();$('accent').value=accent;start(n,false)};row.append(v)}
  $('words').append(row)
 });
 if(!words().length){const empty=document.createElement('p');empty.className='empty-notebook';empty.textContent='还没有星标单词。到任意章节点击 ☆，就能在这里集中复习。';$('words').append(empty)}
 for(const id of ['playAll','toggle','prev','next'])$(id).disabled=!words().length;
 $('position').textContent='— / '+words().length;
 if(typeof loadMeanings==='function')for(const chapter of new Set(words().map(w=>w.unit))){
  loadMeanings(chapter).then(()=>{document.querySelectorAll('[data-meaning-id]').forEach(el=>{if(el.dataset.meaningId.startsWith(chapter+':')){fillMeaning(el,el.dataset.meaningId);if(!MEANINGS[el.dataset.meaningId])el.textContent='此词释义正在核对';}})}).catch(()=>{document.querySelectorAll('[data-meaning-id]').forEach(el=>{if(el.dataset.meaningId.startsWith(chapter+':'))el.textContent='释义加载失败，请刷新重试';})});
 }

}
$('notebook').onclick=()=>{notebook=!notebook;resetView()};
$('showMeanings').onchange=()=>{showMeanings=$('showMeanings').checked;revealed.clear();concealed.clear();render();if(playing){$('word-'+index)?.classList.add('selected');status()}};
window.addEventListener('storage',e=>{if(e.key!==favoriteKey)return;try{const saved=JSON.parse(e.newValue||'[]');favorites=new Set(Array.isArray(saved)?saved.filter(id=>validIds.has(id)):[]);resetView()}catch{}});
function status(){const limit=Number($('repeat').value);$('status').textContent=`${$('accent').value==='1'?'英式':'美式'} · 第 ${played+1}${limit?' / '+limit:''} 次${paused?' · 已暂停':''}`;$('position').textContent=`${index+1} / ${words().length}`;}
function fail(message){stop();$('status').textContent=message;}
function start(n,seq){stop();if(!words().length)return;index=n;sequential=seq;playing=true;document.querySelectorAll('.word.selected').forEach(e=>e.classList.remove('selected'));$('word-'+index)?.classList.add('selected');$('current').textContent=words()[index].word;$('toggle').textContent='Ⅱ';play(epoch);}
function play(token){if(token!==epoch||!playing||paused)return;status();if(!audio){audio=new Audio();audio.preload='auto';}audio.src=`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(words()[index].word)}&type=${$('accent').value}`;audio.playbackRate=Number($('rate').value);audio.onended=()=>{if(token!==epoch)return;played++;const max=Number($('repeat').value);if(max===0||played<max){pending=()=>play(token);timer=setTimeout(pending,Number($('gap').value));return}if(sequential&&(index<words().length-1||$('loop').checked)){pending=()=>{if(token===epoch)start((index+1)%words().length,true)};timer=setTimeout(pending,Number($('gap').value));return}stop();$('status').textContent='播放完成';};audio.onerror=()=>{if(token===epoch)fail('音频加载失败，请检查网络后重试')};audio.play().catch(e=>{if(token===epoch)fail(e.name==='NotAllowedError'?'请点击播放按钮继续':'音频暂不可用，请重试')});}
function toggle(){if(!playing){start(index,false);return}if(paused){paused=false;$('toggle').textContent='Ⅱ';if(audio&&!audio.ended){audio.play().catch(()=>fail('请重试播放'))}else if(pending){const action=pending;pending=null;action()}else play(epoch)}else{paused=true;clearTimeout(timer);audio?.pause();$('toggle').textContent='▶'}status();}
$('toggle').onclick=toggle;$('stop').onclick=()=>{stop();$('status').textContent='已停止'};$('prev').onclick=()=>start((index-1+words().length)%words().length,sequential);$('next').onclick=()=>start((index+1)%words().length,sequential);$('playAll').onclick=()=>start(0,true);
for(const id of ['accent','repeat','gap','rate'])$(id).onchange=()=>{if(playing)start(index,sequential)};
window.addEventListener('pagehide',stop);render();
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 try{Promise.resolve(document.modelContext.registerTool({name:'select_vocabulary_unit',description:'Switch to one of the 22 book units and display its words and theme. Stops current audio.',inputSchema:{type:'object',properties:{unit:{type:'integer',minimum:1,maximum:22}},required:['unit'],additionalProperties:false},execute(input){if(!input||!Number.isInteger(input.unit)||input.unit<1||input.unit>22)throw new Error('Unit must be an integer from 1 to 22');stop();unit=input.unit-1;notebook=false;index=0;render();$('current').textContent='选择一个单词';$('status').textContent='准备好就开始听吧';return {unit:unit+1,name:VOCAB[unit].name,wordCount:words().length}}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
