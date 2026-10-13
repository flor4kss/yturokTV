import {useEffect,useRef,useState} from 'react';
export default function PromoTrailer({trailer,item,elapsed,active,onPlaying}) {
  const host=useRef(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    let player,disposed=false,poll;
    setPlaying(false);onPlaying(false);
    if(!active || !trailer?.youtubeId)return;
    const start=(trailer.start || 3)+Math.floor(elapsed);
    const deadline=Date.now()+6000;
    function initialize(){
      if(disposed)return;
      if(!window.YT?.Player){if(Date.now()<deadline)poll=setTimeout(initialize,200);return;}
      const target=document.createElement('div');host.current.replaceChildren(target);
      player=new window.YT.Player(target,{
        width:'100%',height:'100%',videoId:trailer.youtubeId,
        playerVars:{autoplay:1,mute:1,controls:0,playsinline:1,rel:0,disablekb:1,fs:0,start,origin:location.origin},
        events:{
          onReady:event=>{if(disposed)return;event.target.mute();event.target.seekTo(start,true);event.target.playVideo();},
          onStateChange:event=>{if(disposed)return;if(event.data===1){setPlaying(true);onPlaying(true);}else if(event.data===0||event.data===2){setPlaying(false);onPlaying(false);}},
          onError:()=>{if(disposed)return;setPlaying(false);onPlaying(false);player?.stopVideo?.();},
        },
      });
    }
    initialize();
    return ()=>{disposed=true;clearTimeout(poll);try{player?.destroy();}catch{}onPlaying(false);};
    // The episode clock updates every second; rebuild only for a new promo or lifecycle change.
  },[item,trailer?.youtubeId,active,onPlaying]);
  return <div className={`promo-trailer ${playing?'is-playing':''}`} ref={host} aria-hidden="true"/>;
}
