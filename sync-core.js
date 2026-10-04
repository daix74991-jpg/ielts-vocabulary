(function(root){
 'use strict';
 class NotebookSync {
  constructor({storage,validIds,read,write,show,notice}){
   Object.assign(this,{storage,read,write,show,notice});this.valid=new Set(validIds);this.uid=null;this.epoch=0;this.working=null;this.pending={};this.cache={};this.serial=0;this.memory=new Map();
  }
  key(name,uid=this.uid){return 'ielts-vocabulary.cloud.v1.'+name+'.'+uid}
  load(key,fallback){try{const raw=this.storage.getItem(key);return raw?JSON.parse(raw):(this.memory.get(key)??fallback)}catch{return this.memory.get(key)??fallback}}
  save(key,value){this.memory.set(key,value);try{this.storage.setItem(key,JSON.stringify(value))}catch{this.notice('浏览器禁止缓存，请保持联网并等待云端保存')}}
  clean(data){const result={};for(const [id,value] of Object.entries(data||{}))if(this.valid.has(id)&&typeof value==='boolean')result[id]=value;return result}
  loadPending(){const result={};for(const [id,op] of Object.entries(this.load(this.key('pending'),{})))if(this.valid.has(id)&&typeof op?.starred==='boolean'&&typeof op?.revision==='string')result[id]=op;return result}
  emit(){const merged={...this.cache};for(const [id,op] of Object.entries(this.pending))merged[id]=op.starred;this.show(Object.keys(merged).filter(id=>merged[id]));}
  attach(uid,guestIds=[]){
   this.epoch++;this.uid=uid;this.working=null;this.pending={};this.cache={};
   if(!uid)return;
   this.cache=this.clean(this.load(this.key('cache'),{}));this.pending=this.loadPending();
   // Bind guest import to one account before any asynchronous request starts.
   const ownerKey='ielts-vocabulary.cloud.v1.guest-owner';const owner=this.load(ownerKey,null);
   if(!owner&&guestIds.length){this.save(ownerKey,uid);this.save(this.key('guest'),guestIds.filter(id=>this.valid.has(id)))}
   this.emit();this.notice('正在连接云端单词本…');
  }
  mark(id,starred){
   if(!this.uid||!this.valid.has(id))return;
   this.pending={...this.pending,...this.loadPending(),[id]:{starred,revision:Date.now()+':'+(++this.serial)+':'+Math.random().toString(36).slice(2)}};
   this.save(this.key('pending'),this.pending);this.emit();this.notice('星标已缓存，正在同步…');return this.sync();
  }
  sync(){
   if(!this.uid)return Promise.resolve();if(this.working)return this.working;
   const uid=this.uid,epoch=this.epoch;
   const current=()=>this.uid===uid&&this.epoch===epoch;
   const work=(async()=>{
    try{
     // Read first: guest import only adds absent rows, respecting cloud tombstones.
     const remote=this.clean(await this.read(uid));if(!current())return;
     this.cache=remote;this.pending={...this.pending,...this.loadPending()};
     const guests=this.load(this.key('guest'),[]);
     for(const id of guests)if(this.valid.has(id)&&!(id in remote)&&!this.pending[id])this.pending[id]={starred:true,revision:'guest:'+id};
     this.save(this.key('pending'),this.pending);this.emit();
     while(Object.keys(this.pending).length){
      const sent={...this.pending};await this.write(uid,sent);if(!current())return;
      const latest={...this.pending,...this.loadPending()};
      for(const [id,op] of Object.entries(sent)){
       this.cache[id]=op.starred;if(latest[id]?.revision===op.revision)delete latest[id];
      }
      this.pending=latest;this.save(this.key('pending'),latest);this.save(this.key('cache'),this.cache);
     }
     this.save(this.key('guest'),[]);
     const fresh=this.clean(await this.read(uid));if(!current())return;
     this.cache=fresh;this.pending={...this.pending,...this.loadPending()};this.save(this.key('cache'),fresh);this.emit();
     this.notice(Object.keys(this.pending).length?'星标已缓存，正在同步…':'已同步到账号 · 手机和电脑登录同一邮箱即可');
    }catch(error){if(current()){this.emit();this.notice('云端连接失败，本机修改已保留；恢复联网后会重试')}}
   })();
   this.working=work;work.finally(()=>{if(current())this.working=null});
   return work;
  }
 }
 root.NotebookSync=NotebookSync;
 if(typeof module!=='undefined')module.exports={NotebookSync};
})(typeof window!=='undefined'?window:globalThis);
