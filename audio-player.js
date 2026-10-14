(function(root){
 'use strict';
 class WordAudioPlayer{
  constructor({makeAudio=()=>new Audio(),speech=root.speechSynthesis,Utterance=root.SpeechSynthesisUtterance,delay=setTimeout,cancel=clearTimeout,timeout=5000}={}){
   Object.assign(this,{makeAudio,speech,Utterance,delay,cancel,timeout});this.audio=null;this.active=null;this.timer=null;this.serial=0;this.deviceUntil={};
   // Window timers reject an arbitrary class instance as their receiver in
   // some browsers. Call the injected functions without borrowing `this`.
   this.delay=(...args)=>delay(...args);this.cancel=(...args)=>cancel(...args);
   try{speech?.getVoices()}catch{}
  }
  clearTimer(){this.cancel(this.timer);this.timer=null}
  current(a){return this.active===a&&!a.paused}
  arm(a,fn,ms=this.timeout){this.clearTimer();this.timer=this.delay(()=>{if(this.current(a))fn()},ms)}
  stop(){
   this.serial++;this.clearTimer();const a=this.active;this.active=null;
   if(this.audio){for(const key of ['onended','onerror','onplaying','onwaiting','onstalled'])this.audio[key]=null;this.audio.pause()}
   if(a?.utterance){a.utterance.onend=a.utterance.onerror=a.utterance.onstart=null;try{this.speech.cancel()}catch{}}
  }
  play(word,accent,rate,callbacks){
   this.stop();const a={word,accent,rate,callbacks,paused:false,retried:false,serial:this.serial,source:'recording'};this.active=a;
   if(!this.audio){this.audio=this.makeAudio();this.audio.preload='auto';this.audio.playsInline=true;}
   if(this.deviceUntil[accent]>Date.now())this.fallback(a);else this.recording(a);
  }
  finish(a,error){if(!this.current(a))return;const cb=a.callbacks;this.stop();error?cb.error(error):cb.end()}
  recording(a){
   if(!this.current(a))return;const audio=this.audio,attempt=(a.attempt||0)+1;a.attempt=attempt;
   const valid=()=>this.current(a)&&a.source==='recording'&&a.attempt===attempt;
   const url='https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(a.word)+'&type='+a.accent;
   // Repetitions seek the same buffered audio instead of downloading it again.
   if(audio.src!==url||audio.error||a.retried){audio.src=url;if(a.retried)audio.load?.()}
   else{try{audio.currentTime=0}catch{audio.src=url}}
   audio.playbackRate=a.rate;
   const started=()=>{if(valid()){this.clearTimer();a.callbacks.start('recording')}};
   const waiting=()=>{if(valid()){a.callbacks.wait(a.retried?'音频连接较慢，正在重试…':'音频加载中…');this.arm(a,()=>this.fallback(a))}};
   audio.onplaying=started;audio.onwaiting=audio.onstalled=waiting;
   audio.onended=()=>{if(valid())this.finish(a)};
   audio.onerror=()=>{if(valid())this.fallback(a)};
   waiting();
   try{Promise.resolve(audio.play()).then(started).catch(error=>{
    if(!valid())return;
    if(error?.name==='NotAllowedError')this.finish(a,'请再点一次单词，允许浏览器播放声音');else this.fallback(a);
   })}catch{this.fallback(a)}
  }
  fallback(a){
   if(!this.current(a)||a.source!=='recording')return;this.clearTimer();
   const locale=a.accent==='1'?'en-gb':'en-us';let voice;
   try{voice=this.speech?.getVoices().filter(v=>v.lang?.replace('_','-').toLowerCase()===locale).sort((x,y)=>Number(y.localService)-Number(x.localService))[0]}catch{}
   if(voice&&this.Utterance){
    this.deviceUntil[a.accent]=Date.now()+60000;
    a.source='device';this.audio.onended=this.audio.onerror=this.audio.onplaying=this.audio.onwaiting=this.audio.onstalled=null;this.audio.pause();
    const utterance=new this.Utterance(a.word);a.utterance=utterance;utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=a.rate;
    a.callbacks.wait('在线音频较慢，正在使用对应的设备语音…');
    utterance.onstart=()=>{if(this.current(a)){a.callbacks.start('device');this.arm(a,()=>this.finish(a,'设备语音中断，请点击单词重试'),20000)}};
    utterance.onend=()=>this.finish(a);utterance.onerror=()=>this.finish(a,'设备语音未能播放，请点击单词重试');
    this.arm(a,()=>this.finish(a,'设备语音未能启动，请再点一次单词'));
    try{if(this.speech.paused)this.speech.resume();this.speech.speak(utterance)}catch{this.finish(a,'设备语音不可用，请点击单词重试')}
   }else if(!a.retried){a.retried=true;a.callbacks.wait('音频连接较慢，正在重试…');this.recording(a)}
   else this.finish(a,'音频加载失败，设备也没有对应英美语音；请检查网络后点击重试');
  }
  pause(){const a=this.active;if(!a)return;a.paused=true;this.clearTimer();a.source==='device'?this.speech.pause():this.audio.pause()}
  resume(){
   const a=this.active;if(!a)return false;a.paused=false;
   if(a.source==='device'){this.speech.resume();this.arm(a,()=>this.finish(a,'设备语音中断，请点击单词重试'),20000)}
   else{const attempt=a.attempt;this.arm(a,()=>this.fallback(a));try{Promise.resolve(this.audio.play()).then(()=>{if(this.current(a)&&a.source==='recording'&&a.attempt===attempt){this.clearTimer();a.callbacks.start('recording')}}).catch(()=>{if(a.attempt===attempt)this.fallback(a)})}catch{this.fallback(a)}}
   return true;
  }
 }
 root.WordAudioPlayer=WordAudioPlayer;if(typeof module!=='undefined')module.exports={WordAudioPlayer};
})(typeof window!=='undefined'?window:globalThis);
