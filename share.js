const shareButton=document.getElementById('shareSite');
shareButton.addEventListener('click',async()=>{
 const data={title:'IELTS vocabulary｜雅思词汇真经单词音频',text:'22 个单元，英美发音点读，每词重复与循环播放，手机打开就能听。',url:location.href.split('#')[0]};
 const result=document.getElementById('shareStatus');
 try{if(navigator.share){await navigator.share(data);result.textContent='';}else if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(data.url);result.textContent='链接已复制，可以发送给朋友。';}else{result.textContent='分享链接：'+data.url;}}
 catch(error){if(error.name!=='AbortError')result.textContent='分享链接：'+data.url;}
});
