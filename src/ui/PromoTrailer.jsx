import {useEffect,useRef,useState} from 'react';
export default function PromoTrailer({trailer,item,elapsed,active,onPlaying}) {
  const host=useRef(null);
  const [playing,setPlaying]=useState(false);
  const [status,setStatus]=useState('');
  useEffect(()=>{
    let player,hls,video,disposed=false,poll,fallbackTimer,fallbackStarted=false;
    setPlaying(false);onPlaying(false);setStatus('Загружаем трейлер…');
    if(!active)return;
    const start=(trailer?.start || 3)+Math.floor(elapsed);
    async function fallback(reason){
      if(disposed || fallbackStarted)return;
      fallbackStarted=true;setPlaying(false);onPlaying(false);clearTimeout(poll);clearTimeout(fallbackTimer);
      try{player?.destroy();}catch{}
      if(!item.promoVideoUrl){setStatus(reason+' · обложка');return;}
      setStatus('Трейлер недоступен · видеопревью передачи');
      video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.style.cssText='width:100%;height:100%;object-fit:cover';
      video.addEventListener('playing',()=>{if(!disposed){setPlaying(true);onPlaying(true);}});
      video.addEventListener('error',()=>{if(!disposed){setPlaying(false);onPlaying(false);setStatus('Видео недоступно · обложка');}});
      host.current.replaceChildren(video);
      if(item.promoVideoType==='hls'){
        const {default:Hls}=await import('hls.js');if(disposed)return;
        if(Hls.isSupported()){
          hls=new Hls({maxBufferLength:15,backBufferLength:0,startPosition:60});hls.loadSource(item.promoVideoUrl);hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!disposed)video.play().catch(()=>{});});
          hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal&&!disposed){setPlaying(false);onPlaying(false);setStatus('Видео недоступно · обложка');}});
        }else{video.src=item.promoVideoUrl;video.play().catch(()=>{});}
      }else{video.src=item.promoVideoUrl;video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(60,video.duration/4);video.play().catch(()=>{});},{once:true});}
    }
    function initialize(){
      if(disposed || fallbackStarted)return;
      if(!window.YT?.Player){poll=setTimeout(initialize,200);return;}
      const target=document.createElement('div');host.current.replaceChildren(target);
      player=new window.YT.Player(target,{
        width:'100%',height:'100%',videoId:trailer.youtubeId,
        playerVars:{autoplay:1,mute:1,controls:0,playsinline:1,rel:0,disablekb:1,fs:0,start,origin:location.origin},
        events:{
          onReady:event=>{if(disposed || fallbackStarted)return;event.target.mute();event.target.seekTo(start,true);event.target.playVideo();},
          onStateChange:event=>{if(disposed || fallbackStarted)return;if(event.data===1){clearTimeout(fallbackTimer);setPlaying(true);onPlaying(true);setStatus('Трейлер');}else if(event.data===0){fallback('Трейлер завершился');}},
          onError:event=>fallback('YouTube недоступен ('+event.data+')'),
        },
      });
    }
    if(trailer?.youtubeId){fallbackTimer=setTimeout(()=>fallback('Трейлер не отвечает'),6500);initialize();}
    else fallback('Для передачи нет трейлера');
    return ()=>{disposed=true;clearTimeout(poll);clearTimeout(fallbackTimer);try{player?.destroy();}catch{}hls?.destroy();if(video){video.pause();video.removeAttribute('src');video.load();}onPlaying(false);};
  },[item,trailer?.youtubeId,active,onPlaying]);
  return <><div className={`promo-trailer ${playing?'is-playing':''}`} ref={host} aria-hidden="true"/>{active&&status&&<span className="promo-video-status" role="status">{status}</span>}</>;
}
