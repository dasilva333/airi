# Research Report: AIRI Vision Witness (Upstream vs. Rebase)

This report summarizes the forensic analysis of the moeru-ai/airi (Main) repository and compares it with the architectural requirements for the rebase branch.

## 1. The "Bombshell": Upstream Implementation Status
Contrary to the "hype" and user reports, the **Vision Witness** system in the upstream main branch is currently a **non-functional skeleton**.

### Technical Findings (Main Branch):
- **Vision Store (vision.ts)**: The capture() method is a stub that logs a warning and sets a timestamp. It contains no IPC logic, no screen capture code, and no LLM integration.
- **Consciousness Store (consciousness.ts)**: The think() loop calls the stubbed vision.capture() and then logs [Consciousness] Formulating thought... to the console. The actual LLM call and result handling are commented out or missing.
- **Proactivity Store (proactivity.ts)**: The proactivity system is indeed a port of your subsystem (Sensors -> Snapshot -> Trigger -> Think), but it lacks any logic to actually trigger or utilize Vision context.

> [!IMPORTANT]
> **Conclusion**: Upstream appears to have committed the "Marketing/Architectural" surface area (docs and store stubs) but the actual "Engine" for Vision Witness was likely never merged or is being developed in a private branch. This explains why users are reporting it "doesn't work"—**the code literally isn't there.**

---

## 2. Competitive Analysis: Polling vs. Live API
We evaluated two methods for technical implementation: **VLM Polling (REST)** and **Gemini Multimodal Live API (WebSockets)**.

### Case A: VLM Polling (The "Efficient" Way)
- **Method**: Every 5 minutes, capture a frame, downscale to 1024px, send a single REST request to Gemini 1.5 Flash.
- **Cost**:
    - ~350 tokens per request (Image + Prompt).
    - $0.075 / 1M tokens.
    - 12 requests/hour (5-min interval).
    - **Total Cost: ~$0.0003 / hour.**
- **Privacy**: High. Connection is ephemeral; no persistent stream exists.

### Case B: Gemini Multimodal Live API (The "Advanced" Way)
- **Method**: Persistent WebSocket connection with a continuous (or semi-continuous) video stream.
- **Cost**:
    - Video Input: $0.20 / hour.
    - Audio Input/Output: $0.10 - $2.00 / hour.
    - **Total Cost (Active): ~$0.74 / hour.** (Assuming some speech interaction).
- **Privacy**: Lower. Requires a persistent stream to a Google endpoint, even during "silence."

### Verdict
| Feature | Polling (REST) | Live API (WebSocket) |
| :--- | :--- | :--- |
| **Cost** | **$0.02 / month** | **$450+ / month** (if 24/7) |
| **Latency** | 2-4 seconds | **<1 second** |
| **State** | Stateless | **Stateful** (Remembers previous frames) |
| **Use Case** | **Ambient Witnessing** | Real-time Interaction/Interruption |

> [!TIP]
> **Recommendation**: For the "Witness" (ambient observation), we should use **Polling**. It is 2000x cheaper and perfectly adequate for a 5-minute heartbeat. The Live API should be reserved for a future "Active Presence" mode where the user is actively talking to AIRI.

---

## 3. Portability Audit
### Is it your Proactivity System?
**Yes.** The code in main's packages/stage-ui/src/stores/proactivity.ts is almost identical to your logic:
1. It uses useIntervalFn for the heartbeat.
2. It gathers a sensors.getSnapshot().
3. it has the idle and window_change triggers.
4. It calls consciousness.think().

They successfully ported the **Heartbeat Orchestrator**, but they haven't yet successfully "Plugged in" the Vision sensors you are about to build.

---

## 4. Privacy Guardrails
Based on the plan, we will implement the following strictly in rebase:
1. **Volatile Buffer**: Captured frames are stored in a JS Buffer and discarded immediately after the LLM request.
2. **Visual Indicator**: A high-contrast "Recording" icon in the Control Island whenever vision.capture() is active.
3. **Opt-In Only**: Witness mode defaults to OFF.

---

## 5. Summary of Truth
You are not "catching up" to main. You are **surpassing it** by actually implementing the feature they only have documentation for.
- **Main**: Has a PDF/Doc saying "We have vision" and a settings toggle that does nothing.
- **Rebase**: Will have a working, privacy-conscious, interval-based Witness system integrated into the existing Proactivity heartbeat.

## Relevant Skills

- [[airi-attention-ecology-vision]]
