# Project AIRI — Privacy Policy & Architectural Trust Model

> **Presence without custody. Your companion belongs to you.**

An AI companion is not a generic utility or a web search box. Over weeks and months of daily interaction, a companion observes behavior, shares intimate conversations, accumulates relationship history, learns personal routines, holds relational memories, and perceives screen and voice interactions.

**"Local LLM" does not automatically mean "private companion."** If an application collects telemetry, runs background analytics, or silently relays state to infrastructure outside the user's control, the entire software becomes an untrusted boundary.

This document establishes the exact privacy architecture, trust boundaries, data flows, and custody model of Project AIRI.

---

## 1. The Core Architectural Philosophy

### Local-First Runtime
AIRI is designed as a local-first application. All character identities, memory stores (short-term, long-term journals, lifetime archives, echo chips), sensory telemetry, and configurations reside exclusively on your machine in local storage and IndexedDB.

### No Developer-Operated Backend
There is **no Project AIRI server operator**, no multi-tenant corporate database, and no centralized backend. The web build is hosted strictly as static frontend assets on GitHub Pages. Desktop builds run locally as an Electron application. Your data is never sent to the project author or any central service operated by this project.

### Zero Telemetry & Zero Analytics
Project AIRI contains **0 telemetry, 0 tracking scripts, and 0 analytics SDKs**. There is no PostHog, Plausible, Google Analytics, Sentry, or hidden heartbeat pinging external servers. Nothing is logged or recorded about how you use the app, which characters you build, or how long you interact.

---

## 2. Privacy & Trust Matrix

| Question | Architectural Reality |
| :--- | :--- |
| **What leaves the device?** | Nothing leaves your device in local mode. If Cloud Sync is enabled, the application's local state syncs directly to your private Cloudflare infrastructure, excluding machine-specific hardware/device settings. |
| **What is encrypted before transit?** | All transport uses standard TLS/HTTPS. Payload contents are stored in your private R2/KV storage without application-layer secondary encryption to allow native Workers execution. |
| **Who possesses the keys and custody?** | **Cloudflare and you.** The developer holds no credentials, keys, database access, or infrastructure custody. Authentication uses PKCE directly against Cloudflare Access. |
| **Can server operators read conversations?** | **No server operator exists.** There is no intermediary relay or developer-hosted server. |
| **What telemetry or analytics exist?** | **Zero.** No analytics, no telemetry, no tracking pixels, no crash telemetry, and no usage profiling. |
| **What happens when sync is disabled?** | Local synchronization halts immediately. Previously synced state remains securely in your private cloud storage until you choose to delete it. |
| **Can you delete your cloud state?** | **Yes.** You can completely wipe cloud state from within the app via the Cloud Relay settings tab, or manage/delete it directly in the Cloudflare dashboard. |
| **Can you completely export your companion?** | Character cards and 3D/2D models can be exported locally. When Cloud Sync is used, your R2 bucket provides a clean, open, complete raw backup of your companion's state. |
| **What does the Discord cloud presence access?** | The cloud worker accesses the synced application state in your private KV/R2 storage to maintain continuity when your local desktop is offline. Machine-specific controls (like local audio inputs or local Discord client hooks) remain strictly machine-bound. |

---

## 3. Detailed Architectural Breakdown

### A. Local Stage (Default Mode)
When running AIRI on your desktop or browser:
- **Database**: State is persisted in browser/Electron IndexedDB (`local:*`, `outbox:*`) and localforage blob storage.
- **Model Inference**:
  - **Local Models**: WebGPU/WASM models (e.g. Kokoro TTS, Whisper STT, WebLLM, Web-RWKV) execute 100% on your local hardware without network connectivity.
  - **Cloud AI Providers**: If you configure cloud providers (OpenAI, Anthropic, Google Gemini, OpenRouter, DeepSeek, ElevenLabs, Groq, etc.), your prompts, audio, or images are transmitted directly from your client machine to that provider's official API endpoint using **your personal API key**. Project AIRI operates no intermediate proxy or inspection layer.
- **Perception & Sensors**: Vision captures, window monitoring, and audio input stay on your device. Only context needed to fulfill an active user interaction or perception prompt is dispatched to your selected model.

### B. Cloud Sync & Cloud Relay Architecture (Cloudflare Zero Trust)
AIRI offers optional cloud capabilities using a Bring-Your-Own-Storage (BYOS) philosophy powered by Cloudflare:

```text
                    ┌─────────────────────────┐
                    │      User's Device      │
                    │   Local-First Storage   │
                    │  (IndexedDB / Local)    │
                    └────────────┬────────────┘
                                 │
                   Direct TLS (PKCE Authorization)
                                 │
                    ┌────────────▼────────────┐
                    │  User-Owned Cloudflare  │
                    │  Zero Trust / Access    │
                    └────────────┬────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             │                                       │
      ┌──────▼──────┐                         ┌──────▼──────┐
      │  R2 Storage │                         │  Cloud Relay│
      │ (Sync Store)│                         │ (Workers/KV)│
      └─────────────┘                         └──────┬──────┘
                                                     │
                                              ┌──────▼──────┐
                                              │ Discord Bot │
                                              │ (Remote AU) │
                                              └─────────────┘
```

1. **Authentication (PKCE)**:
   You authenticate directly with Cloudflare Access using Proof Key for Code Exchange (PKCE). No credentials pass through or are stored by any third party.
2. **What Syncs vs. What Stays Local**:
   - **Synced State**: Characters, conversation sessions, memory hierarchy (STMM, journals, lifetime artifacts), visual assets, custom backgrounds, and card bundles.
   - **Machine-Local Exclusions**: Hardware-dependent configurations (selected microphone, speaker, active window tracking gates, per-machine Discord client toggles) remain pinned to the specific device to avoid cross-device conflicts.
3. **The "Leaving the House" Paradigm (Discord Cloud Relay)**:
   AIRI's Cloud Relay allows the companion to maintain an active presence even when your desktop computer is powered off. The Cloudflare Worker reads from your private KV/R2 state to handle Discord mentions or scheduled proactive checks, accumulating memories that reconcile with your local stage when you return.

### C. Data Custody and Erasure
- **Cloud Deletion**: You retain total ownership of your Cloudflare account. You can purge the synced state at any time via the **Cloud Relay Tab** in AIRI's settings or directly inside your Cloudflare dashboard by clearing the R2 bucket and KV namespace.
- **Local Deletion**: Clearing browser storage or uninstalling the desktop app permanently deletes all local IndexedDB databases, models, and audio caches from that machine.

---

## 4. Summary

Project AIRI does not monetize your data, sell telemetry, or trap your companion inside a walled garden.

**Your memories belong to you.**
**Your conversations belong to you.**
**Your character belongs to you.**
**The cloud is infrastructure you authorize, not the owner of your relationship.**
