// Candidate-only preparation. This command never changes the live library.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {timeline,BROADCAST_EPOCH} from '../src/legacyBroadcastPlanner.js';
import {seriesId} from '../src/episodeQueue.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'schedule.json'),'utf8'));
const channels=structuredClone(source);
const now=Math.floor(Date.now()/1000),notBefore=now+3600;
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,20);
const independent=new Set(['Лунтик','Фиксики','Смешарики']);
for(const channel of channels){
  if(channel.category==='music')continue;
  for(const [index,item] of channel.schedule.entries()){
    item.seriesKey ||= `series-${hash(channel.id+':'+item.title)}`;
    item.episodeId ||= `ep-${hash([channel.id,item.seriesKey,item.seasonOrder||0,item.releaseId||'',item.ordinal??index].join(':'))}`;
    item.continuity=independent.has(item.title)?'episodic':'story';
    // Grandfather existing entries without claiming an independent playback check.
    item.airStatus ||= 'legacy';
    if(item.type==='rutube'){
      item.airStatus='excluded';
      item.exclusionReason='RUTUBE is unavailable in the site player; excluded by user instruction.';
    }
    item.validation ||= {metadata:item.sourceCheck||'unknown',stream:'unconfirmed',playback:'unconfirmed'};
  }
  const original=source.find(c=>c.id===channel.id);
  const plan=timeline(original,notBefore-BROADCAST_EPOCH);
  const last=plan.items.find(e=>BROADCAST_EPOCH+e.start+e.item.duration>=notBefore && e.item.type!=='bumper' && (!e.item.mediaDuration || e.item.sourceOffset));
  if(!last)throw new Error('No whole-programme activation boundary');
  const activateAt=BROADCAST_EPOCH+last.start+last.item.duration;
  const cursors={};
  for(const entry of plan.items){
    if(entry.start+entry.item.duration>activateAt-BROADCAST_EPOCH)break;
    if(entry.item.type==='bumper' || entry.item.sourceOffset || entry.item.repeat)continue;
    const old=original.schedule.findIndex(i=>i===entry.item || (i.title===entry.item.title && i.episode===entry.item.episode && i.url===entry.item.url));
    const migrated=channel.schedule[old];if(!migrated)continue;
    const family=channel.schedule.filter(i=>seriesId(i)===seriesId(migrated));
    cursors[seriesId(migrated)]=Math.max(cursors[seriesId(migrated)]||0,family.indexOf(migrated)+1);
  }
  channel.queueVersion=2;
  channel.migration={activateAt,cursors,previousSeries:channel.schedule.find(i=>i.title===last.item.title)?.seriesKey,legacySchedule:original.schedule};
}
const pack={libraryVersion:'candidate-6',scheduleVersion:2,preparedAt:new Date().toISOString(),channels};
const output=path.join(root,'.tools','candidate-pack');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'pack.json'),JSON.stringify(pack,null,2)+'\n');
const edge=channels.find(c=>c.id==='cartoons-edge');
const active=[...new Set(edge.schedule.filter(i=>i.airStatus==='ready'||i.airStatus==='legacy').map(seriesId))];
const failures=[];
if(active.length<3)failures.push(`Мульт Грань: ${active.length}/3 сериалов; нужны два полных первых сезона на русском вне RUTUBE.`);
const report={ready:false,libraryVersion:pack.libraryVersion,scheduleVersion:pack.scheduleVersion,failures,notes:['Кандидат сохранён отдельно. Действующие schedule.json и channels.js не изменены.','legacy означает старую запись, а не подтверждённую проверку воспроизведения.']};
fs.writeFileSync(path.join(output,'readiness.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=1;
