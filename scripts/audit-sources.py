import json,urllib.request,re,concurrent.futures,time
from pathlib import Path
p=Path('schedule.json'); data=json.loads(p.read_text('utf-8-sig'))
urls=list(dict.fromkeys(s['url'] for c in data for s in c['schedule'] if s.get('type')=='hls' and not s.get('sourceOffset')))
def check(url):
 try:
  with urllib.request.urlopen(url,timeout=12) as r: text=r.read().decode()
  total=sum(float(x) for x in re.findall(r'#EXTINF:([\d.]+)',text))
  return {'url':url,'ok':text.startswith('#EXTM3U'),'duration':round(total),'segments':len(re.findall('#EXTINF:',text))}
 except Exception as e:return {'url':url,'ok':False,'error':str(e)}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 for i,r in enumerate(pool.map(check,urls)):
  results.append(r)
  if i%24==0:print('Checked',i+1,'of',len(urls),flush=True)
Path('source-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('SUMMARY',len(results),sum(r['ok'] for r in results),results[:2],flush=True)
