import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferedAhead,qualityTarget,qualityLevel,variantPlaylist,shouldSuggestDelay,bufferGoal} from '../src/playbackPolicy.js';
test('Only the contiguous playable range counts towards the buffer',()=>{
 const video={currentTime:12,buffered:{length:2,start:i=>[0,30][i],end:i=>[15,90][i]}};
 assert.equal(bufferedAhead(video),3);assert.equal(bufferedAhead(video,20),0);assert.equal(bufferedAhead(video,35),55);
});
test('Delay is suggested after trouble and never enabled or repeatedly nagged automatically',()=>{
 assert.equal(shouldSuggestDelay({waitingMs:2000,stalls:0,enabled:false,dismissed:false}),false);
 assert.equal(shouldSuggestDelay({waitingMs:9000,stalls:0,enabled:false,dismissed:false}),true);
 assert.equal(shouldSuggestDelay({waitingMs:1000,stalls:2,enabled:false,dismissed:false}),true);
 assert.equal(shouldSuggestDelay({waitingMs:9000,stalls:3,enabled:true,dismissed:false}),false);
 assert.equal(shouldSuggestDelay({waitingMs:9000,stalls:3,enabled:false,dismissed:true}),false);
 assert(bufferGoal(true,true)>bufferGoal(false,true));
});
test('Quality ladder supports automatic, best and low while retaining absolute provider links',()=>{
 const levels=[{height:480},{height:720},{height:1080}];assert.equal(qualityLevel(levels,'auto'),-1);assert.equal(qualityLevel(levels,'low'),0);assert.equal(qualityLevel(levels,'best'),2);assert.equal(qualityTarget('low'),480);
 const text=variantPlaylist([480,720,1080].map(quality=>({quality,type:'hls',url:`https://example.test/${quality}/index.m3u8`})));
 assert(text.startsWith('#EXTM3U'));assert.equal((text.match(/EXT-X-STREAM-INF/g)||[]).length,3);
 assert(text.includes('https://example.test/480/index.m3u8'));assert.equal(variantPlaylist([{quality:480,type:'hls',url:'https://example.test/480.m3u8'}]),null);
});
