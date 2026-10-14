const streams=new Map(), pending=new Map(), failed=new Set(), copies=new WeakMap();
export function nativeRutubeAvailable(){try{return window.YturokMedia?.version?.()>=2;}catch{return false;}}
export function shouldResolveRutube(item){return item.type==='rutube' && nativeRutubeAvailable() && !failed.has(item.rutubeId);}
export function directRutubeItem(item){
  const source=streams.get(item.rutubeId);
  if(!source || source.expires<Date.now())return item;
  const prior=copies.get(item);
  if(prior?.url===source.url)return prior;
  const direct={...item,type:'hls',url:source.url,sources:[{url:source.url,type:'hls',provider:'rutube',adaptive:true}],provider:'rutube',directRutube:true};
  copies.set(item,direct);return direct;
}
export function resolveRutube(item){
  const id=item.rutubeId;
  if(pending.has(id))return pending.get(id);
  const task=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(`https://rutube.ru/api/play/options/${id}/?format=json`,{signal:controller.signal});
      if(!response.ok)throw Error('Rutube '+response.status);
      const data=await response.json(),url=data.video_balancer?.m3u8 || data.video_balancer?.default;
      if(!url || new URL(url).protocol!=='https:')throw Error('Нет доступного потока Rutube');
      const host=new URL(url).hostname;
      if(host!=='bl.rutube.ru' && !host.endsWith('.rtbcdn.ru'))throw Error('Неизвестный сервер Rutube');
      streams.set(id,{url,expires:Date.now()+10*60*1000});
    }catch(error){failed.add(id);throw error;}
    finally{clearTimeout(timer);pending.delete(id);}
  })();pending.set(id,task);return task;
}
export function resetRutube(item){if(item?.rutubeId){failed.delete(item.rutubeId);streams.delete(item.rutubeId);}}

export function rejectDirectRutube(item){if(item?.rutubeId){failed.add(item.rutubeId);streams.delete(item.rutubeId);}}
