import json,time,urllib.request
from pathlib import Path
names={'Доктор Стоун':38329,'Одинокий рокер!':47917,'Семья шпиона':50265,'K-On!':5680,'Магическая битва':40748,'Клинок, рассекающий демонов':38000,'Поднятие уровня в одиночку':52299,'Ванпанчмен':30276,'Моб Психо 100':32182,'Магическая битва 2':51009,'Клинок, Рассекающий Демонов: Квартал Красных Фонарей':47778,'Сага о Винланде':37521,'Киберпанк: Бегущие по краю':42310,'Токийский Гуль':22319,'Психопаспорт':13601}
result={}
for title,mal in names.items():
 try:
  req=urllib.request.Request('https://shikimori.one/api/animes/'+str(mal)+'/videos',headers={'User-Agent':'yturokTV trailer catalog'})
  with urllib.request.urlopen(req,timeout=12) as r:videos=json.load(r)
  videos=sorted(videos,key=lambda v: v.get('kind')!='pv')
  video=next((v for v in videos if v.get('kind') in ('pv','cm') and ('youtu' in v.get('url',''))),None)
  if video:
   import re
   match=re.search(r'(?:youtu.be/|[?&]v=|embed/)([A-Za-z0-9_-]{11})',video.get('url','')+' '+video.get('player_url',''))
   if match:result[title]={'youtubeId':match.group(1),'malId':mal,'source':'https://shikimori.one/animes/'+str(mal),'label':video.get('name') or 'Трейлер'}
  print(mal,result.get(title,{}).get('youtubeId'),flush=True)
 except Exception as e:print(mal,str(e),flush=True)
 time.sleep(.25)
result['Адский босс']={'youtubeId':'cGq4U3FyCTE','source':'https://www.youtube.com/watch?v=cGq4U3FyCTE','label':'Official trailer · Vivziepop'}
result['Фиксики']={'youtubeId':'2IOFft1hpPo','source':'https://www.youtube.com/watch?v=2IOFft1hpPo','label':'Промо мультсериала · официальный канал Фиксики'}
result['Лунтик']={'youtubeId':'7de6fZ_JMFQ','source':'https://www.youtube.com/watch?v=7de6fZ_JMFQ','label':'Промо мультсериала · Лунтик'}
for title,youtubeId,label in [('Смешарики','6KeOCI-HiU8','Промо мультсериала · Кинопоиск'),('Подозрительная сова','r_agYhlyfx8','Трейлер мультсериала')]:
 result[title]={'youtubeId':youtubeId,'source':'https://www.youtube.com/watch?v='+youtubeId,'label':label}
Path('src/trailerCatalog.js').write_text('// Трейлеры конкретных тайтлов. Видеокаталог Shikimori и официальные проморолики.\nexport const TRAILERS = '+json.dumps(result,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')



