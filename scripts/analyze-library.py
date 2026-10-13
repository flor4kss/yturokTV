import sys,json,re,urllib.request,subprocess,time,concurrent.futures,threading
from urllib.parse import urljoin
rate=threading.Lock();last_request=0
from pathlib import Path
sys.path.insert(0,str(Path('.tools').resolve()));import imageio_ffmpeg
sys.stdout.reconfigure(encoding='utf-8')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();library=json.loads(Path('.tools/library.json').read_text('utf-8'))
items=[s for c in library for s in c['schedule'] if s['type'] in ('hls','video','rutube')]
def get(url,binary=False):
 global last_request
 with rate:
  time.sleep(max(0,.85-(time.monotonic()-last_request)));last_request=time.monotonic()
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=15) as r:
  data=r.read(16000000)
  return data if binary else data.decode('utf-8')
def check(item):
 out={'title':item['title'],'episode':item['episode'],'source':item.get('url') or item.get('rutubeId')}
 try:
  url=item.get('url')
  if item['type']=='rutube':
   info=json.loads(get('https://rutube.ru/api/play/options/'+item['rutubeId']+'/?format=json'));url=info['video_balancer']['m3u8']
  if item['type']=='video':
   out['accessible']=True;out['check']='Existing MP4 retained; scene unverified';return out
  manifest=get(url)
  if '#EXTINF:' not in manifest:
   children=[line.strip() for line in manifest.splitlines() if line and not line.startswith('#')]
   url=urljoin(url,children[-1]);manifest=get(url)
  if '#EXT-X-KEY' in manifest:
   out['accessible']=True;out['check']='Manifest available; encrypted scene skipped';return out
  segments=re.findall(r'#EXTINF:([\d.]+),[^\n]*\n([^\n]+)',manifest)
  total=sum(float(t) for t,_ in segments)
  if not total:raise ValueError('No media segments')
  item['duration']=round(total);out['duration']=round(total)
  start=0;middle=total*.5
  for duration,segment in segments:
   if start+float(duration)>middle:break
   start+=float(duration)
  fragment=get(urljoin(url,segment.strip()),True)
  cmd=[ffmpeg,'-nostdin','-hide_banner','-loglevel','info','-i','pipe:0','-an','-vf',"setpts=PTS-STARTPTS,fps=4,scale=96:-2,select='gt(scene,0.28)',showinfo",'-f','null','-']
  run=subprocess.run(cmd,input=fragment,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,creationflags=0x08000000)
  log=run.stderr.decode('utf-8','replace');out['accessible']=run.returncode==0
  cuts=[float(t) for t in re.findall(r'\bn:\s*\d+.*?pts_time:([\d.]+)',log)]
  if cuts:
   cut=round(start+min(cuts,key=lambda x:abs(x-(middle-start))));item['adBreakAt']=cut;item['adBreakMethod']='detected-cut';out['adBreakAt']=cut
  if not out['accessible']:out['error']=log[-350:]
 except Exception as e:out['error']=str(e);out['accessible']=False
 time.sleep(.4)
 return out
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,result in enumerate(pool.map(check,items)):
  results.append(result)
  Path('library-audit.json').write_text(json.dumps({'checkedAt':'2026-10-12','items':results},ensure_ascii=False,indent=2),encoding='utf-8')
  Path('.tools/library.json').write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8')
  if i%10==0:print('Video audit',i+1,'/',len(items),'accessible',sum(s.get('accessible',False) for s in results),'scene cuts',sum('adBreakAt' in s for s in results),flush=True)
print('FINISHED',len(results),sum(s.get('accessible',False) for s in results),sum('adBreakAt' in s for s in results),flush=True)
