import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_CHANNELS as channels} from '../channels.js';
import {promoMessage} from '../src/broadcastMessages.js';
import {timeline} from '../src/broadcastPlanner.js';
assert.deepEqual(channels,JSON.parse(await readFile('schedule.json','utf8')));
assert.equal(channels.length,6);
for(const channel of channels){
 assert.equal(channel.catalogVersion,4);const seen=new Set();
 for(const item of channel.schedule){
  assert.ok(item.duration>0);assert.notEqual(item.type,'bumper');assert.ok(!item.sourceOffset);
  const key=item.title+'|'+(item.youtubeId||item.rutubeId||item.url);assert.ok(!seen.has(key));seen.add(key);
  if(item.adBreakAt){assert.equal(item.adBreakMethod,'detected-cut');assert.ok(item.adBreakAt>120&&item.adBreakAt<item.duration-90);}
 }
 const plan=timeline(channel,8*86400);
 for(let i=0;i<plan.items.length-3;i++){
  const item=plan.items[i].item;if(item.kind!=='promo')continue;
  const resume=plan.items[i+1].item;
  if(item.promoDelay){const before=plan.items[i-1].item;assert.equal(before.title,resume.title);assert.equal(before.duration,resume.sourceOffset);assert.equal(before.duration+resume.duration,before.mediaDuration);assert.equal(item.promoTitle,plan.items[i+2].item.title);}
  else assert.equal(item.promoTitle,resume.title);
 }
}
const promo={duration:18,promoDelay:600,promoTitle:'Доктор Стоун'};
assert.equal(promoMessage(promo,0,Date.parse('2026-10-12T15:19:42Z')),'Сегодня в 20:30 — Доктор Стоун. Не пропусти!');
assert.equal(promoMessage({...promo,promoDelay:0},0,Date.parse('2026-10-12T18:59:50Z')),'Завтра в 00:00 — Доктор Стоун. Не пропусти!');
console.log('Published library uniqueness, detected scene points, generated programme and correct promo times: OK');
