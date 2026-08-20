# Upstream Sync Report: alpha.22 → latest

## 📊 Summary Overview
- **Baseline**: `279b4db1` (alpha.22)
- **Target Head**: `b85808c0`
- **Total Files Changed**: 767
- **Total Insertions**: +52860
- **Total Deletions**: -48342

## 📈 High-Impact Directories
| Directory | Files | Insertions | Deletions | Total Delta |
| :--- | :--- | :--- | :--- | :--- |
| `apps/` | 235 | 33409 | 2407 | 35816 |
| `crates/` | 71 | 0 | 33426 | 33426 |
| `packages/` | 342 | 13891 | 2528 | 16419 |
| `Cargo.lock/` | 1 | 0 | 6924 | 6924 |
| `pnpm-lock.yaml/` | 1 | 2256 | 1679 | 3935 |
| `services/` | 28 | 2683 | 1035 | 3718 |
| `.github/` | 17 | 289 | 157 | 446 |
| `docs/` | 48 | 222 | 49 | 271 |
| `bump.config.ts/` | 1 | 28 | 30 | 58 |
| `Cargo.toml/` | 1 | 0 | 40 | 40 |

## 📄 Specific File Impact (Top 50)
| File | Insertions | Deletions | Total |
| :--- | :--- | :--- | :--- |
| `Cargo.lock` | 0 | 6924 | 6924 |
| `crates/tauri-plugin-ipc-audio-transcription-ort/Cargo.lock` | 0 | 4732 | 4732 |
| `crates/tauri-plugin-ipc-audio-vad-ort/Cargo.lock` | 0 | 4732 | 4732 |
| `crates/tauri-plugin-mcp/Cargo.lock` | 0 | 4732 | 4732 |
| `crates/tauri-plugin-rdev/Cargo.lock` | 0 | 4732 | 4732 |
| `crates/tauri-plugin-window-pass-through-on-hover/Cargo.lock` | 0 | 4732 | 4732 |
| `crates/tauri-plugin-window-router-link/Cargo.lock` | 0 | 4732 | 4732 |
| `pnpm-lock.yaml` | 2256 | 1679 | 3935 |
| `apps/server/drizzle/meta/0008_snapshot.json` | 2864 | 0 | 2864 |
| `apps/server/drizzle/meta/0005_snapshot.json` | 2334 | 0 | 2334 |
| `apps/server/drizzle/meta/0006_snapshot.json` | 2270 | 0 | 2270 |
| `apps/server/drizzle/meta/0007_snapshot.json` | 2270 | 0 | 2270 |
| `apps/server/drizzle/meta/0004_snapshot.json` | 2200 | 0 | 2200 |
| `apps/server/drizzle/meta/0003_snapshot.json` | 2130 | 0 | 2130 |
| `apps/server/drizzle/meta/0002_snapshot.json` | 2041 | 0 | 2041 |
| `apps/server/otel/grafana/dashboards/airi-server-overview-cloud.json` | 1489 | 431 | 1920 |
| `apps/server/drizzle/meta/0001_snapshot.json` | 1563 | 0 | 1563 |
| `services/minecraft/src/cognitive/conscious/js-planner.ts` | 928 | 276 | 1204 |
| `crates/tauri-plugin-ipc-audio-transcription-ort/src/models/whisper/whisper.rs` | 0 | 561 | 561 |
| `packages/stage-ui-three/src/composables/vrm/outline.ts` | 520 | 0 | 520 |
| `apps/server/src/routes/stripe/route.test.ts` | 504 | 0 | 504 |
| `apps/server/otel/grafana/dashboards/airi-server-overview.json` | 0 | 503 | 503 |
| `apps/server/src/routes/openai/v1/index.ts` | 471 | 0 | 471 |
| `apps/server/src/services/tests/stripe.test.ts` | 468 | 0 | 468 |
| `packages/i18n/src/locales/es/settings.yaml` | 275 | 189 | 464 |
| `apps/server/src/routes/openai/v1/route.test.ts` | 439 | 0 | 439 |
| `apps/server/src/services/billing/billing-service.ts` | 438 | 0 | 438 |
| `apps/stage-tamagotchi/src/renderer/stores/chat-sync.ts` | 424 | 0 | 424 |
| `packages/stage-ui-live2d/src/stores/expression-store.ts` | 422 | 0 | 422 |
| `apps/server/src/services/chats.ts` | 299 | 121 | 420 |
| `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` | 247 | 151 | 398 |
| `apps/server/src/libs/auth.ts` | 382 | 11 | 393 |
| `apps/server/src/routes/stripe/index.ts` | 379 | 0 | 379 |
| `packages/stage-ui/src/libs/providers/providers/azure-openai/index.ts` | 373 | 0 | 373 |
| `crates/tauri-plugin-mcp/permissions/schemas/schema.json` | 0 | 354 | 354 |
| `crates/tauri-plugin-window-pass-through-on-hover/permissions/schemas/schema.json` | 0 | 354 | 354 |
| `crates/tauri-plugin-ipc-audio-transcription-ort/permissions/schemas/schema.json` | 0 | 342 | 342 |
| `packages/server-runtime/src/index.ts` | 337 | 5 | 342 |
| `services/minecraft/src/cognitive/conscious/brain.ts` | 42 | 297 | 339 |
| `crates/tauri-plugin-ipc-audio-vad-ort/permissions/schemas/schema.json` | 0 | 330 | 330 |
| `apps/server/src/app.ts` | 276 | 49 | 325 |
| `crates/tauri-plugin-window-router-link/permissions/schemas/schema.json` | 0 | 318 | 318 |
| `packages/stage-pages/src/pages/settings/flux.vue` | 305 | 0 | 305 |
| `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue` | 175 | 130 | 305 |
| `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.vue` | 293 | 0 | 293 |
| `services/minecraft/src/cognitive/conscious/js-planner-worker.ts` | 291 | 0 | 291 |
| `packages/stage-ui-live2d/src/composables/live2d/expression-controller.ts` | 282 | 0 | 282 |
| `apps/server/src/libs/otel.ts` | 225 | 53 | 278 |
| `apps/server/docs/ai-context/transport-and-routes.md` | 267 | 0 | 267 |
| `packages/stage-ui/src/tools/character/orchestrator/spark-command.test.ts` | 257 | 0 | 257 |

## Relevant Skills

- [[airi-roadmap-upstream-research]]
