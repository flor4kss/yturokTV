import {orderedSeries,nextRound,seriesId} from './episodeQueue.js';
import {timeline as legacyTimeline} from './legacyBroadcastPlanner.js';
export const BROADCAST_EPOCH = 1791745200; // 2026-10-12 00:00, Екатеринбург.
const cache = new WeakMap();
export function invalidatePlan(channel){cache.delete(channel);}
const rotate = (items, step) => items.map((_,i)=>items[(i+step)%items.length]);
function promo(next, remaining=0) {
  return {title:`Анонс: ${next.title}`,episode:'Скоро на этом канале',duration:18,type:'bumper',kind:'promo',promoTitle:next.title,
    promoVideoUrl:['hls','mp4','video'].includes(next.type)?next.url:undefined,promoVideoType:next.type,promoSources:next.sources,poster:next.poster,promoYoutubeId:next.youtubeId,promoBlock:next.block,promoDelay:remaining};
}
function split(item,next,repeat) {
  const cut=item.adBreakAt;
  if(!(cut>120 && cut<item.duration-90))return [{...item,repeat}];
  return [{...item,duration:cut,mediaDuration:item.duration,repeat},promo(next,item.duration-cut),
    {...item,duration:item.duration-cut,mediaDuration:item.duration,sourceOffset:cut,episode:`${item.episode} · Продолжение`,repeat}];
}
function createWave(channel,index) {
  const library=channel.schedule.filter(s=>s.type!=='bumper' && !s.sourceOffset && (channel.category==='music' || (s.type!=='rutube' && s.airStatus!=='excluded')));
  if(!library.length)return [];
  if(channel.category==='music') {
    const blocks=[...new Set(library.map(s=>s.block))];
    const items=rotate(blocks,index%blocks.length).flatMap(block=>rotate(library.filter(s=>s.block===block),index));
    return items.flatMap((item,i)=>{
      const next=i===items.length-1 ? rotate(library.filter(s=>s.block===blocks[(index+1)%blocks.length]),index+1)[0] : items[i+1];
      return item.block!==next.block?[{...item,repeat:index>0},promo(next)]:[{...item,repeat:index>0}];
    });
  }
  const groups=new Map();
  for(const item of library){const key=item.seriesKey || item.title; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  const ordered=rotate([...groups.values()],index%groups.size);
  const premieres=ordered.flatMap(group=>[0,1].map(n=>({...group[(index*2+n)%group.length],repeat:index*2+n>=group.length})));
  const programmes=[];
  // Four viewing windows, each at least 6h15. Whole episodes determine the actual end.
  // The resulting broadcast day is longer than 24h and moves across local clock hours.
  for(let window=0;window<4;window++) {
    const pair=rotate(premieres,window%premieres.length);
    let seconds=0,slot=0;
    while(seconds<22500) {
      let item;
      if(slot<pair.length)item={...pair[slot],repeat:window>0 || pair[slot].repeat};
      else {
        const group=ordered[(slot+window)%ordered.length];
        const history=Math.min(group.length,Math.max(2,index*2+2));
        item={...group[(slot-pair.length+window*3)%history],repeat:true};
      }
      programmes.push(item);
      seconds+=item.duration+(item.adBreakAt?18:0);slot++;
    }
  }
  const nextGroup=ordered[1%ordered.length];
  const upcoming=nextGroup[((index+1)*2)%nextGroup.length];
  return programmes.flatMap((item,i)=>split(item,programmes[i+1] || upcoming,item.repeat));
}
export function timeline(channel, seconds=0) {
  let plan=cache.get(channel);
  if(!plan){
    plan={items:[],duration:0,waves:0,starts:[]};
    if(channel.queueVersion===2 && channel.category!=='music') {
      const migration=channel.migration;
      if(!migration || !Number.isFinite(migration.activateAt) || !Array.isArray(migration.legacySchedule))throw new Error('Missing broadcast migration');
      const boundary=migration.activateAt-BROADCAST_EPOCH;
      const legacy={...channel,queueVersion:1,schedule:migration.legacySchedule};
      const previous=legacyTimeline(legacy,Math.max(0,boundary));
      plan.items=previous.items.filter(e=>e.start<boundary);
      const last=plan.items.at(-1);
      if(last && last.start+last.item.duration!==boundary)throw new Error('Activation splits a programme');
      if(last?.item.mediaDuration && !last.item.sourceOffset || last?.item.promoDelay)throw new Error('Activation splits an advertising break');
      plan.duration=boundary;
      plan.groups=orderedSeries(channel);
      plan.cursors={...migration.cursors};
      plan.previousSeries=migration.previousSeries;
    }
    cache.set(channel,plan);
  }
  while(plan.duration<=seconds+3*86400){
    let items;
    if(plan.groups) {
      const round=nextRound(plan.groups,plan.cursors,plan.waves++,plan.previousSeries);
      if(!round.length)break;
      plan.previousSeries=seriesId(round.at(-1));
      const upcoming=nextRound(plan.groups,{...plan.cursors},plan.waves,plan.previousSeries)[0] || round.at(-1);
      items=round.flatMap((item,i)=>split(item,round[i+1] || upcoming,item.repeat));
    } else items=createWave(channel,plan.waves++);
    if(!items.length)break;
    plan.starts.push(plan.duration);
    for(const item of items){plan.items.push({item,start:plan.duration});plan.duration+=item.duration;}
  }
  return plan;
}
export function broadcastPosition(channel,timestamp) {
  const seconds=Math.max(0,Math.floor(timestamp/1000)-BROADCAST_EPOCH);
  const plan=timeline(channel,seconds);
  if(!plan.items.length)return {currentItem:{title:'Канал готовится к эфиру',duration:3600,type:'placeholder'},elapsed:0,broadcastElapsed:0,currentIndex:0,progressPercent:0};
  // Binary search keeps clock updates inexpensive even after months of broadcasting.
  let low=0,high=plan.items.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(plan.items[mid].start<=seconds)low=mid;else high=mid-1;}
  const entry=plan.items[low],item=entry.item,broadcastElapsed=seconds-entry.start;
  let next=low+1;while(plan.items[next]?.item.type==='bumper'||plan.items[next]?.item.sourceOffset)next++;
  const elapsed=broadcastElapsed+(item.sourceOffset||0);
  return {currentItem:item,nextItem:plan.items[next]?.item,elapsed,broadcastElapsed,currentIndex:low,
    adCountdown:plan.items[low+1]?.item.kind==='promo' && !item.sourceOffset && item.type!=='bumper' ? Math.max(0,item.duration-broadcastElapsed) : null,
    progressPercent:Math.min(100,Math.floor(elapsed/(item.mediaDuration||item.duration)*100)),repeat:item.repeat || false};
}
export function broadcastRows(channel,timestamp,limit=60) {
  const position=broadcastPosition(channel,timestamp);
  const plan=timeline(channel,Math.max(0,timestamp/1000-BROADCAST_EPOCH));
  let index=position.currentIndex;
  if(plan.items[index]?.item.sourceOffset)index-=2;
  else if(plan.items[index]?.item.promoDelay)index--;
  const rows=[];
  while(index<plan.items.length && rows.length<limit){
    const {item,start}=plan.items[index];
    const combined=Boolean(item.mediaDuration && !item.sourceOffset);
    const duration=combined?item.mediaDuration+18:item.duration;
    rows.push({item,start:BROADCAST_EPOCH+start,repeat:item.repeat || false,duration});
    index+=combined?3:1;
  }
  return rows;
}
