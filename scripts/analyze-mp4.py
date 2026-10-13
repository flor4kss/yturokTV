import json,sys,urllib.request,subprocess,re,hashlib
from pathlib import Path
sys.path.insert(0,str(Path('.tools').resolve()));import imageio_ffmpeg
items=json.loads(Path('.tools/mp4-metadata.json').read_text('utf-8'))
results=[]
for item in items:
 result={'title':item['title'],'source':item['url']}
 temp=Path('.tools')/('video-'+hashlib.sha256(item['url'].encode()).hexdigest()[:12]+'.mp4')
 try:
  with urllib.request.urlopen(item['url'],timeout=20) as response:
   size=int(response.headers.get('Content-Length') or 0)
   if size>64000000:raise ValueError('File exceeds analysis limit')
   data=response.read(64000001)
   if len(data)>64000000:raise ValueError('File exceeds analysis limit')
  temp.write_bytes(data)
  start=max(90,int(item['duration']*.5)-12)
  run=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-ss',str(start),'-i',str(temp),'-t','24','-an','-vf',"setpts=PTS-STARTPTS,fps=4,scale=96:-2,select='gt(scene,0.28)',showinfo",'-f','null','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15,creationflags=0x08000000)
  log=run.stderr.decode('utf-8','replace');result['decoded']=run.returncode==0
  cuts=[float(t) for t in re.findall(r'\bn:\s*\d+.*?pts_time:([\d.]+)',log)]
  if cuts:item['adBreakAt']=round(start+min(cuts,key=lambda t:abs(t-12)));item['adBreakMethod']='detected-cut';result['adBreakAt']=item['adBreakAt']
 except Exception as e:result['error']=str(e)
 finally:temp.unlink(missing_ok=True)
 results.append(result);print('MP4',len(results),'/',len(items),'decoded',result.get('decoded',False),flush=True)
 Path('.tools/mp4-metadata.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
 Path('.tools/mp4-scenes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
