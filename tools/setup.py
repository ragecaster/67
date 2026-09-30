#!/usr/bin/env python3
"""One-time setup: download the Terraria sprites/sounds/music from the Terraria Wiki into assets/
and pack them into src/assets_data.js. Needs python3 + curl (both ship with macOS, Linux and Windows 10+).

    python3 tools/setup.py
"""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
lines = [l.strip() for l in open('tools/manifest.txt') if l.strip() and not l.startswith('#')]
for i, line in enumerate(lines, 1):
    folder, names = line.split('|')
    names = names.split(',')
    print(f'[{i}/{len(lines)}] downloading {len(names)} files into assets/{folder} ...', flush=True)
    r = subprocess.run([sys.executable, 'tools/fetch.py', 'assets/' + folder] + names, capture_output=True, text=True)
    print('   ', (r.stdout or r.stderr).strip()[-300:])
    if r.returncode != 0:
        sys.exit('Download failed. Check your internet connection and run setup again (it resumes).')
print('packing assets ...', flush=True)
subprocess.run([sys.executable, 'tools/build_assets.py'], check=True)
print('\nDone! Open index.html (or run ./play.sh / play.bat) to play.')
