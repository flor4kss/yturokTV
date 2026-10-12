import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_CHANNELS as channels} from '../channels.js';
import {promoMessage} from '../src/broadcastMessages.js';
assert.deepEqual(channels,JSON.parse(await readFile('schedule.json','utf8')));
assert.equal(channels.length,6);
for(const channel of channels){
 assert.equal(channel.catalogVersion,3);
 const seen=new Set();
 channel.schedule.forEach((item,i)=>{
 assert.ok(item.duration>0);
 assert.notEqual(item.kind,'advert');
 if(item.kind==='promo'){
  const resume=channel.schedule[(i+1)%channel.schedule.length];
  if(channel.category!=='music'){
   const before=channel.schedule[i-1];
   assert.equal(before.title,resume.title);
   assert.equal(before.url,resume.url);
   assert.equal(resume.sourceOffset,before.duration);
   assert.equal(before.duration+resume.duration,before.mediaDuration);
   assert.equal(item.promoDelay,resume.duration);
   assert.equal(item.promoTitle,channel.schedule[(i+2)%channel.schedule.length].title);
  } else assert.equal(item.promoTitle,resume.title);
 } else if(!item.sourceOffset){
  const key=item.title+'|'+(item.youtubeId||item.url);
  assert.ok(!seen.has(key));seen.add(key);
 }
 });
}
const promo={duration:18,promoDelay:600,promoTitle:'Доктор Стоун'};
assert.equal(promoMessage(promo,0,Date.parse('2026-10-12T15:19:42Z')),'Сегодня в 20:30 — Доктор Стоун. Не пропусти!');
assert.equal(promoMessage({...promo,promoDelay:0},0,Date.parse('2026-10-12T18:59:50Z')),'Завтра в 00:00 — Доктор Стоун. Не пропусти!');
console.log('Mid-episode breaks, exact resume offsets, no comedy ads, music block boundaries and promo timing: OK');
