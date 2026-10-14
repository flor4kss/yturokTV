import {tv} from './tvController';
export const tvMode = new URLSearchParams(location.search).get('tv') === '1';
const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]';
export function installTvRemote() {
  if(!tvMode)return;
  document.documentElement.classList.add('tv-mode');
  let idle,lastDialog=null;
  const scope=()=>document.querySelector('[role="dialog"]') || document.getElementById('watch-player') || document.body;
  const visible=element=>!element.closest('[inert]') && element.getBoundingClientRect().width>0 && element.getBoundingClientRect().height>0 && getComputedStyle(element).visibility!=='hidden' && getComputedStyle(element).display!=='none';
  const controls=()=>[...scope().querySelectorAll(selector)].filter(visible);
  function wake(){document.documentElement.classList.add('tv-controls');clearTimeout(idle);idle=setTimeout(()=>{if(!document.querySelector('[role="dialog"]')){document.activeElement?.blur();document.documentElement.classList.remove('tv-controls');}},6000);}
  function focus(element){element?.focus({preventScroll:true});element?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});wake();}
  function key(key){
    if(key==='Play'){tv.start();wake();return true;}
    if(key==='ChannelUp'||key==='ChannelDown'){tv.next(key==='ChannelUp'?-1:1);wake();return true;}
    const dialog=document.querySelector('[role="dialog"]');
    if(key==='Back'||key==='Escape'){
      if(dialog){dialog.querySelector('[aria-label="Закрыть окно"]')?.click();return true;}
      if(document.documentElement.classList.contains('tv-controls')){document.activeElement?.blur();document.documentElement.classList.remove('tv-controls');clearTimeout(idle);return true;}
      return false;
    }
    const items=controls(),active=document.activeElement;
    if(key==='Enter'){
      if(!dialog && !document.documentElement.classList.contains('tv-controls')){
        const start=document.querySelector('.big-play');if(start && visible(start))start.click();else document.querySelector('[aria-label="Открыть каналы"]')?.click();wake();return true;
      }
      if(items.includes(active)){active.click();wake();return true;}
      focus(items.find(e=>e.matches('.big-play'))||items[0]);return true;
    }
    if(!key.startsWith('Arrow'))return false;
    wake();
    if(active?.matches('select') && ['ArrowLeft','ArrowRight'].includes(key)){
      const next=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+(key==='ArrowRight'?1:-1)));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(active,active.options[next].value);
      active.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }
    if(active?.matches('input[type="range"]') && ['ArrowLeft','ArrowRight'].includes(key)){
      const value=Math.max(Number(active.min||0),Math.min(Number(active.max||100),Number(active.value)+(key==='ArrowRight'?5:-5)));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(active,String(value));
      active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }
    if(!items.includes(active)){focus(dialog?items.find(e=>e.matches('.category-pills button[aria-pressed="true"]'))||items[0]:items.find(e=>e.matches('.big-play'))||items.find(e=>e.getAttribute('aria-label')==='Открыть каналы')||items[0]);return true;}
    const rect=active.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const horizontal=key==='ArrowLeft'||key==='ArrowRight',sign=key==='ArrowLeft'||key==='ArrowUp'?-1:1;
    const ranked=items.filter(e=>e!==active).map(element=>{
      const r=element.getBoundingClientRect(),dx=r.left+r.width/2-x,dy=r.top+r.height/2-y;
      const forward=(horizontal?dx:dy)*sign,side=Math.abs(horizontal?dy:dx);
      return {element,score:forward>4?forward+side*3:Infinity};
    }).sort((a,b)=>a.score-b.score);
    if(ranked[0]?.score<Infinity)focus(ranked[0].element);return true;
  }
  window.yturokRemote={key,suspend:()=>tv.suspend(),resume:()=>tv.resume()};
  document.addEventListener('keydown',event=>{if(key(event.key)){event.preventDefault();event.stopImmediatePropagation();}},true);
  const observer=new MutationObserver(()=>{
    const dialog=document.querySelector('[role="dialog"]');
    if(dialog!==lastDialog){lastDialog=dialog;requestAnimationFrame(()=>focus(dialog?.querySelector('.category-pills button[aria-pressed="true"]') || dialog?.querySelector('button') || document.querySelector('[aria-label="Открыть каналы"]')));}
    else if(document.activeElement===document.body && document.querySelector('.big-play:not(:disabled)'))focus(document.querySelector('.big-play'));
  });observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  wake();requestAnimationFrame(()=>focus(document.querySelector('.big-play')));
}
