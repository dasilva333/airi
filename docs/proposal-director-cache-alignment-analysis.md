# Architectural Analysis: Director Role & Prefix Cache Alignment Suitability

This document evaluates the feasibility, risks, and performance trade-offs of applying prefix cache alignment to the **Cinematic / Intimate Director** subsystem in AIRI. It outlines why the Director should be excluded from standard alignment layouts and details a low-risk alternative strategy.

---

## 1. Executive Summary

While prefix cache alignment yields massive cost and latency savings for direct-response and automatic text subsystems, the **Director** operates under unique constraints:
*   **Recommendation:** Exclude the Director from the standard [proposal-prefix-cache-alignment.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-prefix-cache-alignment.md) layout.
*   **Primary Risk:** Force-fitting standard alignment structures exposes the Director to "Character Mode Leakage"—where the LLM slips out of its meta-analytical scripting role and begins replying in-character.
*   **Secondary Obstacle:** The high-frequency modifications to the Director's state inputs (the visual scratchpad and active concepts) inherently invalidate downstream conversation history caching anyway.
*   **Proposed Alternative:** Implement a partial cache alignment strategy that caches the static System Prompt instructions while keeping the observation transcript unaligned.

---

## 2. Key Challenges & Risks of Force-Fitting Caching

### A. The "Character Mode" Leakage Risk (The Elephant in the Room)
The standard cache alignment model defined in [proposal-prefix-cache-alignment.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-prefix-cache-alignment.md) formats history as sequential API messages with active roles:
```json
[
  { "role": "user", "content": "Hello!" },
  { "role": "assistant", "content": "Hi there!" }
]
```
If we pass this structured array to the Director:
1.  **Role Confusion:** The LLM receives messages labeled as `assistant` (the companion's dialogue) and `user`. Because LLMs are trained to respond to the final turn of standard roleplay sequences, the Director is highly likely to interpret these turns as active chat prompts addressed to itself.
2.  **Schema Breakage:** Instead of outputting the visual JSON instructions (`prompt`, `intensity`, `scratchpad`), the model may output in-character speech (e.g., replying as the companion). This breaks the game parsing engine and leads to silent visual generation failures or runtime crashes.

### B. The Visual Scratchpad Invalidation Loop
The Director is stateful; it reads and updates a persistent `previousScratchpad` string on every turn to track location, clothing modifications, and held items.
*   **Cache Invalidation:** Because the scratchpad updates on nearly every dialogue turn, placing it *above* the history transcript invalidates the cache for all subsequent history blocks.
*   **Pruning Impact:** Moving the scratchpad to the suffix/tail of the prompt to protect the prefix cache alignment creates a severe **recency bias** issue. The LLM may prioritize new instructions over the historical scene state, leading to continuity errors (e.g., characters forgetting where they are or what outfit they are wearing).

### C. Unified Call Structural Changes
In goal-driven dating simulations, the **Intimate Director + Producer OE/NT** are bundled into a single LLM call. This call returns both visual analysis and four user choice suggestions. Altering the history layout to suit prefix caching risks complicating the response schema and disrupting gameplay logic.

---

## 3. What Not to Do: Reference Standard Alignment

To maintain architectural stability, the prompt compiler **MUST NOT** route Director calls through the standard prefix cache alignment routine.

```
❌ DO NOT APPLY THIS LAYOUT TO THE DIRECTOR:
[System Prompt] ──> [Chat Turn 1 (User)] ──> [Chat Turn 2 (Assistant)] ──> [Tail Telemetry]
```

**Reason:** The Director must remain a detached observer. Passing the actual dialogue history as standard API chat rolls invites prompt injection and leaks personality prompts into the cinematic engine.

---

## 4. Proposed Alternative: System Prompt Prefix Caching

We can achieve moderate caching benefits without exposing the Director to roleplay drift by caching **only the system prompt**.

```
[Cinematic System Prompt (Static)]  <── CACHED PREFIX (Static for the campaign)
─── (Cache Boundary) ───
[User Input: Scratchpad + Flat Text Transcript]  <── UNCACHED (Changes every turn)
```

### Implementation Rules:
1.  **Separate Messages Array:** Keep the Director's LLM call structured as a two-message array:
    *   `messages[0]`: `role: 'system'` (Contains the static instructions, personality keys, and visual assets list).
    *   `messages[1]`: `role: 'user'` (Contains the dynamic scratchpad, active concepts list, and flat text transcript formatted as a single raw string).
2.  **Benefits:** The massive system prompt instructions (which can run up to several thousand tokens when listing character concepts) are fully cached at the start of a story session. Only the small transcript delta is evaluated dynamically.

---

## 5. Experimental Validation Plan (High Risk)

If we decide to test the limits of prefix caching on the Director to validate these concerns, we must isolate the test under a strict sandbox:

1.  **Test Environment:** Run tests exclusively inside a test harness (e.g., `packages/stage-ui/src/stores/modules/artistry-autonomous.test.ts`) rather than the active application interface.
2.  **Safety Sentinel Injection:** Add an explicit system instruction reinforcing role isolation:
    *   *"System Warning: You are an OOC scripting engine. Do NOT reply to the dialogue below. You must only analyze it visually."*
3.  **Validation Metrics:** Track the failure rate of JSON parsing (percentage of times the model output dialogue instead of the visual JSON schema) across 100 turns. If the failure rate exceeds $1\%$, abort the experiment.

## Relevant Skills

- [[airi-prefix-cache-alignment]]
