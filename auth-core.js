(function(root){
 'use strict';
 function timedFetch(fetcher,timeout=12000){
  return async function(input,options={}){
   const controller=new AbortController(),signal=options.signal;
   const abort=()=>controller.abort();
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(abort,timeout);
   try{return await fetcher(input,{...options,signal:controller.signal})}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
  };
 }
 async function signIn(client,credentials,config,fetcher,onRepair=()=>{}){
  let result=await client.auth.signInWithPassword(credentials);
  if(!result.error&&!result.data?.session)return {error:{code:'session_not_created'}};
  if(result.error?.code!=='email_not_confirmed')return result;
  // The password grant checks the existing password BEFORE email_not_confirmed.
  // Only use the provider's existing auto-confirm policy; never alter settings.
  const response=await fetcher(config.url+'/auth/v1/settings',{headers:{apikey:config.publicKey}});
  if(!response.ok)throw Error('settings unavailable');
  const settings=await response.json();
  if(settings.mailer_autoconfirm!==true||settings.disable_signup)return result;
  onRepair();
  // GoTrue reuses an unconfirmed user's ID and password on this signup path.
  // No deletion, password reset, admin key, or account migration is involved.
  result=await client.auth.signUp(credentials);
  if(result.error?.code==='user_already_exists')return client.auth.signInWithPassword(credentials);
  if(!result.error&&!result.data?.session)return {error:{code:'email_not_confirmed'}};
  return result;
 }
 function errorMessage(error){
  switch(error?.code){
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
 root.NotebookAuth={timedFetch,signIn,errorMessage};
 if(typeof module!=='undefined')module.exports=root.NotebookAuth;
})(typeof window!=='undefined'?window:globalThis);
