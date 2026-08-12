@echo off
:: AIRI Tamagotchi - Local Dev Starter
:: Use this to force a specific port to recover settings or models.

set /p PORT_NUM="Enter port (e.g. 5173, 5174, 5175) or press Enter for 5174: "
if "%PORT_NUM%"=="" set PORT_NUM=5174

echo [1/2] Building packages...
set NODE_OPTIONS=--max-old-space-size=8192
call pnpm run build:packages

echo [2/2] Starting Tamagotchi on Port %PORT_NUM%...
set AIRI_RENDERER_PORT=%PORT_NUM%
set AIRI_FORCE_HIGH_PERFORMANCE_GPU=1
set ELECTRON_RUN_AS_NODE=

:: Ensure electron path is configured
call node apps\stage-tamagotchi\scripts\ensure-electron.js

:: Note: This uses the local config shim that is gitignored to force the renderer port.
if exist "apps\stage-tamagotchi\electron.vite.config.local.ts" (
    call pnpm -F @proj-airi/stage-tamagotchi exec electron-vite dev --config electron.vite.config.local.ts
) else (
    call pnpm -F @proj-airi/stage-tamagotchi exec electron-vite dev
)
