#!/bin/bash
# Double-click this file to run the Fremont ASB site locally.
# First run takes a minute (installs packages); after that it's instant.
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

echo "Starting the site... your browser will open at http://localhost:5173"
( sleep 2 && open http://localhost:5173 ) &
npm run dev
