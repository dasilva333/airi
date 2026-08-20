# Proposal: Core-Agent Revamp & Apeira Integration

This document outlines the design considerations, community feedback, technical capabilities, and potential migration path for replacing the custom `@proj-airi/core-agent` orchestrator in this fork with **Apeira** as the core LLM execution runtime.

---

## 🧭 1. Background & Context

During discussions on June 10, 2026, the community reviewed the release of **Apeira v0.0.5**, which introduces native support for the Chat Completion API and modular runners (see [Apeira Runners Guide](https://moeru.ai/apeira/guide/runners.html)).

This prompts the question of whether Apeira should replace the current custom `@proj-airi/core-agent` package in the AIRI codebase.

---

## 💬 2. Discussion Transcript (June 10, 2026)

The following logs record the design alignment regarding the viability of Apeira:

> **藍 [AIRI]** *(Super Mod)* — 9:48 AM
> https://github.com/moeru-ai/apeira/releases/tag/v0.0.5
> Apeira now supports the Chat Completion API.
> https://moeru.ai/apeira/guide/runners.html
>
> **Richy (dasilva333)** — 9:59 AM
> hey @藍 would you say that apeira would work well as a replacement to AIRI's core-agent package?
>
> **藍 [AIRI]** — 10:04 AM
> I don't think there are any major issues right now; it just requires some effort.
> Also, Apeira is currently still unstable.
>
> **藍 [AIRI]** — 10:09 AM
> It is worth noting that I will design new persistence interfaces later.
>
> **Richy (dasilva333)** — 10:15 AM
> my AI agrees with you that it's way too unstable right now to adopt
>
> **藍 [AIRI]** — 10:23 AM
> Furthermore, the aspect of Apeira I am currently most satisfied with is undoubtedly the Plugin API.
>
> **Richy (dasilva333)** — 10:34 AM
> if you could look at my fork and consider how my core-agent would look or fit into your framework that would help too there's a lot of use cases there that you probably havent considered so that's where the plugin would come in

---

## ⚡ 3. Technical Capabilities (The "Juice")

Apeira v0.0.5 introduces several key runtime features that make it an attractive long-term target:

### A. Robust Queueing & Interruption Control
Apeira formalizes methods for serializing and managing agent execution turns:
*   `interrupt(reason)`: Aborts the active turn, records a `<turn_aborted>` boundary in the input history for the model to see, and continues executing subsequent items in the queue.
*   `abort(reason)`: Silently terminates the active turn immediately without writing a boundary.
*   `clear()`: Aborts the running turn, removes queued turns, resets the input history to the original input seeds, and clears the active plain-object state.

### B. Unified Stream & Events
Running a turn returns a native `ReadableStream` filtered to that turn. It also supports global subscriptions:
```typescript
agent.subscribe('apeira', (event) => {
  // Handles events reactively
})
```
This forwards:
*   **Lifecycle events**: `turn.queued`, `turn.start`, etc.
*   **LLM provider events**: `text.delta`, `reasoning.delta`, `tool-call.start`, etc.

### C. Declarative Multi-Step Execution
It supports customizable, conditional loops for multi-step agent behavior using logical operators:
```typescript
stopWhen: and(stepCountAtLeast(5), hasToolCall('deploy'))
```

---

## 🔍 4. Current Feasibility & Stability Assessment

1. **Unstable Core & Runners**: The core package and the runner environments are still highly volatile and undergo rapid changes.
2. **Pending Persistence Redesign**: The upstream author (藍) explicitly flagged that **new persistence interfaces** will be designed later. Adopting Apeira before these interfaces stabilize would lead to severe schema breakage and high integration maintenance overhead.
3. **Decision**: **Deferred.** The integration will remain a "wish" roadmap item. We will monitor upstream releases until persistence APIs are stable and defined.

---

## 🔌 5. Fork Adaptation & The Plugin Paradigm

While the runtime itself is unstable, the **Apeira Plugin API** is the most promising point of alignment. The AIRI fork contains numerous specialized, local-first use cases that upstream's base runtime does not cover. When we eventually integrate, we should adapt these features as modular Apeira Plugins:

### Unique Fork Use Cases to Map as Plugins:
*   **Proactive Artistry Triggers**: Heartbeats and visual capture events that trigger autonomous character reactions.
*   **Live Session Bidirectional Audio**: Intercepting and feeding live PCM streams to STT and TTS backends without blocking the text chat queue.
*   **Tamagotchi Desktop Overlay Routing**: Injecting mouse/coordinate tracking and localized window states.
*   **Selective Vector RAG Gating**: Restricting memory searches dynamically by channel, guild, or active session boundaries.

---

## 📅 6. Action Items & Roadmap

1. **Track Upstream Releases**: Monitor `moeru-ai/apeira` for changes to the persistence interfaces and stable runner contracts.
2. **Draft Plugin Interfaces**: Design a bridge mapping our local Pinia stage-stores and layered-memory indexes to a pluggable hook layout compatible with Apeira.
3. **Prototype Runner Replacement**: Experiment with replacing local WebGPU and Cloud providers via Apeira runners in a sandboxed branch once stability is achieved.

## Relevant Skills

- [[airi-prompt-builder-engine]]
