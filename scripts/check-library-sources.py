import json,urllib.request,time,datetime,urllib.parse
from pathlib import Path
cs=json.loads(Path('schedule.json').read_text(encoding='utf-8'));report=[];seen=set()
for c in cs:
 for i in c['schedule']:
  if i.get('releaseId'):
   if i['releaseId'] in seen:continue
   seen.add(i['releaseId']);sources=i['sources'][:2]
  elif i.get('collection'):sources=i['sources']
  else:continue
  for source in sources:
   try:
    req=urllib.request.Request(source['url'],headers={'User-Agent':'Mozilla/5.0','Range':'bytes=0-2047'})
    with urllib.request.urlopen(req,timeout=15) as r:raw=r.read(2048);code=r.status
    ok=raw.startswith(b'#EXTM3U') if source['type']=='hls' else b'ftyp' in raw[:100]
    report.append({'title':i['title'],'episode':i['episode'],'releaseId':i.get('releaseId'),'quality':source.get('quality'),'url':source['url'],'http':code,'validHeader':ok})
   except Exception as e:report.append({'title':i['title'],'url':source['url'],'error':str(e)})
   time.sleep(.2)
Path('source-health.json').write_text(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'One episode per anime release (720/480 manifests), all newly imported cartoon MP4 headers. Not full-length playback.','results':report},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('checked',len(report),'valid',sum(r.get('validHeader',False) for r in report),'failures',json.dumps([r for r in report if not r.get('validHeader')],ensure_ascii=True)[:1800],flush=True)
