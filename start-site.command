#!/bin/bash
# Double-click to run the Fremont ASB site in the BACKGROUND.
# You can close the Terminal window afterwards — the site keeps running.
# To stop it, double-click stop-site.command.
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "Node.js isn't installed yet. Install it first:"
  echo "  https://nodejs.org  (LTS version, one-click installer)"
  echo "Then double-click this file again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run — installing packages (about a minute)..."
  npm install
fi

# Already running? Just open the browser.
if [ -f .site.pid ] && kill -0 "$(cat .site.pid)" 2>/dev/null; then
  echo "Site is already running."
  open http://localhost:5173
  exit 0
fi

echo "Starting the site in the background..."
nohup npm run dev > .site.log 2>&1 &
echo $! > .site.pid
sleep 3
open http://localhost:5173
echo ""
echo "Done — the site is at http://localhost:5173"
echo "You can CLOSE this window. It keeps running until you log out,"
echo "restart the Mac, or double-click stop-site.command."
