# Gateway Security Hardening & Accountability

This document outlines the security architecture improvements and accountability measures introduced for the AIRI Gateway.

## Context
The AIRI Gateway handles bidirectional WebSockets between standard plugins, VS Code plugins, Python servers, and the local frontend client.
Previously, its open authentication and lack of identity tracking posed risks such as unauthorized RCE, data theft, and loss of traceability.

The Gateway now prioritizes **Security by Default** and **Accountability** for all connections.

## Architectural Changes

### 1. Hardened Connectivity
- **Host Binding:** `ServerOptions.hostname` now defaults to `127.0.0.1` instead of `0.0.0.0`, preventing external network actors from reaching the local Gateway.
- **Zero-Trust Initialization:** If no `AUTHENTICATION_TOKEN` is provided via environment variables or options, `server-runtime` automatically generates a secure **App Key** (via `nanoid`). This ensures the system is never running with an empty token by default.

### 2. Handshake Accountability (Traceability)
Every WebSocket client in the AIRI ecosystem must now identify itself during the initial `module:authenticate` handshake.
- **Caller ID:** A unique string identifying the connecting application (e.g., `stage-web`, `vscode-airi`, `python-agent-01`).
- **Purpose:** A brief description of the connection's intent (e.g., "Primary UI control", "Log monitoring", "Model inference").

These fields are stored in the `AuthenticatedPeer` metadata and logged in the Gateway console, providing a clear audit trail of all active connections and their origins.

### 3. Graceful Failure & Backoff
To prevent "hot loops" when an outdated or misconfigured client tries to connect:
- **Client Sleep:** The `@proj-airi/server-sdk` implements a 5-second backoff when receiving an authentication error.
- **Runtime Interception:** `server-runtime` kills connections immediately if they fail authentication, preventing they from sending or receiving any system events.

## User Interface & Configuration

### Finding your App Key
When running the Gateway, the automatically generated App Key is logged prominently in the console:
```text
[warn] No authentication token provided. A secure App Key has been automatically generated.
>>> APP KEY: xxxxxxxxxxxxxxxxxxxxxxxx <<<
```

### Configuring Clients
In the **Stage UI (Web/Desktop)**:
1. Go to **Settings** -> **System** -> **Connection**.
2. Enter the **App Key** provided by your Gateway logs.
3. The UI will then identify itself as `stage-web` or `stage-tamagotchi` with its standard purpose.

## Security Justification (Threat Model)
| Threat | Mitigation |
| :--- | :--- |
| **Local RCE Hijacking** | Host binding to `127.0.0.1` limits attack surface to only local processes. |
| **Anonymous Command Injection** | Mandatory `caller`/`purpose` metadata ensures every command has an owner and intent recorded. |
| **Brute Force Connection** | Randomly generated `nanoid` keys and client-side backoff delay make automated attacks impractical. |
| **Post-compromise Forensics** | Persistent logging of `caller` identity allows administrators to identify which component was compromised. |

## Relevant Skills

- [[airi-gateway-websocket-protocol]]
