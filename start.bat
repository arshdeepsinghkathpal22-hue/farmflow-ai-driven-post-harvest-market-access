@echo off
REM Starts the FarmFlow backend and web app in separate windows.
REM First run installs dependencies; later runs skip straight to serving.

echo Starting FarmFlow...

if not exist "backend\.venv" (
  echo   Creating the backend environment...
  pushd backend
  python -m venv .venv
  .venv\Scripts\python -m pip install --quiet --upgrade pip
  .venv\Scripts\python -m pip install --quiet -r requirements.txt
  popd
)

if not exist "web\node_modules" (
  echo   Installing web dependencies...
  pushd web
  call npm install
  popd
)

start "FarmFlow API" cmd /k "cd backend && .venv\Scripts\python -m uvicorn app.main:app --reload"
start "FarmFlow Web" cmd /k "cd web && npm run dev"

echo.
echo   API   http://localhost:8000/docs
echo   App   http://localhost:5173
echo   Login farmer / farmflow
echo.
