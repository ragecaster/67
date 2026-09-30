#!/bin/sh
# Serves the game locally and opens it (opening index.html directly also works).
cd "$(dirname "$0")"
if [ ! -f src/assets_data.js ]; then echo "Assets missing - running first-time setup..."; python3 tools/setup.py || exit 1; fi
PORT=${PORT:-6767}
(sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &
python3 -m http.server $PORT
