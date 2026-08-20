@echo off
:: AIRI Tamagotchi - Local Dev Starter (Skip Downloads)
:: Use this for a simple, one-click startup without downloading assets.

set SKIP_DOWNLOADS=1

:: Default to 5173. If your settings/model vanished after an update, 
:: try entering 5174 to recover your local storage from previous versions.
set /p PORT_NUM="Enter port (default 5173): "
if "%PORT_NUM%"=="" set PORT_NUM=5173

echo [1/2] Building packages...
call pnpm run build:packages

echo [2/2] Starting Tamagotchi on Port %PORT_NUM% (SKIP_DOWNLOADS=1)...
set AIRI_RENDERER_PORT=%PORT_NUM%
set ELECTRON_RUN_AS_NODE=


:: Try to use local config if it exists, otherwise use default
if exist "apps\stage-tamagotchi\electron.vite.config.local.ts" (
    call pnpm -F @proj-airi/stage-tamagotchi run dev --config electron.vite.config.local.ts
) else (
    call pnpm -F @proj-airi/stage-tamagotchi run dev
)
