import assert from 'node:assert/strict';
import {broadcastPosition,broadcastRows,timeline,BROADCAST_EPOCH} from '../src/broadcastPlanner.js';
const episode=(title,n)=>({title,episode:`Серия ${n}`,ordinal:n,duration:1440,type:'video',url:`https://test/${title}/${n}.mp4`,adBreakAt:720});
const channel={category:'anime',schedule:['A','B','C'].flatMap(title=>Array.from({length:40},(_,i)=>episode(title,i+1)))};
const first=broadcastPosition(channel,(BROADCAST_EPOCH+718)*1000);assert.equal(first.adCountdown,2);
const ad=broadcastPosition(channel,(BROADCAST_EPOCH+725)*1000);assert.equal(ad.currentItem.kind,'promo');
const resume=broadcastPosition(channel,(BROADCAST_EPOCH+740)*1000);assert.equal(resume.currentItem.sourceOffset,720);assert.equal(resume.elapsed,722);
assert.equal(broadcastPosition(channel,(BROADCAST_EPOCH+740)*1000).currentItem,resume.currentItem);
const rows=broadcastRows(channel,(BROADCAST_EPOCH+725)*1000);assert.equal(rows[0].duration,1458);assert.equal(rows[0].item.title,'A');
assert.equal(rows[1].item.ordinal,2);
const plan=timeline(channel,14*86400);assert.ok(plan.starts.every((s,i)=>!i||s-plan.starts[i-1]>=25*3600));
const phases=plan.starts.slice(0,14).map(s=>Math.floor(s%86400/3600));assert.ok(new Set(phases).size>=8,JSON.stringify(phases));
const fresh=plan.items.filter(({item})=>item.title==='A'&&!item.repeat&&!item.sourceOffset&&item.type!=='bumper');
assert.deepEqual(fresh.slice(0,10).map(({item})=>item.ordinal),[1,2,3,4,5,6,7,8,9,10]);
const repeats=plan.items.filter(({item})=>item.title==='A'&&item.ordinal===1&&item.repeat&&!item.sourceOffset);
assert.ok(repeats.length>=3);
for(let i=0;i<plan.items.length-1;i++){
 const entry=plan.items[i];if(entry.item.kind!=='promo')continue;
 let next=i+1;while(plan.items[next]?.item.sourceOffset)next++;
 if(!plan.items[next])continue; assert.equal(entry.item.promoTitle,plan.items[next].item.title);
 assert.equal(entry.item.promoDelay,plan.items[i+1].item.duration);
}
console.log('Rotating broadcast windows, sequential premieres, labelled repeats, promo timing and exact midroll resume: OK');

