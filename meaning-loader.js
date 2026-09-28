const MEANINGS={};
const meaningLoads=new Map();
function loadMeanings(chapter){
 if(meaningLoads.has(chapter))return meaningLoads.get(chapter);
 const task=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='meanings-'+String(chapter+1).padStart(2,'0')+'.js';
  script.onload=()=>resolve();
  script.onerror=()=>{meaningLoads.delete(chapter);script.remove();reject(new Error('释义加载失败'))};
  document.head.append(script);
 });
 meaningLoads.set(chapter,task);return task;
}
