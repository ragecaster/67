#!/usr/bin/env python3
"""Regenerate src/asset_manifest.js from tools/manifest.txt (used when the game downloads assets in the browser)."""
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
for line in open(os.path.join(ROOT, 'tools', 'manifest.txt')):
    line = line.strip()
    if not line or line.startswith('#'): continue
    folder, names = line.split('|')
    out[folder] = names.split(',')
with open(os.path.join(ROOT, 'src', 'asset_manifest.js'), 'w') as f:
    f.write('// generated from tools/manifest.txt by tools/gen_manifest_js.py\nconst ASSET_MANIFEST = ')
    json.dump(out, f, indent=0)
    f.write(';\n')
print('wrote src/asset_manifest.js')
