const assert=require('node:assert/strict');
const {NotebookSync}=require(require('node:fs').existsSync('dist/sync-core.js')?'./dist/sync-core.js':'./sync-core.js');
const validIds=['0:0','0:1','0:2'];
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
const server=new Map();let online=true;
function device(storage=store()){
 const ui={words:[],message:''};
 const sync=new NotebookSync({storage,validIds,
  read:async uid=>{if(!online)throw Error('offline');return {...server.get(uid)}},
  write:async(uid,ops)=>{if(!online)throw Error('offline');const values={...server.get(uid)};for(const [id,op] of Object.entries(ops))values[id]=op.starred;server.set(uid,values)},
  show:ids=>{ui.words=ids.sort()},notice:message=>{ui.message=message}});
 return {sync,ui,storage};
}
(async()=>{
 const pc=device(),phone=device();pc.sync.attach('A',['0:0']);phone.sync.attach('A');await pc.sync.sync();await phone.sync.sync();assert.deepEqual(phone.ui.words,['0:0']);
 await phone.sync.mark('0:1',true);await pc.sync.sync();assert.deepEqual(pc.ui.words,['0:0','0:1']);
 await phone.sync.mark('0:0',false);await pc.sync.sync();assert.deepEqual(pc.ui.words,['0:1']);
 const old=device();old.sync.attach('A',['0:0']);await old.sync.sync();assert.deepEqual(old.ui.words,['0:1'],'old guest star must respect an existing cloud unstar');
 online=false;await pc.sync.mark('0:2',true);assert.deepEqual(pc.ui.words,['0:1','0:2']);assert.match(pc.ui.message,/失败/);
 const reopened=device(pc.storage);reopened.sync.attach('A');assert.deepEqual(reopened.ui.words,['0:1','0:2'],'offline pending changes survive reload');
 online=true;await reopened.sync.sync();await phone.sync.sync();assert.deepEqual(phone.ui.words,['0:1','0:2']);
 online=false;await reopened.sync.mark('0:1',false);reopened.sync.attach('B',['0:0']);assert.deepEqual(reopened.ui.words,[],'switching accounts does not expose A favorites');online=true;await reopened.sync.sync();assert.deepEqual(reopened.ui.words,[],'guest import is bound to its first account');
 reopened.sync.attach('A');await reopened.sync.sync();assert.deepEqual(reopened.ui.words,['0:2']);assert.equal(server.get('B')?.['0:1'],undefined,'pending A edits never write to B');
 const rapid=device();rapid.sync.attach('R');await rapid.sync.sync();let release,started;const startedSignal=new Promise(r=>started=r);const original=rapid.sync.write;
 rapid.sync.write=async(uid,ops)=>{started();await new Promise(r=>release=r);await original(uid,ops);rapid.sync.write=original};
 const first=rapid.sync.mark('0:0',true);await startedSignal;rapid.sync.mark('0:0',false);release();await first;assert.equal(server.get('R')['0:0'],false,'a quick unstar during a pending write must win');
 const switching=device();let finishRead;switching.sync.read=()=>new Promise(r=>finishRead=r);switching.sync.attach('X');const stale=switching.sync.sync();switching.sync.attach('Y');finishRead({'0:0':true});await stale;assert.deepEqual(switching.ui.words,[],'stale responses cannot overwrite another account');
 const denied=device({getItem:()=>null,setItem:()=>{throw Error('blocked')}});denied.sync.attach('M',['0:1']);await denied.sync.sync();assert.deepEqual(denied.ui.words,['0:1'],'memory fallback retains the guest import when saving is denied');
 console.log('PASS: two-device stars and unstars, guest merge/tombstones, offline replay after reload, account isolation, rapid edits, stale responses, denied storage');
})().catch(e=>{console.error(e);process.exitCode=1});
