(async function(){
 'use strict';
 const config=window.NOTEBOOK_CLOUD_CONFIG,bridge=window.vocabularyNotebook;
 const el=id=>document.getElementById(id);
 if(!bridge||!el('cloudPanel'))return;
 const message=text=>{el('cloudStatus').textContent=text};
 if(!config?.url||!config?.publicKey){message('邮箱同步尚未启用，目前星标只保存在这台设备。');return;}
 el('cloudPanel').hidden=false;
 let client,sync,user=null,recovery=false;
 const authError=error=>{
  const code=error?.code||'';
  if(code==='invalid_credentials')return '邮箱或密码不正确，请重试。';
  if(code==='email_not_confirmed')return '请先点击邮箱中的验证链接，然后登录。';
  if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return '操作过于频繁，请稍后再试。';
  if(code==='email_address_not_authorized')return '邮件发送服务尚未配置，暂时无法注册或找回密码。';
  if(code==='weak_password')return '密码强度不足，请使用至少 8 位的密码。';
  if(code==='user_already_exists')return '该邮箱已注册，请登录或找回密码。';
  return '连接或登录失败，请检查网络后重试。';
 };
 try{
  const {createClient}=await import('./supabase-client.js');
  client=createClient(config.url,config.publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let storage;try{storage=localStorage}catch{storage={getItem:()=>null,setItem:()=>{throw Error('storage denied')}}}
  sync=new window.NotebookSync({storage,validIds:bridge.validIds,
   read:async uid=>{
    const records={};for(let from=0;;from+=1000){const {data,error}=await client.from('vocabulary_favorites').select('word_id,starred').eq('user_id',uid).order('word_id').range(from,from+999);if(error)throw error;for(const row of data)records[row.word_id]=row.starred;if(data.length<1000)break;}return records;
   },
   write:async(uid,ops)=>{const rows=Object.entries(ops).map(([word_id,op])=>({user_id:uid,word_id,starred:op.starred}));const {error}=await client.from('vocabulary_favorites').upsert(rows,{onConflict:'user_id,word_id'});if(error)throw error},
   show:ids=>bridge.apply(ids),notice:text=>{bridge.notice(text);message(text)}
  });
  bridge.onChange=(id,starred)=>{if(user)sync.mark(id,starred)};
  function sessionChanged(event,session){
   if(event==='PASSWORD_RECOVERY'){recovery=true;el('cloudPanel').open=true;el('newPasswordForm').hidden=false;}
   const next=session?.user||null;
   if(next?.id===user?.id)return;
   const guestIds=!user?bridge.read():[];user=next;
   bridge.switchAccount(user?.id);sync.attach(user?.id,guestIds);
   el('authForm').hidden=!!user;el('accountActions').hidden=!user;
   el('accountEmail').textContent=user?.email||'';
   if(user){message('登录成功，正在合并和同步单词本…');sync.sync()}
   else{recovery=false;el('newPasswordForm').hidden=true;el('newPassword').value='';message('未登录 · 星标仅保存在当前浏览器');bridge.notice('星标保存在当前浏览器')}
  }
  client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>sessionChanged(event,session),0)});
  const {data,error}=await client.auth.getSession();if(error)throw error;sessionChanged('INITIAL_SESSION',data.session);
  const action=async(fn,success)=>{el('authForm').querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await fn();if(result.error)throw result.error;if(success)message(success)}catch(error){message(authError(error))}finally{el('authForm').querySelectorAll('button').forEach(b=>b.disabled=false)}};
  el('authForm').onsubmit=e=>{e.preventDefault();action(async()=>{const result=await client.auth.signInWithPassword({email:el('loginEmail').value.trim(),password:el('loginPassword').value});if(!result.error)el('loginPassword').value='';return result})};
  el('registerAccount').onclick=()=>{if(!el('authForm').reportValidity())return;action(async()=>{const result=await client.auth.signUp({email:el('loginEmail').value.trim(),password:el('loginPassword').value,options:{emailRedirectTo:location.origin+location.pathname}});if(!result.error)el('loginPassword').value='';return result},'请检查邮箱，点击验证链接后再登录；若已注册可直接登录。')};
  el('forgotPassword').onclick=()=>{if(!el('loginEmail').reportValidity())return;action(()=>client.auth.resetPasswordForEmail(el('loginEmail').value.trim(),{redirectTo:location.origin+location.pathname}),'如该邮箱可以接收重置邮件，请查看收件箱中的链接。')};
  el('signOut').onclick=async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)message(authError(error))};
  el('syncNow').onclick=()=>sync.sync();
  el('newPasswordForm').onsubmit=async e=>{e.preventDefault();if(!recovery)return;const {error}=await client.auth.updateUser({password:el('newPassword').value});if(error)message(authError(error));else{el('newPassword').value='';el('newPasswordForm').hidden=true;recovery=false;message('密码已更新。')}};
  window.addEventListener('online',()=>sync.sync());
  window.addEventListener('focus',()=>sync.sync());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync.sync()});
  window.addEventListener('storage',e=>{if(user&&e.key===sync.key('pending'))sync.sync()});
  setInterval(()=>{if(user&&!document.hidden)sync.sync()},15000);
 }catch{message('云端服务未能连接，本地单词本仍可使用。')}
})();
