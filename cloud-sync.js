(async function(){
 'use strict';
 const config=window.NOTEBOOK_CLOUD_CONFIG,bridge=window.vocabularyNotebook;
 const el=id=>document.getElementById(id);
 if(!bridge||!el('cloudPanel'))return;
 const message=text=>{el('cloudStatus').textContent=text};
 if(!config?.url||!config?.publicKey){message('邮箱同步尚未启用，目前星标只保存在这台设备。');return;}
 el('cloudPanel').hidden=false;
 if(config.passwordRecoveryEnabled===false)el('forgotPassword').hidden=true;
 let client,sync,user=null,recovery=false;
 const auth=window.NotebookAuth;
 const authError=auth.errorMessage;
 let busy=false,authAttempted=false;
 const request=auth.timedFetch(window.fetch.bind(window));
 try{
  const {createClient}=await import('./supabase-client.js');
  client=createClient(config.url,config.publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:request}});
  let storage;try{storage=localStorage}catch{storage={getItem:()=>null,setItem:()=>{throw Error('storage denied')}}}
  sync=new window.NotebookSync({storage,validIds:bridge.validIds,
   read:async uid=>{
    const records={};for(let from=0;;from+=1000){const {data,error}=await client.from('vocabulary_favorites').select('word_id,starred').eq('user_id',uid).order('word_id').range(from,from+999);if(error)throw error;for(const row of data)records[row.word_id]=row.starred;if(data.length<1000)break;}return records;
   },
   write:async(uid,ops)=>{const rows=Object.entries(ops).map(([word_id,op])=>({user_id:uid,word_id,starred:op.starred}));const {error}=await client.from('vocabulary_favorites').upsert(rows,{onConflict:'user_id,word_id'});if(error)throw error},
   show:ids=>bridge.apply(ids),notice:text=>{bridge.notice(text);message((user?'已登录 · ':'')+text)}
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
   el('cloudSummary').textContent=user?'已登录 · '+user.email:'邮箱登录 · 同步单词本';
   if(user){message('登录成功，正在合并和同步单词本…');sync.sync()}
   else{recovery=false;el('newPasswordForm').hidden=true;el('newPassword').value='';message('未登录 · 星标仅保存在当前浏览器');bridge.notice('星标保存在当前浏览器')}
  }
  client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>sessionChanged(event,session),0)});
  const action=async(fn,loading,success)=>{
   if(busy)return;busy=true;authAttempted=true;
   const buttons=[...el('authForm').querySelectorAll('button')];
   const loginButton=el('loginButton');
   buttons.forEach(b=>b.disabled=true);el('authForm').setAttribute('aria-busy','true');
   loginButton.textContent='请稍候…';message(loading);
   try{const result=await auth.deadline(fn);if(result.error)throw result.error;
    if(result.data?.session){el('loginPassword').value='';sessionChanged('SIGNED_IN',result.data.session);}
    if(success)message(success);
   }catch(error){message(authError(error))}
   finally{busy=false;buttons.forEach(b=>b.disabled=false);loginButton.textContent='登录';el('authForm').setAttribute('aria-busy','false')}
  };
  el('authForm').onsubmit=e=>{e.preventDefault();action(async signal=>{
   const credentials={email:el('loginEmail').value.trim(),password:el('loginPassword').value};
   const result=await auth.signIn(client,credentials,config,request,()=>{if(!signal.aborted)message('密码正确，正在处理旧账号的验证状态…')},signal);
   return result;
  },'正在登录，请稍候…')};
  el('registerAccount').onclick=()=>{if(!el('authForm').reportValidity())return;action(async()=>{
   const result=await client.auth.signUp({email:el('loginEmail').value.trim(),password:el('loginPassword').value,options:{emailRedirectTo:location.origin+location.pathname}});
   if(!result.error){if(!result.data?.session)message('账号尚未登录。请检查邮箱验证要求，已有账号请使用原密码登录。')}
   return result;
  },'正在注册，请稍候…')};
  // Bind controls before restoring a possibly expired session so a slow refresh
  // cannot silently leave the login form without its event handlers.
  message('正在检查登录状态…');
  auth.deadline(()=>client.auth.getSession(),15000).then(({data,error})=>{
   if(error){if(!user&&!busy&&!authAttempted)message(authError(error));return;}
   if(data.session)sessionChanged('INITIAL_SESSION',data.session);
   else if(!user&&!busy&&!authAttempted)message('未登录 · 星标仅保存在当前浏览器');
  }).catch(error=>{if(!user&&!busy&&!authAttempted)message(authError(error))});
  el('checkConnection').onclick=async()=>{
   const button=el('checkConnection');button.disabled=true;message('正在检查账号服务连接…');
   try{const response=await request(config.url+'/auth/v1/settings',{headers:{apikey:config.publicKey}});if(!response.ok)throw Error('connection failed');
    const settings=await response.json();message(user?'已登录 · 账号服务连接正常':'账号服务连接正常 · '+(settings.mailer_autoconfirm?'无需邮箱验证':'需要邮箱验证')+'。请使用原邮箱和密码登录。');
   }catch{message('当前浏览器无法连接账号服务。请换一个网络后重试；不用重新注册，账号和单词本会保留。')}
   finally{button.disabled=false}
  };
  el('forgotPassword').onclick=()=>{if(!el('loginEmail').reportValidity())return;action(()=>client.auth.resetPasswordForEmail(el('loginEmail').value.trim(),{redirectTo:location.origin+location.pathname}),'正在发送邮件…','如该邮箱可以接收重置邮件，请查看收件箱中的链接。')};
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
