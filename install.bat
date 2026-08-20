@echo off
setlocal

echo [1/4] Installing pnpm globally...
call npm install -g pnpm

echo [2/4] Installing project dependencies...
call pnpm install

echo [3/4] Building target packages...
call pnpm run build

echo [Stage-Mate] Checking companion runtime...
call pnpm -F @proj-airi/stage-mate run engine:fetch

echo [4/4] Starting AIRI...
call start_airi.bat

endlocal
