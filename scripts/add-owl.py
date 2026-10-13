import json,urllib.request,re,concurrent.futures,time
from pathlib import Path
library=json.loads(Path('.tools/library.json').read_text('utf-8'))
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=20) as r:return r.read().decode('utf-8')
urls=set()
for page in range(1,5):
 html=get('https://2x2tv.ru/video/owl/season-1/?pagination=6&page='+str(page))
 urls.update(re.findall(r'href="(/video/owl/season-1/(?:episode|epizod)[^"]+)"',html))
def episode(path):
 html=get('https://2x2tv.ru'+path)
 match=re.search(r'rutube.ru/play/embed/([0-9a-f]{32})',html)
 if not match:return None
 rid=match.group(1);opts=json.loads(get('https://rutube.ru/api/play/options/'+rid+'/?format=json'))
 if not opts.get('video_balancer'):return None
 title=opts['title'];ordinal=int(re.search(r'(\d+)\s*серия',title).group(1))
 return {'title':'Подозрительная сова','episode':'Сезон 1 · Серия '+str(ordinal),'ordinal':ordinal,'duration':round(opts['duration']/1000),'type':'rutube','rutubeId':rid,'poster':opts.get('thumbnail_url'),'language':'ru','sourcePage':'https://2x2tv.ru'+path}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: items=[s for s in pool.map(episode,urls) if s]
items.sort(key=lambda s:s['ordinal'])
library[4]['schedule'].extend(items)
Path('.tools/library.json').write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8')
print('Official Russian Owl episodes',len(items),[s['ordinal'] for s in items],flush=True)

