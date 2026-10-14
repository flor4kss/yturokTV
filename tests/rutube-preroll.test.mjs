import test from 'node:test';
import assert from 'node:assert/strict';
test('Rutube preroll never triggers a seek; episode playback applies one initial seek',async()=>{
 let receive,ready=0;const messages=[];
 const contentWindow={postMessage:m=>messages.push(JSON.parse(m))};
 const frame={contentWindow,classList:{add(){},remove(){}}};
 globalThis.window={addEventListener:(_,fn)=>receive=fn};
 globalThis.document={getElementById:()=>frame};globalThis.location={search:''};
 const api=await import('../src/rutubePlayer.js');
 api.playRutube({rutubeId:'test'},120,{volume:1,started:true,isActive:()=>true,onReady:()=>ready++,onError(){},onEnded(){}});
 const event=(type,data)=>receive({origin:'https://rutube.ru',source:contentWindow,data:JSON.stringify({type,data})});
 event('player:ready',{});event('player:changeState',{state:'advert',isPlaying:true});api.rutubeSeek(130);
 assert.equal(messages.filter(m=>m.type==='player:setCurrentTime').length,0);assert.equal(api.rutubeIsPlaying(),false);assert.equal(ready,1);
 event('player:changeState',{state:'playing'});assert.equal(messages.filter(m=>m.type==='player:setCurrentTime').length,1);
 assert.equal(messages.find(m=>m.type==='player:setCurrentTime').data.time,130);
 event('player:changeState',{state:'buffering'});event('player:changeState',{state:'playing'});
 assert.equal(messages.filter(m=>m.type==='player:setCurrentTime').length,1);
});
