import {useState} from 'react';
import {tv} from '../tvController';
import {TEST_CANDIDATES} from '../testCandidates.js';
export default function TestControls({snapshot}) {
  const broadcastLibrary=snapshot.channels.filter(c=>c.channel.id!=='test-lab').flatMap(c=>c.channel.schedule).filter(i=>i.type!=='rutube');
  const library=[...TEST_CANDIDATES,...broadcastLibrary];
  const titles=[...new Set(library.map(i=>i.title))];
  const [title,setTitle]=useState(titles[0]);
  const [episode,setEpisode]=useState(0);
  const [promo,setPromo]=useState(broadcastLibrary[0]?.title);
  const episodes=library.filter(i=>i.title===title);
  const promoTitles=[...new Set(broadcastLibrary.map(i=>i.title))];
  const driveTitles=[...new Set(TEST_CANDIDATES.filter(i=>i.targetChannel==='cartoons-drive').map(i=>i.title))];
  const otherTitles=[...new Set(TEST_CANDIDATES.filter(i=>i.targetChannel!=='cartoons-drive').map(i=>i.title))];
  return <div className="test-controls">
    <strong>Тестовый эфир</strong><p>Выбирай передачу и проверяй анонсы без ожидания. Обычные каналы продолжают свой эфир.</p>
    <label>Передача<select aria-label="Передача" value={title} onChange={e=>{setTitle(e.target.value);setEpisode(0);}}><optgroup label="Мульт Драйв · проверяем состав">{driveTitles.map(t=><option key={t}>{t}</option>)}</optgroup><optgroup label="Другие новые источники">{otherTitles.map(t=><option key={t}>{t}</option>)}</optgroup><optgroup label="Текущая библиотека">{[...new Set(broadcastLibrary.map(i=>i.title))].map(t=><option key={t}>{t}</option>)}</optgroup></select></label>
    <label>Серия / выпуск<select aria-label="Серия / выпуск" value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{episodes.map((i,n)=><option value={n} key={n}>{i.episode||`Выпуск ${n+1}`}</option>)}</select></label>
    {episodes[episode]?.testNote && <p role="note">{episodes[episode].testNote}</p>}
    <button className="button button-coral" onClick={()=>tv.testPlay(episodes[episode])}>Включить выбранную передачу</button>
    <label>Какой анонс показать<select aria-label="Какой анонс показать" value={promo} onChange={e=>setPromo(e.target.value)}>{promoTitles.map(t=><option key={t}>{t}</option>)}</select></label>
    <button className="button button-soft" onClick={()=>tv.testPromo(library.find(i=>i.title===promo))}>Запустить анонс сейчас · 30 секунд</button>
  </div>;
}
