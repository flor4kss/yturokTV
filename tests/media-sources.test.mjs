import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaSource,rejectSource,resetSourceFailures} from '../src/mediaSources.js';
test('TV prefers 480p and failures fall back without changing the shared episode',()=>{
 const item={type:'hls',url:'720',sources:[{url:'720',type:'hls',quality:720},{url:'480',type:'hls',quality:480}]};
 assert.equal(mediaSource(item,true).url,'480');
 assert.equal(rejectSource('480',item,true),true);
 assert.equal(mediaSource(item,true).url,'720');
 assert.equal(rejectSource('720',item,true),false);
 assert.equal(item.url,'720');
 resetSourceFailures(item);assert.equal(mediaSource(item,true).url,'480');
});
