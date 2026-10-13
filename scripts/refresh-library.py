import json,urllib.request,re,time
from pathlib import Path
channels=json.loads(Path('schedule.json').read_text('utf-8-sig'))
def api(path):
 with urllib.request.urlopen('https://anilibria.top/api/v1/'+path,timeout=20) as r:return json.load(r)
report=[]
for channel in channels:
 originals=[s for s in channel['schedule'] if s['type']!='bumper' and not s.get('sourceOffset')]
 output=[]; releases={}
 for item in originals:
  if item['type']=='hls':releases.setdefault(re.search(r'/ts/(\d+)/',item['url']).group(1),item['title'])
  else:
   s=dict(item);s['duration']=s.get('mediaDuration',s['duration']);s.pop('mediaDuration',None);output.append(s)
 if channel['id']=='anime-light':releases['824']='K-On!'
 if channel['id']=='anime-edge':releases['9527']='Психопаспорт'
 for release_id,title in releases.items():
  release=api('anime/releases/'+release_id)
  poster=release.get('poster',{}).get('optimized',{}).get('src') or release.get('poster',{}).get('src')
  if poster and poster.startswith('/'):poster='https://anilibria.top'+poster
  eps=sorted(release.get('episodes',[]),key=lambda e:float(e.get('ordinal') or 0))
  for ep in eps:
   url=ep.get('hls_720') or ep.get('hls_480')
   if not url or not ep.get('duration'):continue
   output.append({'title':title,'episode':f"Серия {ep['ordinal']}"+((': '+ep['name']) if ep.get('name') else ''),'ordinal':ep['ordinal'],'duration':round(ep['duration']),'type':'hls','url':url,'poster':poster,'releaseId':int(release_id),'language':'ru','description':re.sub('<[^>]*>','',release.get('description') or '')[:180]})
  report.append({'title':title,'releaseId':int(release_id),'episodes':len(eps)})
  print(title,len(eps),flush=True);time.sleep(.12)
 channel['schedule']=output;channel['catalogVersion']=4
Path('.tools/library.json').write_text(json.dumps(channels,ensure_ascii=False,indent=2),encoding='utf-8')
Path('library-audit.json').write_text(json.dumps({'releases':report,'checkedAt':'2026-10-12','note':'Release metadata refreshed; stream and scene audit follows.'},ensure_ascii=False,indent=2),encoding='utf-8')
