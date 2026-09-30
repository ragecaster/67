import sys,json,subprocess,urllib.parse
names=[l.strip().replace(' ','_') for l in sys.stdin if l.strip()]
for i in range(0,len(names),45):
    ch=names[i:i+45]
    q=urllib.parse.urlencode({'action':'query','titles':'|'.join('File:'+n for n in ch),'prop':'imageinfo','iiprop':'size','format':'json'})
    d=json.loads(subprocess.run(['curl','-sL','-A','Mozilla/5.0','https://terraria.fandom.com/api.php?'+q],capture_output=True).stdout)
    for p in d['query']['pages'].values():
        ii=p.get('imageinfo')
        print(('OK  ' if ii else 'MISS'),p['title'][5:],(f"{ii[0]['width']}x{ii[0]['height']}" if ii else ''))
