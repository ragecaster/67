#!/usr/bin/env python3
"""Download images from the Terraria Fandom wiki into assets/.
usage: fetch.py outdir "Wiki File.png" ["Other.png" ...]  (or names via stdin, one per line: "Wiki Name.png=local_name.png")"""
import sys, json, os, urllib.request, urllib.parse
UA={'User-Agent':'Mozilla/5.0 (hobby terraria fan project)'}
import subprocess
def get(url):
    return subprocess.run(['curl','-sLf','--max-time','60','-A',UA['User-Agent'],url],check=True,capture_output=True).stdout
def resolve(names):
    out={}
    for i in range(0,len(names),40):
        chunk=names[i:i+40]
        q=urllib.parse.urlencode({'action':'query','titles':'|'.join('File:'+n for n in chunk),'prop':'imageinfo','iiprop':'url','format':'json'})
        d=json.loads(get('https://terraria.fandom.com/api.php?'+q))
        norm={x['to']:x['from'] for x in d['query'].get('normalized',[])}
        for p in d['query']['pages'].values():
            t=p['title']; orig=norm.get(t,t)[5:]
            if 'imageinfo' in p: out[orig]=p['imageinfo'][0]['url']
    return out
def main():
    outdir=sys.argv[1]; os.makedirs(outdir,exist_ok=True)
    pairs=[]
    args=sys.argv[2:] or [l.strip() for l in sys.stdin if l.strip() and not l.startswith('#')]
    for a in args:
        w,_,l=a.partition('=')
        pairs.append((w.strip().replace(' ','_'),(l.strip() or w.strip().replace(' ','_'))))
    urls=resolve([w for w,_ in pairs])
    missing=[]
    for w,l in pairs:
        dest=os.path.join(outdir,l)
        if os.path.exists(dest): continue
        u=urls.get(w)
        if not u: missing.append(w); continue
        open(dest,'wb').write(get(u))
    print('ok',len(pairs)-len(missing),'missing',missing)
main()
