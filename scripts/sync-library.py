"""Refresh curated complete releases and cartoon collections. Never bake expiring Rutube streams into the catalog."""
import json,re,time,urllib.request,urllib.parse,datetime,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Prepare metadata-only candidate library; does not publish.')
parser.add_argument('--output-dir',type=Path,default=ROOT/'.tools'/'candidate-library')
args=parser.parse_args()
OUTPUT=args.output_dir.resolve()
if OUTPUT==ROOT:raise SystemExit('Refusing to overwrite the live library. Prepare and validate a candidate package first.')
OUTPUT.mkdir(parents=True,exist_ok=True)
def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'yturokTV library sync'}),timeout=25) as r:return json.load(r)
  except Exception:
   if attempt==2:raise
   time.sleep(2*(attempt+1))
def sources(ep):return [{'url':ep['hls_'+str(q)],'quality':q,'type':'hls','provider':'aniliberty'} for q in [720,480,1080] if ep.get('hls_'+str(q))]
channels=read('schedule.json');config=read('library-sources.json');report=[]
old={(i.get('releaseId'),i.get('ordinal')):i for c in channels for i in c['schedule'] if i.get('releaseId')}
for c in channels:
 families=config['anilibria'].get(c['id'])
 if not families:continue
 output=[i for i in c['schedule'] if not i.get('releaseId') and i['type']!='hls']
 for key,ids in families.items():
  for order,rid in enumerate(ids):
   try:
    d=get('https://anilibria.top/api/v1/anime/releases/'+str(rid));eps=sorted(d.get('episodes',[]),key=lambda e:float(e.get('ordinal') or 0))
    if d.get('is_blocked_by_geo') or d.get('is_blocked_by_copyrights'):raise ValueError('release restricted')
    title=d['name']['main'];poster=d.get('poster',{}).get('optimized',{}).get('src') or d.get('poster',{}).get('src')
    if poster and poster.startswith('/'):poster='https://anilibria.top'+poster
    imported=0
    for e in eps:
     ss=sources(e)
     if not ss or not e.get('duration'):continue
     prior=old.get((rid,e['ordinal']),{});label=f"Серия {e['ordinal']}"+((': '+e['name']) if e.get('name') else '')
     item={**prior,'title':prior.get('title',title),'episode':label,'ordinal':e['ordinal'],'duration':round(e['duration']),'type':'hls','url':ss[0]['url'],'tvUrl':e.get('hls_480') or ss[0]['url'],'sources':ss,'poster':poster,'releaseId':rid,'seriesKey':key,'seasonOrder':order,'language':'ru','sourceCheckedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCheck':'provider-metadata'}
     if key=='k-on':item['title']='K-On!'
     output.append(item);imported+=1
    report.append({'releaseId':rid,'title':title,'episodes':imported,'reportedTotal':d.get('episodes_total')})
    print('release',rid,imported,flush=True)
   except Exception as e:
    output.extend(i for (r,_),i in old.items() if r==rid)
    report.append({'releaseId':rid,'error':str(e),'preservedExisting':True});print('release',rid,'preserved:',str(e),flush=True)
   time.sleep(.25)
 c['schedule']=output
for spec in config['archive']:
 c=next(c for c in channels if c['id']==spec['channel']);previous=[i for i in c['schedule'] if i['title']==spec['title'] and i.get('collection')!=spec['collection']];poster=next((i.get('poster') for i in c['schedule'] if i['title']==spec['title'] and i.get('poster')),None)
 try:
  d=get('https://archive.org/metadata/'+spec['collection']);rows=[]
  for f in d.get('files',[]):
   m=re.match(spec['pattern'],f['name']);duration=float(f.get('length') or 0)
   if not m or not 180<duration<900:continue
   n=int(m.group(1) or 0);url='https://archive.org/download/'+spec['collection']+'/'+urllib.parse.quote(f['name'])
   mirror=('https://'+d['d1']+d['dir']+'/'+urllib.parse.quote(f['name'])) if d.get('d1') and d.get('dir') else None
   choices=[{'url':url,'type':'video','provider':'archive'}]+([{'url':mirror,'type':'video','provider':'archive-mirror'}] if mirror and mirror!=url else [])
   rows.append({'title':spec['title'],'episode':f"Серия {n}" if spec['numbered'] else f"Сборник «Редкий диск» · выпуск {n+1}",'ordinal':n,'duration':round(duration),'type':'video','url':url,'sources':choices,'poster':poster,'language':'ru','collection':spec['collection'],'sourceCheck':'collection-metadata','sourceCheckedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
  rows.sort(key=lambda i:i['ordinal'])
  # Preserve the old first Luntik episode; the disc is a separate curated compilation.
  if spec['title']=='Лунтик':rows=previous+rows
  if rows:c['schedule']=[i for i in c['schedule'] if i['title']!=spec['title']]+rows
  report.append({'collection':spec['collection'],'episodes':len(rows)});print('collection',spec['collection'],len(rows),flush=True)
 except Exception as e:report.append({'collection':spec['collection'],'error':str(e)})
for c in channels:
 c['catalogVersion']=5
 for i in c['schedule']:
  if i.get('sources') is None and i.get('url') and i['type']!='youtube':i['sources']=[{'url':i['url'],'type':i['type']}]
(OUTPUT/'schedule.json').write_text(json.dumps(channels,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUTPUT/'channels.js').write_text('// Candidate only; not approved for broadcast.\nexport const DEFAULT_CHANNELS = '+json.dumps(channels,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(OUTPUT/'library-audit.json').write_text(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':'Metadata only. Playback checks are recorded separately.','readyForPublication':False,'results':report},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('counts',[(c['id'],len(c['schedule'])) for c in channels])
