import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedSeries,nextRound} from '../src/episodeQueue.js';
const episode=(seriesKey,seasonOrder,ordinal,extra={})=>({episodeId:`${seriesKey}:${seasonOrder}:${ordinal}`,seriesKey,seasonOrder,ordinal,airStatus:'ready',type:'video',duration:600,...extra});
test('seven days progress in season order; repeats start only after completion',()=>{
  const schedule=['a','b','c'].flatMap(key=>[0,1].flatMap(s=>[1,2,3].map(n=>episode(key,s,n))));
  const groups=orderedSeries({schedule}),cursors={},seen=new Map();
  let previous,seconds=0,round=0;
  while(seconds<7*86400){
    const batch=nextRound(groups,cursors,round++,previous);
    assert.equal(batch.length,3);assert.equal(new Set(batch.map(i=>i.seriesKey)).size,3);
    assert.notEqual(batch[0].seriesKey,previous);
    for(const item of batch){
      const n=seen.get(item.seriesKey)||0;
      assert.equal(item.seasonOrder,Math.floor((n%6)/3));assert.equal(item.ordinal,n%3+1);
      assert.equal(item.repeat,n>=6);seen.set(item.seriesKey,n+1);seconds+=item.duration;
    }
    previous=batch.at(-1).seriesKey;
  }
});
test('known failed story episode blocks later episodes and wrapping',()=>{
  const groups=orderedSeries({schedule:[episode('a',0,1),episode('a',0,2,{airStatus:'excluded'}),episode('a',0,3),episode('b',0,1)]});
  const cursors={};assert.deepEqual(nextRound(groups,cursors,0).map(e=>e.seriesKey),['a','b']);
  for(let i=1;i<20;i++)assert.deepEqual(nextRound(groups,cursors,i).map(e=>e.seriesKey),['b']);
});
test('implicit numbering gaps block story progression; independent episodes skip failed files',()=>{
  const groups=orderedSeries({schedule:[episode('a',0,1),episode('a',0,3),episode('b',0,1,{continuity:'episodic',airStatus:'excluded'}),episode('b',0,2,{continuity:'episodic'})]});
  const cursors={};assert.equal(nextRound(groups,cursors,0)[0].ordinal,1);
  assert.deepEqual(nextRound(groups,cursors,1).map(e=>[e.seriesKey,e.ordinal]),[['b',2]]);
});
test('RUTUBE is never an eligible source; unverified records are not ready',()=>{
  const groups=orderedSeries({schedule:[episode('a',0,1,{type:'rutube'}),episode('b',0,1,{airStatus:'unverified'})]});
  assert.deepEqual(nextRound(groups,{},0),[]);
});
