import json,re,time
from pathlib import Path
c=json.loads(Path('.tools/library.json').read_text('utf-8'))
mp4={s['url']:s for s in json.loads(Path('.tools/mp4-metadata.json').read_text('utf-8'))}
music=json.loads(Path('.tools/checked-music.json').read_text('utf-8-sig'))
extra=json.loads(Path('.tools/new-music.json').read_text('utf-8-sig'))
titles={'Xy6lZxoJ4ts':'Kessoku Band — Distortion!!','n1K5BDHnr7c':'Kessoku Band — Seishun Complex · Live','1tk1pqwrOys':'Eve — Kaikai Kitan · Music Video','U_rWZK_8vUY':'Official HIGE DANdism — Mixed Nuts','nRKJBpFFsuI':'Gen Hoshino — Comedy'}
for s in extra:
 music.append({'title':titles[s['youtubeId']],'sourceTitle':s['title'],'youtubeId':s['youtubeId'],'duration':s['duration'],'episode':'Аниме-звук · Опенинги, эндинги и выступления','block':'Аниме-звук','type':'youtube','poster':'https://i.ytimg.com/vi/'+s['youtubeId']+'/hqdefault.jpg'})
for ch in c:
 for s in ch['schedule']:
  if s['type']=='video' and s['url'] in mp4:s.update(mp4[s['url']])
  if s.get('releaseId') in (8789,9470):s['seriesKey']='jujutsu-kaisen'
  if s.get('releaseId') in (8325,9093):s['seriesKey']='demon-slayer'
  if s.get('youtubeId'):s['poster']='https://i.ytimg.com/vi/'+s['youtubeId']+'/hqdefault.jpg'
 if ch['category']=='music':ch['schedule']=music
 if ch['id']=='cartoons-edge':ch['schedule']=[s for s in ch['schedule'] if s['title']!='Подозрительная сова' or s['ordinal']<=10]
 seen=set();ch['schedule']=[s for s in ch['schedule'] if (s['title'],s.get('url') or s.get('rutubeId') or s.get('youtubeId')) not in seen and not seen.add((s['title'],s.get('url') or s.get('rutubeId') or s.get('youtubeId')))]
Path('schedule.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Path('channels.js').write_text('// Библиотека шести каналов. Эфирная ротация собирается в broadcastPlanner.\nexport const DEFAULT_CHANNELS = '+json.dumps(c,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Library records',[(ch['id'],len(ch['schedule'])) for ch in c])
