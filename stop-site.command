#!/bin/bash
# Double-click to stop the background Fremont ASB site.
cd "$(dirname "$0")"
if [ -f .site.pid ]; then
  pkill -P "$(cat .site.pid)" 2>/dev/null
  kill "$(cat .site.pid)" 2>/dev/null
  rm -f .site.pid
fi
# Catch anything still holding the port
lsof -ti :5173 | xargs kill 2>/dev/null
echo "Site stopped."
