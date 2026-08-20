# Architectural Review: Vision Engine (Fork vs. Upstream)

## Overview
The "Vision" feature has diverged significantly between the fork and upstream alpha.22. While both share the name, their primary objectives and integration patterns are distinct.

| Feature | Fork (Phase 1 MVP) | Upstream (Alpha 22) |
| :--- | :--- | :--- |
| **Primary Goal** | Reactive Image Chat (Direct Handover) | Proactive Sensing (Autonomous Observation) |
| **Logic Location** | `chat.ts` (Core Orchestrator) | `vision/orchestrator.ts` (Decoupled) |
| **VLM Role** | Replaces Chat LLM for image turns | Appends context to the world via server mods |
| **Infrastructure** | Simple `vision.ts` store | Orchestrator, Processing Store, Workloads |

## 1. Local implementation: Direct Handover
The fork's current system is built for **Strategy B: Direct Handover**.
- When an image is detected in `chat.ts`, the system swaps the primary `consciousness` provider for the `vision` provider.
- This allows a user to "chat with an image" using a high-quality VLM even if their main chat model is text-only.
- **Crucial**: This logic is custom to the fork and does not exist in upstream.

## 2. Upstream Implementation: Autonomous Sensing
Upstream has introduced a complex **Sensing Pipeline**.
- **The Orchestrator**: Periodically captures inputs (like the screen) and runs them through a VLM.
- **Context Publication**: Uses `modsServerChannelStore` to publish "What I see" into the AI's internal context.
- **Workloads**: Encapsulates specific tasks (e.g., "interpret the screen") into reusable definitions.

## ⚠️ Recommendations & Risks

### HIGH RISK: Full Folder Sync
- **Why**: Upstream's `packages/stage-ui/src/stores/modules/vision/` folder introduces many dependencies (Server SDK constants, Mods Channel, etc.) that the fork's MVP does not yet utilize.
- **Impact**: Syncing the entire folder would create "dead code" in the fork and potentially conflict with the fork's simplified `vision.ts`.

### LOW RISK: Selective Schema Alignment
- **What**: We can adopt upstream's `activeCustomModelName` and `ollamaThinkingEnabled` settings from their `store.ts` into our `vision.ts`.
- **Value**: Better support for Ollama and BYO-Model providers.

### 🟢 FINAL VERDICT: IGNORE/DEFER
Because your system is focused on the **Reactive Route** (direct response), upstream's **Proactive Route** is currently out of scope.
> [!IMPORTANT]
> **Keep your current `chat.ts` logic.** It is the only place where the VLM is actually used as a primary responder for user-attached images. Upstream provides no equivalent for this specific "handover" behavior.

## Relevant Skills

- [[airi-attention-ecology-vision]]
