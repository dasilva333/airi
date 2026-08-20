---
name: airi-proactivity-sensory-telemetry
description: >-
  Use when working with the AIRI proactivity heartbeats engine, OS sensor polling
  (idle time, active window title, program/process name, AFK threshold, system volume,
  local time, system load), rolling active-window history, environmental telemetry
  sensorPayload, attention-ecology heuristic gating, NO_REPLY sentinel decision logic,
  idle heartbeat loop, sensor compilation and registered-tool resolution in
  ProactivityStore. Key tech: Electron main-process sensors via eventa invoke, Pinia,
  useIntervalFn, useElectronEventaInvoke, xsai tools. Paths:
  docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md,
  packages/stage-ui/src/stores/proactivity.ts.
---

# AIRI Proactivity — Sensory Telemetry & Heartbeats

Turns the agent from reactive into proactive: a timer polls OS sensors, runs heuristic
gates, builds a hidden telemetry prompt, and asks the LLM to either speak or emit the
`NO_REPLY` sentinel. This is the "attention ecology" gate — decide whether interrupting
the user is appropriate before any TTS/LLM output is produced.

## Key Files/Locations

- `docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md` —
  design doc: 5-phase pipeline (Timer/Hard Gates → Sensor Polling → Heuristic Gates →
  Prompt Formulation → LLM Execution/TTS), HeartbeatConfig model, NO_REPLY contract.
- `packages/stage-ui/src/stores/proactivity.ts` — `ProactivityStore`. Contains:
  - **Sensor probes** via Electron invoke (lines 79-85): `sensorsGetIdleTime`,
    `sensorsGetActiveWindow`, `sensorsGetActiveWindowHistory`, `sensorsGetSystemLoad`,
    `sensorsGetLocalTime`, `sensorsGetVolumeLevel`, `sensorsSetTrackingEnabled`.
  - **Reactive sensor state:** `idleTimeSec` (line 87), `activeWinStr`, `winHistory`
    (line 89, `ActiveWindowEntry[]`), `sysLoad`, `locTime` (`Current Local Time`, line 91), `volLevel` (line 92).
  - **`updateSensors()`** (line 116) — parallelizes all probes (`Promise.allSettled`)
    to bound latency by the slowest single call. Captures `locTime` from `sensorsGetLocalTime` or browser `toLocaleTimeString`.
  - **Polling loop:** `useIntervalFn(updateSensors, 10000)` (line 247), paused/resumed by
    `isProactivityLoopNeeded` (line 241).
  - **`sensorPayload` computed** (line 266) — compiles the environmental telemetry block (`Current Local Time: HH:MM`, `User Idle: Ns`, active program/window, CPU/GPU load, volume).
  - **Prompt Grounding Integration (`packages/stage-ui/src/stores/chat.ts:L565-L572`):** When `groundingEnabled` is active, `chat.ts` calls `updateSensors()` and injects `sensorPayload` into the `[ENVIRONMENTAL AWARENESS]` system message on every user chat turn, allowing the companion to know the current time, active app, and idle state in real time.
  - **`resolveRegisteredTools()`** (line 850) — flattens static + async-factory tools.
  - **`registerTools()`** (line 60) and `registeredTools` (line 58).
  - **`NO_REPLY` handling** (lines 698-702).

## When to Use

- Touching OS sensor capture, local clock/time awareness, idle/AFK detection, active-window or volume telemetry.
- Adjusting the environmental telemetry injected into proactive prompts or standard chat turn grounding (`[ENVIRONMENTAL AWARENESS]`).
- Working on the heartbeat timer, schedule window, or idle-stretch dedup logic.
- Debugging why a heartbeat aborted, fired late, or stayed silent.
- Registering/resolving proactive or MCP tools available to the heartbeat (and Live API).

## Common Pitfalls

- **`NO_REPLY` is a control sentinel, not content** (NOTICE line 698). It is matched by an
  exact `trim() === 'NO_REPLY'`; if you add formatting or punctuation the gate misses it and
  the agent "speaks" the sentinel. Never render it into TTS/history.
- **Sensors only exist under Electron.** All invokes are gated on `isElectron` (line 78);
  on web they resolve `undefined` and the payload degrades to "unknown". Guard every probe.
- **Probes are parallelized for a reason** — do not serialize them or you'll add latency
  up to the sum of all probes instead of the max.
- **Rolling window history, not clipboard.** `sensorPayload` uses
  `winHistory.value.slice(-6)` (line 279) as the recent-activity buffer, emitting the active
  program name (`processName`, line 284) and window title (line 286). There is no clipboard
  sensor or 5-event clipboard buffer in the current source — do not invent one.
- **Invisible emotion meters (Trust/Patience/Playfulness) are NOT implemented.** No such
  refs exist in `proactivity.ts`; "attention ecology" gating here is heuristic (AFK
  threshold, schedule window, idle-stretch dedup via `firedForIdleSession`, line 75) plus
  history-derived usage metrics — not affective meters. Don't reference meters that don't exist.
- **Idle-gated re-fire dedup.** "Interval" is reinterpreted as *required continuous idle
  minutes* (lines 513-528): the heartbeat fires once per idle stretch and won't re-fire
  until `idleTimeSec` drops back down (user returns) and the threshold is met again.
- **Never fire during a session switch** — if session data hasn't resolved, the heartbeat
  defers ("Session switch in progress", line 496).
- **`resolveRegisteredTools` is shared** with `LiveSessionStore` (uses the top-level
  function, NOTICE line 681) — changing its contract affects both proactivity and Gemini Live.


### Authoritative Design & Architecture Documents

- [docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md](docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md) — Proactivity heartbeats engine design (5-phase pipeline).
- [docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md](docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md) — Chat/STT/proactivity pipelines architecture.
- [docs/project-proactivity-enrichment-roadmap.md](docs/project-proactivity-enrichment-roadmap.md) — Proactivity enrichment roadmap.
- [docs/proposal-proactivity-vision.md](docs/proposal-proactivity-vision.md) — Proactivity vision proposal.
- [docs/director-producer-roles.md](docs/director-producer-roles.md) — Director/producer roles document.
- [docs/content/en/docs/showcase/07-producer-subsystem.md](docs/content/en/docs/showcase/07-producer-subsystem.md) — Producer subsystem showcase.

## Verification

- `pnpm -F @proj-airi/stage-ui typecheck` for any store change.
- Watch `[Proactivity] Sensor tick -> Idle: Ns` debug output to confirm the 10s poll loop.
- Confirm the loop pauses when `isProactivityLoopNeeded` is false and resumes when true.
- Drive a heartbeat and assert silence logs `AI decided to remain silent via NO_REPLY
  sentinel` with nothing added to history/TTS.
- Confirm `sensorPayload` includes `User Idle`, `Active Program`, `Active Window Title`,
  `Volume Level`, and the trailing window-history entries as expected.

## Related Skills & References

- **Key Documents**: [[design-proactivity-heartbeats-engine]], [[arch-chat-stt-proactivity-pipelines]], [[project-proactivity-enrichment-roadmap]], [[proposal-proactivity-vision]], [[director-producer-roles]], [[07-producer-subsystem]]
