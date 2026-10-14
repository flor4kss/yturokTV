// Rutube preroll is not episode playback: seeking during adverts can restart the roll.
let activeId, ready=false, currentTime=0, callbacks, desiredTime=0, desiredVolume=0, started=false;
let episodePlaying=false, initialSeekApplied=false;
const frame=()=>document.getElementById('rutube-player');
export function rutubeCommand(type,data={}) {
  frame()?.contentWindow?.postMessage(JSON.stringify({type:`player:${type}`,data}),'https://rutube.ru');
}
export function stopRutube(){episodePlaying=false;rutubeCommand('pause');frame()?.classList.add('hidden');}
export function rutubeTime(){return currentTime;}
export function rutubeIsPlaying(){return episodePlaying;}
export function rutubeVolume(volume){desiredVolume=volume;rutubeCommand('setVolume',{volume});rutubeCommand(volume?'unMute':'mute');}
export function rutubeSeek(time){desiredTime=time;if(episodePlaying){currentTime=time;rutubeCommand('setCurrentTime',{time});}}
export function resumeRutube(){started=true;if(ready){rutubeVolume(desiredVolume);rutubeCommand('play');}}
export function playRutube(item,time,options){
  callbacks=options;desiredTime=time;desiredVolume=options.volume;started=options.started;
  const element=frame();if(!element)return;
  element.classList.remove('hidden');
  if(activeId!==item.rutubeId){
    activeId=item.rutubeId;ready=false;episodePlaying=false;initialSeekApplied=false;currentTime=0;
    const quality=new URLSearchParams(location.search).get('tv')==='1'?480:'auto';
    element.src=`https://rutube.ru/play/embed/${item.rutubeId}/?autoplay=${started?'true':'false'}&q=${quality}`;
  } else if(ready){rutubeSeek(time);rutubeVolume(desiredVolume);if(started)rutubeCommand('play');}
}
window.addEventListener('message',event=>{
  if(event.origin!=='https://rutube.ru'||event.source!==frame()?.contentWindow)return;
  let message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
  if(!callbacks?.isActive()){rutubeCommand('pause');return;}
  if(message?.type==='player:ready'){
    ready=true;rutubeVolume(desiredVolume);if(started)rutubeCommand('play');
  }
  if(message?.type==='player:currentTime' && episodePlaying)currentTime=Number(message.data?.time)||0;
  if(message?.type==='player:changeState'){
    const data=message.data||{};
    if(data.state==='playing')episodePlaying=true;
    else if(['advert','pause','paused','stopped'].includes(data.state))episodePlaying=false;
    if(data.state==='playing'){
      if(!initialSeekApplied){initialSeekApplied=true;rutubeSeek(desiredTime);}
      callbacks.onReady();
    }else if(data.state==='advert' && data.isPlaying)callbacks.onReady();
  }
  if(message?.type==='player:rollState' && message.data?.state==='play')callbacks.onReady();
  if(message?.type==='player:error')callbacks.onError();
  if(message?.type==='player:playComplete')callbacks.onEnded();
});
