---
name: airi-gateway-websocket-protocol
description: >-
  Use when working with the AIRI local WebSocket Gateway & channel server: main-process channel server in apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts, WebSocket port 6121 / SERVER_CHANNEL_PORT, cryptographic authToken handshake, localhost (127.0.0.1) loopback vs LAN (0.0.0.0) binding, mkcert TLS certificate generation, server-channel/config.json persistence, eventa IPC contracts electronGetServerChannelConfig/electronApplyServerChannelConfig, client pairing with stage-pocket mobile companion apps and external tools.
---

# AIRI Gateway & WebSocket Protocol

## Key Files/Locations

- `apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts` — Electron **main-process** service: manages the channel server runtime on port `6121` (overridable via `env.SERVER_CHANNEL_PORT`), cryptographic `authToken` handshake, auto-healing config store `server-channel/config.json`, mkcert local CA/TLS cert generation (`certHasAllDomains`), and LAN IP discovery (`getLocalIPs()`).
- `apps/stage-tamagotchi/src/shared/eventa.ts` — Typed eventa IPC contracts: `electronGetServerChannelConfig`, `electronApplyServerChannelConfig`; payload schemas for `hostname`, `authToken`, and `tlsConfig`.
- `packages/server-runtime/src/server/index.ts` — Core WebSocket server implementation and protocol dispatch.
- `docs/arch-gateway-security-hardening.md` — Authoritative security design document: WebSocket token handshake, origin header validation, LAN attack mitigations.
- `docs/content/en/docs/manual/config/gateway.md` — User manual page for configuring the gateway, locating tokens in UI/filesystem, and pairing external clients.

## When to Use

- Extending or debugging the WebSocket Gateway connection between the desktop application and external companion clients (e.g. Android/iOS `stage-pocket`, VS Code extensions, or custom Python agents).
- Modifying gateway security, auth token verification, token regeneration, or hostname binding (`127.0.0.1` vs `0.0.0.0`).
- Troubleshooting TLS certificate creation, SAN domain updates, or connection dropouts over local WiFi.
- Wiring frontend settings UI in `packages/stage-pages/src/pages/settings/` to `electronGetServerChannelConfig` and `electronApplyServerChannelConfig`.

## Architecture & Security Contracts

```
[ External Client (Pocket / VS Code) ]
                 │
                 ▼  ws://[IP]:6121 (or wss://)
[ Channel Server (Electron Main Process) ]
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Auth Token Check ]   [ Origin Validation ]
        │ (Passed)
        ▼
[ RPC & Audio Streaming Bridge ] ──► [ Renderer Event Bus ]
```

1. **Port & Binding**: Default port is `6121` (`SERVER_CHANNEL_PORT`). Binds to `127.0.0.1` by default to prevent unauthorized network exposure. Must be set to `0.0.0.0` to permit LAN mobile connections.
2. **Mandatory Auth Handshake**: All clients must supply the `authToken` (stored in `server-channel/config.json`). Unauthenticated sockets are terminated before receiving state.
3. **Auto-Healing Persistence**: Uses `createConfig('server-channel', 'config.json', ...)` with `autoHeal: true`. If the config is missing or invalid, a new UUID token is automatically generated.
4. **TLS Support**: Automatically manages local CA and TLS certificates using `mkcert` with Subject Alternative Names (SANs) covering `localhost`, `127.0.0.1`, `::1`, and all detected local network IPs.

## Common Pitfalls

- **Main Process Isolation**: The WebSocket server runs strictly in the Electron main process. Never attempt to bind network sockets directly inside renderer components.
- **Port Collisions**: If port 6121 is occupied by a lingering instance, check `SERVER_CHANNEL_PORT` or kill orphan processes before restarting.
- **LAN Access vs Loopback**: If mobile pocket clients cannot connect, verify that `hostname` is explicitly set to `0.0.0.0` and that the desktop OS firewall permits incoming traffic on port 6121.
- **Token Invalidation**: When regenerating the token via `electronApplyServerChannelConfig`, active external connections will be closed and must re-authenticate with the new token.

## Verification

- Run typecheck: `pnpm -F stage-tamagotchi typecheck`.
- Build verification: `pnpm -F stage-tamagotchi build`.
- Manual test: Open Settings &rarr; Connection, change hostname to `0.0.0.0`, save, and verify that `config.json` updates and the server restarts without error.

## Related Skills & References

- **Key Documents**: [[arch-gateway-security-hardening]], [[gateway]]
