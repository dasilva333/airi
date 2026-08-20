# Architectural Spec: The Cloudflare Worker Deployment Subsystem & Generic Cloud Framework

**Status:** Canonical Reference & Implementation Record (Active in Production)
**Authors:** AIRI Team & AI Assistant
**Replaces & Extends:**
- [`cloud-relay-design.md`](./cloud-relay-design.md) (Pivoted from single-purpose relay to generic Cloudflare edge engine framework)
- [`proposal-web-cors-proxy-bypass.md`](./proposal-web-cors-proxy-bypass.md) (Integrated as Worker Deployment Target #1: CORS Proxy Worker)
- [`cloud-relay-worker.js`](./cloud-relay-worker.js) (Integrated as Worker Deployment Target #2: Always-On Discord Character Relay)
- [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md) (Integrated as Target #3: Cloudflare Edge Key Vault & Onboarding Authenticator)

---

## 1. Executive Summary & Architectural Reality

AIRI manages a **suite of user-hosted serverless edge microservices, CORS proxies, and key vaults** on the user's private Cloudflare account (`*.workers.dev`). These services run entirely within Cloudflare's free tier, preserving AIRI's **zero-custody, zero-server-cost** core philosophy.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AIRI Control Plane (Desktop, Web & Mobile)               │
│          "Serverless Cloud Infrastructure Management Studio"                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Cloudflare REST API / OAuth PKCE Handshake
┌─────────────────────────────────────────────────────────────────────────────┐
│                   User's Private Cloudflare Account Edge                    │
│                                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌───────────┐  │
│  │ 🛡️ CORS Proxy Worker     │  │ 🌐 Cloud Relay Worker    │  │ 🔑 Vault  │  │
│  │ (Bypasses web CORS for   │  │ (Always-on Discord Bot & │  │  Namespace│  │
│  │  REST & KV in stage-web) │  │  KV Transactional Log)   │  │  & KV     │  │
│  │  /cors-proxy?url=...     │  │  /discord & /health      │  │           │  │
│  └──────────────────────────┘  └─────────────┬────────────┘  └─────┬─────┘  │
│                                              │                     │        │
│                                              ▼ Cloudflare KV       ▼        │
│                                  [ airi-kv-<characterId> ]  [ airi-edge-    │
│                                                                 vault ]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Service Architecture & State Management

### 2.1 Unified Store: `useCloudflareStore`
Location: [`packages/stage-ui/src/stores/modules/cloudflare.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/cloudflare.ts)

The central Pinia store encapsulates all Cloudflare credentials, OAuth tokens, subdomain states, and edge actions:
- **`cfOAuthTokens`**: Persisted in `settings/cloudflare/cfOAuthTokens` (`{ accessToken, refreshToken, expiresIn, accountId }`).
- **`cfAccountId`**: Resolved account ID (`settings/cloudflare/cfAccountId`).
- **`cfSubdomain`**: User's registered workers subdomain (`settings/cloudflare/cfSubdomain`, e.g. `<subdomain>`).
- **Automatic Migration**: Reads and elevates legacy `settings/discord/cf*` keys with zero data loss.

### 2.2 Cross-Platform Execution Matrix

| Platform | OAuth PKCE Flow | KV Storage Operations | Worker Deployments |
| :--- | :--- | :--- | :--- |
| **Electron Desktop** (`stage-tamagotchi`) | Local loopback server (`http://localhost:8976/oauth/callback`) + system browser | Main process Eventa IPC $\rightarrow$ `CloudflareStageDeployer` | Full multi-part Worker bundle compilation & deployment |
| **Web Browser SPA** (`stage-web`) | Browser popup + WebCrypto PKCE (`S256`) + `window.postMessage` | Proxied REST `fetch()` through `https://<subdomain>.workers.dev/cors-proxy` | Delegated to Desktop or CLI |
| **Mobile App** (`stage-pocket` iOS/Android) | System Auth Session (`ASWebAuthenticationSession`) | Direct native REST `fetch()` to `api.cloudflare.com` (no CORS restrictions) | Delegated to Desktop or CLI |

---

## 3. Worker Deployment Targets & KV Namespaces

### Target 1: 🛡️ Web CORS Reverse-Proxy Worker (`airi-cors-proxy`)
- **Worker Script**: `airi-cors-proxy` deployed to `https://airi-cors-proxy.<subdomain>.workers.dev`
- **Purpose**: Eliminates browser CORS blocks on `stage-web` when interacting with Cloudflare REST APIs, KV storage, or third-party AI endpoints.
- **Route Handlers**:
  - `GET /health` $\rightarrow$ `{ "status": "ok", "worker": "@proj-airi/stage-edge" }`
  - `OPTIONS /cors-proxy` $\rightarrow$ HTTP 204 with permissive preflight headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: *`, `Access-Control-Allow-Headers: *`, `Access-Control-Max-Age: 86400`).
  - `GET/POST/PUT/DELETE /cors-proxy?url=<target_url>` $\rightarrow$ Strips browser host/origin headers, forwards payload to upstream, and injects permissive CORS response headers.

### Target 2: 🌐 Always-On Character Relay Worker (`airi-kv-<characterId>`)
- **Worker Script**: `airi-<characterId>` (e.g. `airi-moriv`, `airi-baseline-test`)
- **Purpose**: Runs 24/7 serverless companion interactions on Discord with zero local machine dependencies.
- **Route Handlers**:
  - `POST /discord` $\rightarrow$ Validates Discord Ed25519 signatures, evaluates slash commands, performs LLM streaming inference, and writes dialogue turns to KV.
- **KV Namespace**: `airi-kv-<characterId>`
  - Key `context/rolling`: Array of recent dialogue turns (50 items rolling history).
  - Key `system/prompt`: Immutable system persona instructions.
  - Key `ping`: Health verification (`pong`).

### Target 3: 🔑 Cloudflare Edge Key Vault (`airi-edge-vault`)
- **KV Namespace**: `airi-edge-vault`
- **Purpose**: Provides 1-click cloud sync restoration across devices without manual S3/R2 key entry.
- **Stored Keys**:
  - Key `vault/credentials`:
    ```json
    {
      "s3Endpoint": "https://<account_id>.r2.cloudflarestorage.com",
      "s3Bucket": "airi-sync",
      "s3Region": "auto",
      "s3AccessKeyId": "...",
      "s3SecretAccessKey": "...",
      "activeProvider": "s3",
      "savedAt": 1700000000000
    }
    ```
- **Cross-Device Flow**: When signing in with Cloudflare on a new device (`stage-web` or `stage-pocket`), the app queries `airi-edge-vault` and immediately auto-populates `useSyncEngineStore`, activating companion selective sync instantly.

---

## 4. Two-Stage Onboarding Flow & UI Surfaces

```
[ Step 2: Sign In with Cloudflare ]
  • OAuth PKCE 1-click authorization
  • Proof of zero-trust connection
  • Auto-fetches R2 credentials from Edge Vault if returning user
                       │
                       ▼
[ Step 3: Cloud Infrastructure & Edge Services ] (step-cloud-infrastructure.vue)
  • Workers Edge Subdomain (*.workers.dev display, claim, or active status)
  • Edge Service Modules:
      ☑ Web CORS Reverse-Proxy Worker (Auto-deploys airi-cors-proxy)
      ☑ Always-On Discord Cloud Relay (Pre-configures worker triggers)
      ☑ Save Credentials to Edge Key Vault (Encrypts R2 keys to airi-edge-vault)
  • Remote Storage Inspection (Live R2 catalog scan: cards, models, animations count)
                       │
                       ▼
[ Step 4: Companion Cloud Restore ] (step-cloud-restore.vue)
  • Embeds selective-sync-panel.vue
  • Granular model, animation, background, and memory selection
  • Restores companion assets directly into local IndexedDB
                       │
                       ▼
[ Step 5+: Hearing, Consciousness, Calibration ]
```

---

## 5. Developer Tooling & CLI Utilities

### 5.1 KV Inspector with Auto-Refresh
Location: [`apps/stage-edge/scripts/inspect-kv.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-edge/scripts/inspect-kv.ts)

Command:
```bash
npx tsx apps/stage-edge/scripts/inspect-kv.ts
```

- Discovers all active `airi-*` KV namespaces (`airi-kv-*`, `airi-edge-vault`).
- Automatically intercepts expired OAuth tokens (HTTP 401/403) and uses `CLOUDFLARE_REFRESH_TOKEN` to refresh credentials and update `.env` without manual steps.
- Dumps sanitized local snapshots to `kv-dump.json` (protected by `.gitignore`).

---

## 6. Security & Release Principles

1. **Zero Hardcoded Secrets**: All OAuth access tokens, refresh tokens, and R2 credentials reside exclusively in user-owned local storage, Electron secure memory, or the user's private Cloudflare KV vault.
2. **Subdomain Immutability**: The deployment engine preserves pre-existing user subdomains (e.g. `<subdomain>`) and never overwrites account-level names.
3. **Strict Git Tracking Safeguards**: All dump files (`*.dump.json`, `kv-dump.json`) and environment configs (`.env`) are permanently ignored in repository `.gitignore`.

---

## 7. Architectural Lessons Learned & Gotchas

### 7.1 OAuth PKCE Token Response Does NOT Include `account_id`
* **Gotcha**: Cloudflare's OAuth 2.0 token endpoint (`https://dash.cloudflare.com/oauth2/token`) returns strictly `{ access_token, refresh_token, expires_in, scope }`. It **never** returns `account_id` in the token response payload.
* **Rule**: As soon as `access_token` is received, the client must immediately dispatch a `GET https://api.cloudflare.com/client/v4/accounts` query with the `Bearer` token to resolve and persist `accountId` (`accounts[0].id`). Skipping this step causes subsequent subdomain (`/workers/subdomain`) and KV REST calls to fail silently.

### 7.2 Wrangler Client ID Enforces Localhost Callback
* **Gotcha**: The public Wrangler OAuth Client ID (`54d11594-84e4-41aa-b438-e81b8fa78ee7`) has strictly pre-registered redirect URIs (`http://localhost:8976/oauth/callback`). Attempting to use custom browser origins (e.g. `http://localhost:5173/oauth/callback`) triggers an immediate `invalid_request: redirect_uri does not match` rejection from Cloudflare.
* **Rule**: All OAuth PKCE handshakes must send `redirect_uri=http://localhost:8976/oauth/callback`. In `stage-web`, the Vite dev server spins up `cloudflareOAuthBridgePlugin` on port `8976` to receive the authorization code and post it back to `window.opener`.

### 7.3 Web Browser CORS Constraints on Token & API Endpoints
* **Gotcha**: Cloudflare's `dash.cloudflare.com/oauth2/token` and `api.cloudflare.com` endpoints do not return `Access-Control-Allow-Origin` headers for arbitrary browser web origins. Direct browser `fetch()` calls will be blocked by CORS.
* **Rule**:
  - In local web development (`stage-web`), route requests through Vite proxies (`/api/cf-oauth-token`, `/api/cloudflare`).
  - In production web deployments, route requests through the user's deployed `airi-cors-proxy` worker (`https://airi-cors-proxy.<subdomain>.workers.dev/cors-proxy?url=...`).
  - In mobile apps (`stage-pocket`), use native Capacitor HTTP (`@capacitor/http`) which executes outside the browser sandbox and is unaffected by CORS.

### 7.4 Composite State Reactivity with `useLocalStorage`
* **Gotcha**: Storing navigation objects (e.g. `{ stepId, path }`) in VueUse's `useLocalStorage` without `{ deep: true }` prevents property mutations (`v2State.value.stepId = ...`) from triggering computed watchers across step components.
* **Rule**: Always configure `{ deep: true }` and reassign objects (`v2State.value = { ...v2State.value, stepId }`) when controlling wizard navigation state.

---

## 8. Implementation Status & Platform Readiness Matrix

### 8.1 Component & Feature Checklist

| System Component | Status | Verification Detail |
| :--- | :--- | :--- |
| **Worker Target 1 (`airi-cors-proxy`)** | ✅ **COMPLETE** | Deployed live to `https://airi-cors-proxy.<subdomain>.workers.dev`. Handles `OPTIONS`, `/cors-proxy?url=...` with wildcard headers. |
| **Worker Target 2 (`airi-kv-*`)** | ✅ **COMPLETE** | CloudflareStageDeployer compiles and uploads multi-part worker bundles, binds Discord secrets, and handles webhook interactions. |
| **Worker Target 3 (`airi-edge-vault`)** | ✅ **COMPLETE** | Saves and auto-restores S3/R2 credentials in `airi-edge-vault` KV namespace for 1-click multi-device onboarding. |
| **Canonical Shared CORS Constants** | ✅ **COMPLETE** | Centralized in `@proj-airi/stage-shared` (`DEFAULT_CORS_BYPASS_URLS`, `DEFAULT_SKIP_CORS_HOSTS`, `isCorsBypassTarget`, `setupWebCorsProxy`). |
| **Transparent Web Fetch Interceptor** | ✅ **COMPLETE** | Global `fetch` interceptor active on `stage-web` and `stage-pocket`. Automatically rewrites CORS-blocked provider requests to the proxy. |
| **Onboarding Step 2 (Choose Your Path)** | ✅ **COMPLETE** | Web PKCE handshake with automatic `GET /accounts` resolution and Edge Vault credential check. |
| **Onboarding Step 3 (Edge Services)** | ✅ **COMPLETE** | Active subdomain detection (`r1ch4rd`), R2 companion backup scanning, and auto-restoration. |
| **Onboarding Step 4 (Companion Cloud Restore)** | 🟡 **FUNCTIONAL / UX POLISH** | SelectiveSyncPanel functional; scheduled for single-footer UX streamlining. |

### 8.2 Platform Readiness Summary

* **Desktop (`stage-tamagotchi`)**: **100% Ready & Verified**. Uses 0ms native session interception (`onHeadersReceived`), Node.js loopback OAuth server, and full worker compiler.
* **Web (`stage-web`)**: **100% Ready & Verified**. Uses `setupWebCorsProxy()`, Vite dev proxies, and live `airi-cors-proxy` edge worker. Provider models (OpenCode Go, Deepgram) tested with HTTP 200.
* **Mobile (`stage-pocket`)**: **Ready for Device/Simulator Testing**. Configured with `createWebHashHistory`, `setupWebCorsProxy()`, dev server proxies, and verified typechecking.

## Relevant Skills

- [[airi-cloud-relay-infrastructure]]
