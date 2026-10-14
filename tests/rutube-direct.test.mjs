import test from 'node:test';
import assert from 'node:assert/strict';
test('Native Rutube resolution keeps stable plan items and falls back to iframe after direct-stream failure',async()=>{
 globalThis.window={YturokMedia:{version:()=>2}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({video_balancer:{m3u8:'https://bl.rutube.ru/route/test.m3u8?expire=1'}})});
 const api=await import('../src/rutubeDirect.js');
 const item={type:'rutube',rutubeId:'test',duration:700};
 assert(api.shouldResolveRutube(item));await api.resolveRutube(item);
 const direct=api.directRutubeItem(item);assert.equal(direct.type,'hls');assert.equal(api.directRutubeItem(item),direct);
 assert.equal(item.type,'rutube');api.rejectDirectRutube(direct);
 assert.equal(api.directRutubeItem(item),item);assert.equal(api.shouldResolveRutube(item),false);
 api.resetRutube(item);assert.equal(api.shouldResolveRutube(item),true);
});
