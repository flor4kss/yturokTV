export function bufferedAhead(video, time=video?.currentTime || 0) {
  const ranges=video?.buffered;
  if(!ranges)return 0;
  for(let i=0;i<ranges.length;i++)if(ranges.start(i)<=time+0.15 && ranges.end(i)>time)return Math.max(0,ranges.end(i)-time);
  return 0;
}
export function qualityTarget(mode){return mode==='best'?1080:480;}
export function qualityLevel(levels,mode){
  if(mode==='auto')return -1;
  if(!levels.length)return -1;
  const target=mode==='best'?Infinity:480;
  let selected=0;
  for(let i=1;i<levels.length;i++)if(mode==='best' ? levels[i].height>levels[selected].height : Math.abs(levels[i].height-target)<Math.abs(levels[selected].height-target))selected=i;
  return selected;
}
export function variantPlaylist(sources){
  const unique=[...new Map(sources.filter(s=>s.type==='hls' && s.quality && /^https:\/\//.test(s.url)).map(s=>[s.quality,s])).values()].sort((a,b)=>a.quality-b.quality);
  if(unique.length<2)return null;
  const rates={480:1200000,720:2600000,1080:5000000};
  return '#EXTM3U\n#EXT-X-VERSION:3\n'+unique.map(s=>`#EXT-X-STREAM-INF:BANDWIDTH=${rates[s.quality]||2600000},RESOLUTION=${Math.round(s.quality*16/9)}x${s.quality}\n${s.url}`).join('\n')+'\n';
}
export function shouldSuggestDelay({waitingMs,stalls,enabled,dismissed}){
  return !enabled && !dismissed && (waitingMs>=8000 || stalls>=2);
}
export function bufferGoal(delayed,rebuffer=false){return delayed ? (rebuffer?15:10) : (rebuffer?8:5);}
