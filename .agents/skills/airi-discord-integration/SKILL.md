---
name: airi-discord-integration
description: >-
  Use when working with the AIRI Discord bot integration and multi-modal routing: Electron main-process gateway service in apps/stage-tamagotchi/src/main/services/airi/discord/index.ts, renderer orchestration store packages/stage-ui/src/stores/modules/discord.ts (slash-command COMMANDS_VERSION, visionEnabled toggle, sendImageToDiscord native IPC bypass), slash-command registration and sync, image attachment to vision/VLM routing via chatOrchestrator.ingest as base64 data-URL, tool-availability fallthrough where tools flow through chat store performSend and are stripped only on VLM turns, discordServiceRegisterCommands/SendMessage/ReplyInteraction/GetStatus IPC contracts, voice channel audio, docs/feat-discord-revamp.md and docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md.
---

# AIRI Discord Integration

## Key Files/Locations

- `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts` — Electron **main-process** gateway service: owns the `discord.js` `Client` (`GatewayIntentBits`, `Partials`), `@discordjs/voice` voice connections, and IPC-exposed operations (`discordServiceRegisterCommands`, `discordServiceSendMessage`, `discordServiceReplyInteraction`, `discordServiceSendTyping`, `discordServiceGetStatus`, `discordServiceLeave`, `discordService*` cloud-relay ops).
- `packages/stage-ui/src/stores/modules/discord.ts` — renderer orchestration store: slash-command registration gated by `COMMANDS_VERSION` (currently **11**; bump to force re-registration, `lastRegisteredVersion` skips re-register below it), `visionEnabled` (`settings/discord/visionEnabled`, default `true`), `sendImageToDiscord` (native IPC bypass via `toRaw({ channelId, base64, content, filename })`), message → `chatOrchestrator.ingest` routing, `/vision` command toggling VLM processing.
- `packages/stage-ui/src/stores/chat.ts` — `performSend(sendingMessage, options, generation, sessionId)`: chat pipeline Discord messages flow through; tools fall through to `toolsResolver.value` (e.g. `builtinTools`) and are stripped only on VLM turns (`chat.ts` ~line 1127 evaluation).
- `docs/feat-discord-revamp.md` — current revamp spec.
- `docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md` — original design (slash-command list, guild vs global registration latency note).

## When to Use

- Adding/modifying slash commands, or forcing command re-registration (bump `COMMANDS_VERSION`).
- Working on image attachment → VLM/vision routing, base64 payload handling, or the `sendImageToDiscord` native bypass.
- Wiring Discord events into the chat pipeline (`chatOrchestrator.ingest`) or changing tool availability for Discord sources.
- Voice-channel audio join/capture and cloud-relay/OAuth features.

## Common Pitfalls

- **Main vs renderer.** The Discord gateway client runs ONLY in the Electron main process; the renderer store talks to it over IPC (`discordService*` eventa contracts). Never import `discord.js` into renderer code.
- **Vision routing.** Image attachments are matched against `data:([^;]+);base64,...` and ingested via `chatOrchestrator.ingest` as base64 data-URLs ONLY when `visionEnabled` is on; VLM provider/model come from `useVisionStore` (`activeProvider`/`activeModel`), and the `/vision` slash command toggles it. Stripping tools on VLM turns applies to ALL sources, not just Discord.
- **Tools fallthrough.** Tools are NOT passed explicitly by the Discord store — `performSend` falls back to `toolsResolver.value` (set to `builtinTools` in the page), so all built-in tools (journal, widgets, stickers, MCP, dating sim) work from Discord automatically. Don't add special-casing unless stripping for a VLM turn.
- **Command registration caching.** Slash commands re-register only when `COMMANDS_VERSION` is bumped above `lastRegisteredVersion`; global commands can take up to an hour to propagate — register per-guild during development.
- **Large payloads.** `sendImageToDiscord` bypasses generic IPC serialization with a native channel and `toRaw`; keep payload shape `{ channelId, base64, content?, filename? }` and log size in KB, not raw base64.


### Authoritative Design & Architecture Documents

- [docs/feat-discord-revamp.md](docs/feat-discord-revamp.md) — Current Discord revamp spec.
- [docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md](docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md) — Original Discord bot integration design.
- [docs/design-discord-context-routing.md](docs/design-discord-context-routing.md) — Discord context routing design.
- [docs/design-discord-control-plane.md](docs/design-discord-control-plane.md) — Discord control plane design.
- [docs/content/en/docs/manual/config/discord-commands.md](docs/content/en/docs/manual/config/discord-commands.md) — Discord commands manual.
- [docs/content/en/docs/contributing/services/discord.md](docs/content/en/docs/contributing/services/discord.md) — Contributing guide for Discord service.
- [docs/content/en/docs/showcase/10-discord-integration.md](docs/content/en/docs/showcase/10-discord-integration.md) — Discord integration showcase.
- [docs/cloud-relay-design.md](docs/cloud-relay-design.md) — Cloud relay architecture (Discord Edge deployment).
- [docs/project-telegram-design.md](docs/project-telegram-design.md) — Telegram project design.
- [docs/content/en/docs/contributing/services/telegram.md](docs/content/en/docs/contributing/services/telegram.md) — Contributing guide for Telegram service.
- [docs/content/en/docs/contributing/services/satori.md](docs/content/en/docs/contributing/services/satori.md) — Contributing guide for Satori protocol.
- [docs/proposal-twitch-plugin.md](docs/proposal-twitch-plugin.md) — Twitch plugin proposal.
- [docs/proposal-destiny2-plugin.md](docs/proposal-destiny2-plugin.md) — Destiny 2 plugin proposal.

## Verification

- Typecheck: `pnpm -F @proj-airi/stage-ui typecheck` for the store; `pnpm -F stage-tamagotchi build` (includes typecheck) when touching the main-process service.
- Manual: connect the bot, run a slash command, send a text message (confirm tool calls execute), send an image with vision on (confirm VLM turn, tools stripped) and off (confirm text-only path), and confirm `COMMANDS_VERSION` bump triggers re-registration.
