// Official embed API: https://rutube.ru/info/embed/
let activeId, ready=false, currentTime=0, callbacks, desiredTime=0, desiredVolume=0, started=false;
const frame=()=>document.getElementById('rutube-player');
export function rutubeCommand(type,data={}) {
  frame()?.contentWindow?.postMessage(JSON.stringify({type:`player:${type}`,data}),'https://rutube.ru');
}
export function stopRutube(){rutubeCommand('pause');frame()?.classList.add('hidden');}
export function rutubeTime(){return currentTime;}
export function rutubeVolume(volume){desiredVolume=volume;rutubeCommand('setVolume',{volume});rutubeCommand(volume?'unMute':'mute');}
export function rutubeSeek(time){desiredTime=time;currentTime=time;rutubeCommand('setCurrentTime',{time});}
export function resumeRutube(){started=true;if(ready){rutubeVolume(desiredVolume);rutubeCommand('play');}}
export function playRutube(item,time,options){
  callbacks=options;desiredTime=time;desiredVolume=options.volume;started=options.started;
  const element=frame();if(!element)return;
  element.classList.remove('hidden');
  if(activeId!==item.rutubeId){
    activeId=item.rutubeId;ready=false;currentTime=time;
    element.src=`https://rutube.ru/play/embed/${item.rutubeId}/?autoplay=0&t=${Math.floor(time)}`;
  } else if(ready){rutubeSeek(time);rutubeVolume(desiredVolume);if(started)rutubeCommand('play');}
}
window.addEventListener('message',event=>{
  if(event.origin!=='https://rutube.ru'||event.source!==frame()?.contentWindow)return;
  let message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
  if(!callbacks?.isActive()){rutubeCommand('pause');return;}
  if(message?.type==='player:ready'){
    ready=true;rutubeVolume(desiredVolume);rutubeSeek(desiredTime);if(started)rutubeCommand('play');
  }
  if(message?.type==='player:currentTime')currentTime=Number(message.data?.time)||0;
  if(message?.type==='player:changeState'&&message.data?.state==='playing')callbacks.onReady();
  if(message?.type==='player:error')callbacks.onError();
  if(message?.type==='player:playComplete')callbacks.onEnded();
});
