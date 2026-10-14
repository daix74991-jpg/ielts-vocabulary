const assert=require('node:assert/strict'),fs=require('node:fs');
const {WordAudioPlayer}=require(fs.existsSync('dist/audio-player.js')?'./dist/audio-player.js':'./audio-player.js');
function harness(voices=[]){
 let next=0,loads=0,instances=0;const queue=new Map(),events=[],spoken=[];
 const audio={_src:'',currentTime:5,error:null,set src(v){loads++;this._src=v},get src(){return this._src},play(){return new Promise(()=>{})},pause(){},load(){}};
 const speech={getVoices:()=>voices,speak:u=>spoken.push(u),cancel(){},pause(){},resume(){}};
 const player=new WordAudioPlayer({makeAudio:()=>{instances++;return audio},speech,Utterance:class{constructor(text){this.text=text}},delay:(fn,ms)=>{queue.set(++next,{fn,ms});return next},cancel:id=>queue.delete(id)});
 const callbacks={start:s=>events.push(s),wait:s=>events.push(s),end:()=>events.push('end'),error:s=>events.push('error:'+s)};
 const play=(word='oxygen',accent='1')=>player.play(word,accent,1,callbacks);
 const tick=()=>{const [id,item]=queue.entries().next().value||[];assert.ok(item,'deadline exists');queue.delete(id);item.fn()};
 return {player,audio,events,spoken,queue,play,tick,get loads(){return loads},get instances(){return instances}};
}
let h=harness();h.play();h.audio.onplaying();assert.equal(h.queue.size,0);h.audio.onended();assert.equal(h.events.at(-1),'end');h.play();assert.equal(h.loads,1,'repeat reuses buffered recording');assert.equal(h.audio.currentTime,0);assert.equal(h.instances,1);
h=harness();h.play();h.tick();assert.equal(h.loads,2,'one bounded retry');h.tick();assert.match(h.events.at(-1),/^error:/);assert.equal(h.queue.size,0,'no infinite silent loading');
h=harness([{lang:'en-US',name:'US',localService:true}]);h.play('oxide','1');h.tick();assert.equal(h.spoken.length,0,'never replace UK pronunciation with a US-only voice');h.tick();assert.match(h.events.at(-1),/^error:/);
h=harness([{lang:'en-GB',name:'UK',localService:true},{lang:'en-US',name:'US',localService:true}]);
h.play('hydrosphere','1');const oldError=h.audio.onerror;h.tick();assert.equal(h.spoken.length,1);assert.equal(h.spoken[0].voice.lang,'en-GB');assert.equal(h.spoken[0].text,'hydrosphere');h.spoken[0].onstart();assert.equal(h.events.at(-1),'device');h.spoken[0].onend();assert.equal(h.events.at(-1),'end');
h.play('oxygen','1');assert.equal(h.spoken.length,2,'temporary device fallback avoids a new timeout for every repeat');
const staleEnd=h.spoken[1].onend;h.play('oxygen','2');staleEnd();oldError();assert.equal(h.player.active.word,'oxygen');assert.equal(h.player.active.accent,'2','old callbacks cannot finish or replace a new word');h.tick();assert.equal(h.spoken.at(-1).voice.lang,'en-US');
h.player.stop();assert.equal(h.queue.size,0);assert.equal(h.player.active,null);
h=harness();h.play();h.player.pause();assert.equal(h.queue.size,0,'pause suspends loading deadline');assert.equal(h.player.resume(),true);assert.equal(h.queue.size,1);h.player.stop();assert.equal(h.queue.size,0);
h=harness([{lang:'en-GB',name:'UK'}]);h.play();h.tick();h.tick();assert.match(h.events.at(-1),/^error:/,'speech engine also has a deadline');
console.log('PASS: buffered repetition, bounded loading/retry, exact UK/US fallback, fallback reuse, stale callbacks, stop, pause/resume and speech-engine timeout');
