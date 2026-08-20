@echo off
:: AIRI Tamagotchi - Unpacked Production Starter
:: Builds, copies production dependencies, unpacks the application, and runs the executable directly.

echo [1/4] Building packages...
call pnpm run build:packages

echo [2/4] Building Tamagotchi production assets...
call pnpm -F @proj-airi/stage-tamagotchi run build

echo [3/4] Copying external production dependencies...
call pnpm -F @proj-airi/stage-tamagotchi exec tsx scripts/copy-deps.ts

echo [4/4] Packaging unpacked application...
call pnpm -F @proj-airi/stage-tamagotchi exec electron-builder --win --dir

echo Starting unpacked production application...
set ELECTRON_RUN_AS_NODE=
start "" "apps\stage-tamagotchi\dist\win-unpacked\airi.exe"
