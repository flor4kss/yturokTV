import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastPosition,broadcastRows,BROADCAST_EPOCH} from '../src/broadcastPlanner.js';
import {broadcastPosition as oldPosition} from '../src/legacyBroadcastPlanner.js';
test('migration preserves the old episode, advertisement and continuation before activating',()=>{
  const episode={title:'A',seriesKey:'a',episode:'1',ordinal:1,duration:600,type:'video',url:'https://example.org/a',adBreakAt:300};
  const old={id:'fixture',category:'cartoon',schedule:[episode]};
  const channel={...old,queueVersion:2,schedule:[{...episode,episodeId:'a1',airStatus:'ready'},{...episode,episode:'2',ordinal:2,episodeId:'a2',airStatus:'ready'}],migration:{activateAt:BROADCAST_EPOCH+618,legacySchedule:old.schedule,cursors:{a:1}}};
  for(const elapsed of [0,299,300,317,318,617]){
    const at=(BROADCAST_EPOCH+elapsed)*1000;
    assert.deepEqual(broadcastPosition(channel,at).currentItem,oldPosition(old,at).currentItem);
  }
  const pos=broadcastPosition(channel,(BROADCAST_EPOCH+618)*1000);
  assert.equal(pos.currentItem.episodeId,'a2');assert.equal(pos.repeat,false);assert.equal(pos.elapsed,0);
  const rows=broadcastRows(channel,(BROADCAST_EPOCH+620)*1000,2);
  assert.equal(rows[0].duration,618);assert.equal(rows[0].start,BROADCAST_EPOCH+618);
  const resumed=broadcastPosition(channel,(BROADCAST_EPOCH+618+318)*1000);
  assert.equal(resumed.currentItem.episodeId,'a2');assert.equal(resumed.elapsed,300);
});
