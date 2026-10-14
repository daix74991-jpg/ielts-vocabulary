(function(root){
 'use strict';
 function timedFetch(fetcher,timeout=12000){
  return async function(input,options={}){
   const controller=new AbortController(),signal=options.signal;
   let rejectAbort;
   const cancelled=new Promise((_,reject)=>{rejectAbort=reject});
   const abort=()=>{controller.abort();rejectAbort(Object.assign(Error('request timed out or cancelled'),{code:'request_timeout'}))};
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(abort,timeout);
   try{
    return await Promise.race([(async()=>{
     const response=await fetcher(input,{...options,signal:controller.signal});
     // fetch resolves at response HEADERS, not at the end of the body.
     // Buffer under the same deadline so SDK response.json() cannot hang later.
     if(typeof response.arrayBuffer!=='function')return response;
     const body=await response.arrayBuffer();
     return new Response([101,204,205,304].includes(response.status)?null:body,{status:response.status,statusText:response.statusText,headers:response.headers});
    })(),cancelled]);
   }
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
  };
 }
 async function signIn(client,credentials,config,fetcher,onRepair=()=>{},signal){
  let result=await client.auth.signInWithPassword(credentials);
  if(signal?.aborted)throw Object.assign(Error('cancelled'),{code:'request_timeout'});
  if(!result.error&&!result.data?.session)return {error:{code:'session_not_created'}};
  if(result.error?.code!=='email_not_confirmed')return result;
  // The password grant checks the existing password BEFORE email_not_confirmed.
  // Only use the provider's existing auto-confirm policy; never alter settings.
  const response=await fetcher(config.url+'/auth/v1/settings',{headers:{apikey:config.publicKey},signal});
  if(!response.ok)throw Error('settings unavailable');
  const settings=await response.json();
  if(signal?.aborted)throw Object.assign(Error('cancelled'),{code:'request_timeout'});
  if(settings.mailer_autoconfirm!==true||settings.disable_signup)return result;
  onRepair();
  // GoTrue reuses an unconfirmed user's ID and password on this signup path.
  // No deletion, password reset, admin key, or account migration is involved.
  result=await client.auth.signUp(credentials);
  if(result.error?.code==='user_already_exists')return client.auth.signInWithPassword(credentials);
  if(!result.error&&!result.data?.session)return {error:{code:'email_not_confirmed'}};
  return result;
 }
 function deadline(run,timeout=25000){
  const controller=new AbortController();let timer;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('login deadline'),{code:'request_timeout'}))},timeout)});
  return Promise.race([Promise.resolve().then(()=>run(controller.signal)),expired]).finally(()=>clearTimeout(timer));
 }
 function errorMessage(error){
  switch(error?.code){
   case 'request_timeout':return '登录等待超时，已停止等待。请点击“检查连接”确认账号服务是否能连接，再用原账号重试。';
   case 'invalid_credentials':return '邮箱或密码不正确，请检查后重试。';
   case 'email_not_confirmed':return '旧账号尚未完成邮箱验证，自动处理未成功。请保留原账号，不要反复注册。';
   case 'over_email_send_rate_limit':case 'over_request_rate_limit':return '操作过于频繁，请等待一分钟后再试，避免连续点击。';
   case 'email_address_not_authorized':return '邮件服务暂不可用，请稍后再试。';
   case 'weak_password':return '密码强度不足，请使用至少 8 位的密码。';
   case 'user_already_exists':return '该邮箱已经注册，请使用原密码点击“登录”。';
   case 'signup_disabled':return '注册暂未开放，已有账号仍可登录。';
  }
  return '连接超时或网络不可用，请检查网络后重试；原账号和单词本会保留。';
 }
 root.NotebookAuth={timedFetch,signIn,errorMessage,deadline};
 if(typeof module!=='undefined')module.exports=root.NotebookAuth;
})(typeof window!=='undefined'?window:globalThis);
