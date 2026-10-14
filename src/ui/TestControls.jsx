import {useState} from 'react';
import {tv} from '../tvController';
export default function TestControls({snapshot}) {
  const library=snapshot.channels.filter(c=>c.channel.id!=='test-lab').flatMap(c=>c.channel.schedule);
  const titles=[...new Set(library.map(i=>i.title))];
  const [title,setTitle]=useState(titles[0]);
  const [episode,setEpisode]=useState(0);
  const [promo,setPromo]=useState(titles[0]);
  const episodes=library.filter(i=>i.title===title);
  return <div className="test-controls">
    <strong>Тестовый эфир</strong><p>Выбирай передачу и проверяй анонсы без ожидания. Обычные каналы продолжают свой эфир.</p>
    <label>Передача<select value={title} onChange={e=>{setTitle(e.target.value);setEpisode(0);}}>{titles.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Серия / выпуск<select value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{episodes.map((i,n)=><option value={n} key={n}>{i.episode||`Выпуск ${n+1}`}</option>)}</select></label>
    <button className="button button-coral" onClick={()=>tv.testPlay(episodes[episode])}>Включить выбранную передачу</button>
    <label>Какой анонс показать<select value={promo} onChange={e=>setPromo(e.target.value)}>{titles.map(t=><option key={t}>{t}</option>)}</select></label>
    <button className="button button-soft" onClick={()=>tv.testPromo(library.find(i=>i.title===promo))}>Запустить анонс сейчас · 30 секунд</button>
  </div>;
}
