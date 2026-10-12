import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_CHANNELS as channels} from '../channels.js';
import {promoMessage} from '../src/broadcastMessages.js';
assert.deepEqual(channels, JSON.parse(await readFile('schedule.json','utf8')));
assert.equal(channels.length,6);
assert.deepEqual(channels.map(c=>c.category),['anime','anime','anime','cartoons','cartoons','music']);
for(const c of channels) {
  const sources = new Set();
  const lastEpisodes = new Map();
  c.schedule.forEach((s,i)=>{
    assert.ok(s.duration > 0 && Number.isFinite(s.duration));
    if(s.type==='bumper') {
      if(s.kind==='promo') {
        const next=c.schedule[(i+1)%c.schedule.length];
        assert.ok(s.promoTitle===next.title || s.promoTitle===`${next.block} — ${next.title}`);
      }
    } else {
      const key = `${s.title}|${s.youtubeId||s.url}`;
      assert.ok(!sources.has(key),`Duplicate source ${key}`); sources.add(key);
      const episode = Number(s.episode?.match(/^(?:Серия|Выпуск)\s*(\d+)/)?.[1]);
      if(episode) {assert.ok(episode > (lastEpisodes.get(s.title)||0));lastEpisodes.set(s.title,episode);}
    }
  });
}
assert.ok(channels[0].schedule.every(s=>!['Смешарики','Адский босс'].includes(s.title)));
assert.ok(channels[3].schedule.every(s=>s.type==='bumper'||['Смешарики','Фиксики','Лунтик'].includes(s.title)));
const promo={duration:15,promoTitle:'Доктор Стоун'};
assert.equal(promoMessage(promo,0,Date.parse('2026-10-12T15:29:45Z')),'Сегодня в 20:30 — Доктор Стоун. Не пропусти!');
assert.equal(promoMessage(promo,0,Date.parse('2026-10-12T18:59:50Z')),'Завтра в 00:00 — Доктор Стоун. Не пропусти!');
console.log('Six channels, classifications, episode order, unique sources and promo times: OK');
