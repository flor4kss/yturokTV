import {subscribeNetworkBudget,getNetworkBudget} from "../networkBudget";
import {useEffect,useState,useSyncExternalStore} from 'react';
import {usablePoster} from '../programMetadata';
import {TRAILERS} from '../trailerCatalog';
import PromoTrailer from './PromoTrailer';
const cache = new Map();
export default function PromoArtwork({item,channel,elapsed=0,active=true}) {
  const constrained=useSyncExternalStore(subscribeNetworkBudget,getNetworkBudget);
  const [src,setSrc]=useState(null);
  const [trailerPlaying,setTrailerPlaying]=useState(false);
  const trailer=TRAILERS[item.promoTitle];
  useEffect(()=>{
    let active=true;const abort=new AbortController();
    const title=item.promoTitle;
    const supplied=usablePoster(item.poster) || (item.promoYoutubeId ? `https://i.ytimg.com/vi/${item.promoYoutubeId}/hqdefault.jpg` : null);
    setSrc(supplied || cache.get(title) || null);
    if(!constrained && item.kind==='promo' && title && !supplied && !cache.has(title)) {
      const url='https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=1000&redirects=1&titles='+encodeURIComponent(title);
      fetch(url,{signal:abort.signal}).then(r=>r.json()).then(data=>{
        const image=Object.values(data.query?.pages || {}).find(p=>p.thumbnail)?.thumbnail.source;
        cache.set(title,image || null);if(active)setSrc(image || null);
      }).catch(()=>{});
    }
    return ()=>{active=false;abort.abort();};
  },[item,constrained]);
  if(item.kind!=='promo')return null;
  return <div className={`promo-artwork ${src?'has-art':''} ${trailerPlaying?'has-trailer':''}`} aria-hidden="true" style={{'--promo-accent':channel?.color}}>
    {src && <><img className="promo-backdrop" src={src} onError={()=>setSrc(null)} alt=""/><img className="promo-poster" src={src} alt=""/></>}
    {(trailer || item.promoVideoUrl) && <PromoTrailer trailer={trailer} item={item} elapsed={elapsed} active={active} onPlaying={setTrailerPlaying}/>}
    <div className="promo-orbit"/><span className="promo-category">{channel?.categoryName}</span>
  </div>;
}
