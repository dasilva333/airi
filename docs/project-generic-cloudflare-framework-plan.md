# Architectural Spec: The Cloudflare Worker Deployment Subsystem & Generic Cloud Framework

**Status:** Evolutionary Blueprint / Architecture Revision
**Authors:** AIRI Team & AI Assistant
**Replaces & Extends:**
- [`cloud-relay-design.md`](./cloud-relay-design.md) (Pivoted from single-purpose relay to generic Cloudflare edge engine framework)
- [`proposal-web-cors-proxy-bypass.md`](./proposal-web-cors-proxy-bypass.md) (Integrated as Worker Deployment Target #1: CORS Proxy Worker)
- [`cloud-relay-worker.js`](./cloud-relay-worker.js) (Integrated as Worker Deployment Target #2: Always-On Discord Character Relay)
- [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md) (Integrated as Target #3: Cloudflare Edge Key Vault & Onboarding Authenticator)

---

## 1. Executive Summary & Architectural Pivot

The initial `cloud-relay-design.md` conceptualized Cloudflare Workers primarily as a single-purpose, always-on Discord character bot ("Cloud Relay").

However, inspecting real-world implementations (`cloud-relay-worker.js`, `proposal-web-cors-proxy-bypass.md`, and `project-byos-cloud-sync.md`) reveals a broader architectural truth: **AIRI needs a generic, modular Cloudflare Worker Deployment Framework**.

AIRI is not just deploying a Discord bot; it is managing a **suite of user-hosted serverless microservices & key vaults** at the Cloudflare edge. These services run entirely within the user's free Cloudflare account, preserving AIRI's **zero-custody, zero-server-cost** core philosophy.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AIRI Control Plane (Desktop & Web GUI)                   │
│          "Serverless Cloud Infrastructure Management Studio"                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Cloudflare REST API / OAuth Handshake
┌─────────────────────────────────────────────────────────────────────────────┐
│                   User's Private Cloudflare Account Edge                    │
│                                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌───────────┐  │
│  │ 🛡️ CORS Proxy Worker     │  │ 🌐 Cloud Relay Worker    │  │ 🔑 Vault  │  │
│  │ (Bypasses web CORS for   │  │ (Always-on Discord Bot & │  │  Worker   │  │
│  │  Deepgram, Pioneer)      │  │  KV Transactional Log)   │  │  & KV     │  │
│  └──────────────────────────┘  └─────────────┬────────────┘  └─────┬─────┘  │
│                                              │                     │        │
│                                              ▼ Cloudflare KV       ▼        │
│                                  [ airi-relay-<characterId> ] [ airi-vault ]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Generic Cloudflare Deployment Engine (`CloudflareService`)

Instead of hardcoding Cloudflare REST API calls in individual feature components, AIRI establishes a central, reusable service in the main process (`injeca` dependency-injected service or shared store): `@proj-airi/stage-ui/src/services/cloudflare.ts`.

### 2.1 Unified Credential & Wrangler-Style Authorization
AIRI provides two authentication mechanisms:
1. **API Token Entry** (reusing credentials from **BYOS Cloud Sync** `project-byos-cloud-sync.md`):
   - `account_id`: Cloudflare Account ID.
   - `api_token`: Cloudflare API Token with `Workers Scripts:Edit`, `Workers KV Storage:Edit`, and `Worker Routes:Edit` permissions.
2. **Wrangler-Style OAuth Authorization**:
   - Performs a 1-click browser OAuth / token handshake (similar to `wrangler login`) to grant AIRI client-side authorization to deploy workers and manage KV namespaces without manual token configuration.

### 2.2 Standard Worker Deployment Pipeline API
```typescript
interface WorkerDeploymentSpec {
  scriptName: string // e.g. "airi-cors-proxy", "airi-relay-loona", "airi-edge-vault"
  templateScript: string // Raw JS bundle string (e.g. cloud-relay-worker.js)
  bindings: {
    kvNamespaces?: Array<{ binding: string, namespaceId: string }>
    environmentVariables?: Record<string, string>
    secrets?: Record<string, string>
  }
}

class CloudflareDeploymentEngine {
  async ensureKvNamespace(title: string): Promise<string> // Returns namespace ID
  async uploadWorker(spec: WorkerDeploymentSpec): Promise<{ workerUrl: string }>
  async deleteWorker(scriptName: string): Promise<void>
}
```

---

## 3. Worker Deployment Targets

AIRI natively packages and deploys **three distinct edge worker targets** through this framework:

### Target 1: 🛡️ CORS Reverse-Proxy Worker
* **Reference**: [`proposal-web-cors-proxy-bypass.md`](./proposal-web-cors-proxy-bypass.md)
* **Problem**: In `stage-web` (browser-native app), missing CORS response headers from providers (Deepgram, Pioneer, Opencode) block direct XHR/fetch requests.
* **Worker Behavior**: Lightweight worker script (~50 lines) that accepts proxy requests (`https://user-cors-proxy.workers.dev/https://api.pioneer.ai/v1/...`), strips tracking headers, appends permissive CORS headers (`Access-Control-Allow-Origin: *`), and streams the payload back.
* **AIRI Integration**: Automatically deployed to user's Cloudflare account and registered under `Settings > System > Connection > CORS Bypass Proxy`.

### Target 2: 🌐 Always-On Character Relay Worker
* **References**: [`cloud-relay-design.md`](./cloud-relay-design.md) & [`cloud-relay-worker.js`](./cloud-relay-worker.js)
* **Problem**: Local desktop machine is powered off, leaving mobile users disconnected from their characters.
* **Worker Behavior**: Full 5,700-line production worker template. Evaluates Discord Ed25519 signatures (<5ms), issues Type 5 deferred responses, logs turns to transactional KV keys (`history_turn_*`), compacts every 10 turns into immutable archives (`history_archive_*`), and runs long-term memory summarization every 20 turns (`memory_summary_*`).
* **AIRI Integration**: Managed via **Tab 2 (Cloud Relay Studio)** under `Settings > Discord`.

### Target 3: 🔑 Edge Key Vault & Onboarding Authenticator
* **Reference**: [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md)
* **Problem**: Google Drive AppData sync requires managing OAuth App verification, client IDs, and scaring users with "Unverified App" screens. Manually entering S3/R2 keys on every new device installation creates huge onboarding friction.
* **Worker & KV Behavior**: Deploys a dedicated `airi-edge-vault` KV namespace to the user's Cloudflare account. Stores client-side encrypted S3/R2 storage keys, active character presets, and system preferences.
* **AIRI Integration (Cross-Device Restore)**:
  - On a fresh installation of AIRI or opening `stage-web` on a new computer, the user clicks **"Connect with Cloudflare"**.
  - AIRI authenticates, queries `airi-edge-vault`, retrieves the encrypted S3/R2 storage credentials, connects to the user's cloud storage, and **instantly restores all character cards, memories, voices, and settings** without any third-party app verification process!

---

## 4. Architectural Revisions to Original `cloud-relay-design.md`

Based on inspecting the production `cloud-relay-worker.js` code, the following architectural adjustments are codified:

1. **Transactional KV Write-Ahead Log over Direct Overwrites**:
   - *Original Assumption*: Worker overwrites a single JSON string in KV per chat.
   - *Revised Reality*: `cloud-relay-worker.js` writes each turn to an independent KV key (`history_turn_<userId>_<interactionId>`) and compacts every 10 turns into immutable archive keys. This prevents KV read/write race conditions during concurrent user interactions.
2. **Unified Credential & ACL Environment Injection**:
   - The worker deployment pipeline serializes the character's system prompt, `OWNER_USER_ID`, and Channel ACL rules directly into Worker environment variables during deploy time, guaranteeing that **cloud worker deployments enforce the exact same channel isolation rules as the desktop application**.
3. **Bidirectional Memory Synchronization**:
   - `[Sync Memories ↓]` pulls KV archives (`history_archive_*`) and memory summaries (`memory_summary_*`) directly into AIRI's local `short-term-memory` and `text-journal` Pinia stores, enabling seamless continuity when returning to the PC.

---

## 5. UI Integration Map (`Settings > Discord` & `Settings > System` & Onboarding)

```
AIRI UI Surfaces
├── Onboarding Screen (New Machine Setup)
│   └── 🔑 "Connect with Cloudflare" (Target 3 Edge Key Vault Auto-Restore)
│
├── System > Connection
│   └── 🛡️ CORS Proxy Worker Deployer (Target 1)
│       ├── [Deploy CORS Worker to Cloudflare] Button
│       └── Custom CORS Proxy Worker URL Input
│
└── Discord Integration & Cloud Control Plane (Unified 3-Tab Interface)
    ├── Tab 1: 🔌 Bot Connection (Local Bot Credentials & Tokens)
    ├── Tab 2: 🌐 Cloud Relay Studio (Target 2 Deployment, Worker Logs, Memory Sync ↓)
    └── Tab 3: 🔐 Access & Routing (Channel Mapping, DM Isolation, ACL Matrix)
```

---

## 6. Summary of Benefits

1. **Modular Edge Framework**: Decouples Cloudflare REST API management into a generic, reusable service for any future edge worker requirement.
2. **Zero Third-Party Verification**: Replaces complex Google AppData verification with zero-custody Cloudflare key vaults.
3. **Seamless Cloud/Desktop Parity**: Users can author locally, deploy to the edge in one click, and sync character memories back down when they get home!
