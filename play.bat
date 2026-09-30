@echo off
rem Serves the game locally and opens it in your browser (Windows).
cd /d "%~dp0"
if not exist src\assets_data.js (
  echo Assets missing - running first-time setup...
  python tools\setup.py || py tools\setup.py
)
start "" http://localhost:6767
python -m http.server 6767 || py -m http.server 6767
