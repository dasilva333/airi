@echo off
setlocal

echo [1/4] Installing pnpm globally...
call npm install -g pnpm

echo [2/4] Installing project dependencies...
call pnpm install

echo [3/4] Building target packages...
call pnpm run build

echo [Stage-Mate] Checking companion runtime...
set "HAS_MATE="
if exist "apps\stage-mate\bin\StageMate.exe" set HAS_MATE=1
if exist "apps\stage-mate\bin\MateEngineX.exe" set HAS_MATE=1
if exist "apps\stage-mate\mate-engine\Build\MateEngineMain\MateEngineX.exe" set HAS_MATE=1
if exist "apps\stage-mate\mate-engine\Build\Windows\StageMate.exe" set HAS_MATE=1
if exist "apps\stage-mate\mate-engine\Build\StageMate\StageMate.exe" set HAS_MATE=1

if not defined HAS_MATE (
    echo [Stage-Mate] Companion runtime not detected. Fetching prebuilt release...
    call pnpm -F @proj-airi/stage-mate run engine:fetch
) else (
    echo [Stage-Mate] Companion runtime already available. Skipping download.
)

echo.
echo ===================================================
echo  Installation complete! You can now launch AIRI:
echo    - Standard: start_airi.bat
echo    - Dual / Dedicated GPU: start_airi_hiperf.bat
echo ===================================================
echo.

endlocal
