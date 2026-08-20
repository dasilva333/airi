@echo off
:: AIRI Tamagotchi - Local Dev Starter
:: Use this for a simple, one-click startup.

:: Default to 5173. If your settings/model vanished after an update, 
:: try entering 5174 to recover your local storage from previous versions.
set /p PORT_NUM="Enter port (default 5173): "
if "%PORT_NUM%"=="" set PORT_NUM=5173

:: Ensure Stage-Mate companion runtime is available
if not exist "apps\stage-mate\bin\StageMate.exe" if not exist "apps\stage-mate\mate-engine\Build\StageMate.exe" (
    echo [Stage-Mate] Prebuilt companion runtime not detected. Fetching runtime...
    call pnpm -F @proj-airi/stage-mate run engine:fetch
)

echo [1/2] Building packages...
call pnpm run build:packages

echo [2/2] Starting Tamagotchi on Port %PORT_NUM%...
set AIRI_RENDERER_PORT=%PORT_NUM%

:: Try to use local config if it exists, otherwise use default
if exist "apps\stage-tamagotchi\electron.vite.config.local.ts" (
    call pnpm -F @proj-airi/stage-tamagotchi run dev --config electron.vite.config.local.ts
) else (
    call pnpm -F @proj-airi/stage-tamagotchi run dev
)
