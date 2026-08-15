#!/usr/bin/env bash
# Starts the FarmFlow backend and web app. Ctrl-C stops both.
set -e
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  echo "  Creating the backend environment..."
  (cd backend && python3 -m venv .venv && .venv/bin/pip install --quiet -r requirements.txt)
fi

if [ ! -d web/node_modules ]; then
  echo "  Installing web dependencies..."
  (cd web && npm install)
fi

(cd backend && .venv/bin/python -m uvicorn app.main:app --reload) &
API=$!
(cd web && npm run dev) &
WEB=$!

echo
echo "  API   http://localhost:8000/docs"
echo "  App   http://localhost:5173"
echo "  Login farmer / farmflow"
echo

trap 'kill $API $WEB 2>/dev/null' EXIT
wait
