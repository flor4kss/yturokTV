// Source failures are local to this viewer; never mutate the shared programme library.
const failed=new Map();
export function mediaCandidates(item,tvMode=false) {
  const entries=(item.sources?.length ? item.sources : [{url:item.url,type:item.type}]).filter(s=>s.url && s.type===item.type);
  const ordered=[...entries].sort((a,b)=>Math.abs((a.quality||720)-(typeof tvMode==='number'?tvMode:(tvMode?480:720)))-Math.abs((b.quality||720)-(typeof tvMode==='number'?tvMode:(tvMode?480:720))));
  return ordered.filter((s,i)=>ordered.findIndex(x=>x.url===s.url)===i);
}
export function mediaSource(item,tvMode=false) {
  const list=mediaCandidates(item,tvMode);
  return list.find(s=>!failed.has(s.url) || Date.now()-failed.get(s.url)>10*60*1000) || list[0];
}
export function rejectSource(url,item,tvMode=false) {
  if(!url)return false;
  failed.set(url,Date.now());
  return mediaCandidates(item,tvMode).some(s=>!failed.has(s.url) || Date.now()-failed.get(s.url)>10*60*1000);
}
export function resetSourceFailures(item){for(const source of item?.sources||[])failed.delete(source.url);if(item?.url)failed.delete(item.url);}

export function healthySources(item){return mediaCandidates(item).filter(s=>!failed.has(s.url) || Date.now()-failed.get(s.url)>10*60*1000);}
