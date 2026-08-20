# Proposal: Attention Ecology PoC — Vetting the RWKV-7 Recurrent State as a Persistent Soul

**Status:** Consolidated PoC Specification · **Version:** 2.0 (Refined with Fable 5 Feedback) · **Supersedes:** Legacy `proposal-poc-attention-ecology-vibe-island.md`

This proposal designs a lightweight proof-of-concept whose purpose is to **vet, with pass/fail criteria, whether RWKV-7's recurrent state can serve as a persistent ambient subconscious** — accumulating a real-time impression of the user's activity, surviving restarts, remaining stable over long horizons, and producing useful downstream signals (vibe classification, prompt grounding, internal soliloquy) at near-zero cloud cost.

A PoC that cannot fail is a demo. This one can fail, and §8 defines exactly how.

---

## 1. What the Recurrent State Is (and Is Not)

To ensure the technical validity of the experiment, we define the strict boundaries of RWKV-7's linear RNN architecture:
*   **The state changes; the weights do not.** Streaming tokens into RWKV-7 updates its hidden recurrent state — a fixed-size tensor that summarizes everything fed so far. The model's weights are frozen throughout. Nothing in this PoC involves learning inside the model. The state *remembers*; it does not *learn*.
*   **RWKV-7's transition is data-dependent.** The dynamics are not a fixed linear recurrence ($h_t = W \cdot h_{t-1} + U \cdot x_t$). RWKV-7 uses a generalized delta-rule update in which decay and in-context learning rates are themselves computed from the input. Decay is therefore not an externally tunable knob; we cannot expose a "decay multiplier" in settings. What we can control is input cadence, run coalescing, and state blending (§7).
*   **Reading the state has a cost discipline.** Any generation pass (a vibe probe, a soliloquy) feeds tokens into the state — including our own probe questions. Undisciplined probing pollutes the measurement with the measuring instrument. All reads therefore follow **fork → probe → discard**: snapshot the ambient state, generate on the copy, and throw the copy away. The ambient state is only ever advanced by real telemetry.
*   **The state is a serializable artifact.** It is a tensor; it can be checkpointed to disk and restored. This is the mechanical basis of the "long-term soul" claim, and §8 tests it directly.

---

## 2. Objectives (Restated as Testable Claims)

1.  **State accumulation**: Streaming semantic activity ticks into the recurrent state produces an internal representation from which recent activity mix can be recovered — measurably, against ground truth.
2.  **Prompt-free ambient readout**: Vibe can be read from the state (via forked probes or a trained linear readout) without maintaining or parsing an event log in any LLM prompt (zero cloud prompt tokens).
3.  **Persistence & stability**: The state survives serialize/restore bit-exactly in behavior and remains non-degenerate over $\ge 24\text{h}$ of continuous ticks.
4.  **Value over the trivial baseline**: The RWKV state must outperform — or demonstrate capabilities unavailable to — a simple JavaScript EMA over the same inputs (§8, H4). This is the honesty test.
5.  **Soul-controlled expression**: The ambient state drives Live2D idle-animation selection and a Control Island indicator, closing the loop into visible behavior.

---

## 3. The Input Ticker

### Phase 1 — Binary Activity (MVP)
*   **Source**: Keyboard/mouse activity from `proactivityStore`.
*   **Tick**: Every 5s, classify `active` or `idle`.
*   **Format**: Ticks are written as terse **natural-language lines**, not bare category tokens:
    ```text
    14:32 user typing
    14:32 idle
    ```
    *Rationale*: RWKV was pretrained on natural language. A raw stream like `ACT ACT IDLE` is far outside its training distribution. Natural-language lines cost a few extra tokens per tick (trivial locally) and keep the model in-distribution. Timestamps are included **sparsely** (on the minute, not every tick) because the model otherwise has no sense of elapsed time.

### Phase 2 — Category Router (Target)
*   **Source**: Active window (`active-win`) + input activity.
*   **Router**: User-configured regex rules mapping process/title → category (`CODE`, `CHAT`, `PLAY`, `BROWSE`, `IDLE`), with dominant-fraction selection per tick.
*   **Tick line**: `14:35 coding (vscode)` — category plus a coarse app hint.

### Run Coalescing (Both Phases)
Long uniform runs are compressed, not streamed token-by-token. An overnight idle must not inject ~4,300 consecutive idle lines — uniform token floods risk saturating the state and drowning the preceding day.
*   **Rule**: After **N consecutive identical ticks** (default 24 $\approx$ 2 minutes), suppress further lines and emit periodic summaries instead:
    ```text
    14:40 still coding (18 min)
    06:10 was idle 6.4 hours
    ```
*   Coalescing thresholds are a first-class experimental variable (§8, H1b).

---

## 4. State Operations Layer

A thin runtime module owning all state mechanics; everything else goes through it.
*   **`advance(tickLine)`**: Forward-only pass feeding a tick line into the ambient state. The only operation that mutates it.
*   **`fork()`**: Cheap state snapshot for probing.
*   **`probe(forkedState, promptTail, grammar)`**: Constrained generation on a fork; the fork is discarded after. Grammar enforcement via logit masking.
*   **`checkpoint()` / `restore()`**: Serialize the ambient state (plus metadata: model hash, tokenizer hash, last-tick timestamp) to disk every 5 minutes and on shutdown; restore on launch. Restoring a state against a different model checkpoint is refused.
*   **`blend(stateA, stateB, α)`**: Linear interpolation between states. Used for soft calibration (pulling a saturated state toward a rested baseline) and wake-up re-priming.
*   **Session priming**: On first run (or after a model change), the ambient state is initialized by feeding the character's Identity DNA once.

---

## 5. The Three Subconscious Outputs

### A. Vibe Readout (60s cadence)
Every 60s: fork the state, probe with a constrained grammar restricted to the vibe vocabulary, discard the fork.
*   **Vibe vocabulary is phase-matched to input entropy**: Phase 1's binary input supports **three** distinguishable states (`FOCUSED` — sustained activity; `DRIFTING` — alternating; `AWAY` — sustained idle). The four moods (adding `RESTLESS`, `COMPANIONABLE`) are only meaningfully separable once Phase 2 categories exist.
*   **Target architecture — the linear readout probe**: Once mismatch data accumulates (§7), train a small logistic head mapping the raw state tensor $\rightarrow$ vibe label directly. This is cheaper than generation, deterministic, and produces **calibrated probabilities** for the Control Island percentages.

### B. Prompt Modifier (on user message)
When the user sends a message, the current vibe and its recent trajectory (e.g. `FOCUSED → DRIFTING over 40m`) is serialized into a compact tag block for the cloud system prompt: `[VIBE: DRIFTING | prev FOCUSED 40m | mostly CODE]`.

### C. Internal Soliloquy (on salience deltas)
*   **Delta detection is JavaScript's job, not the state's**: A small ring buffer of recent ticks detects category transitions after sustained runs (e.g., 20 min `CODE` $\rightarrow$ `PLAY`).
*   On trigger: fork the state, generate a one-to-two-sentence internal monologue on the fork, discard the fork, and append to a local soliloquy log with timestamp.
*   **Log discipline**: Entries expire from the cloud-visible window after a TTL (default 2h) or once referenced; the full log rotates locally.

---

## 6. Soul-Controlled Animation & Engagement Logging

### A. Constrained Animation Selection
As in the original: the 60s probe's grammar targets the character's idle-animation enum directly (`idleLoop`, `energetic`, `shy`, `confidentPose`, `cool`, `kawaiiKaiwai`) instead of abstract moods, via logit masking.

### B. Engagement Logging (Replacing "Reward Injection")
Because weights are frozen during inference, a reward token cannot train the model. Instead, the reinforcement logic is moved outside the model:
1.  Every animation transition is logged: `(state fingerprint, chosen animation, time-to-next-user-interaction)`.
2.  This dataset trains a lightweight selection policy over time — initially just per-animation engagement priors biasing the probe's logit mask, eventually a small head on the state tensor.
3.  **Feedback-loop damping**: The policy may bias *which* expression is shown, never *how often* expressive transitions occur, and per-animation bias is bounded. This prevents the system from converging on a singular attention-seeking loop.

User messages enter the ambient state as ordinary telemetry lines (`14:41 user spoke to her`) because the character being talked to is part of her ambient experience. They are context, not reward.

---

## 7. Calibration: What Is Actually Tunable

*   **Cadence & coalescing**: Tick interval, coalescing threshold $N$, and summary-line frequency.
*   **State blending**: A "rest" operation — `blend(ambient, baselinePrimedState, α)` — applied during sleep-cycle consolidation, softly recovering a saturated or drifted state without amnesia.
*   **Probe training from mismatch logs**: User overrides/dismissals append to `personal_airi/vibe_mismatches.jsonl`. This labeled data trains the §5A linear readout and recalibrates the Control Island display.

---

## 8. Experiment Design: How the Soul Is Vetted or Rejected

All hypotheses run on a **synthetic replay harness**: scripted tick streams with known ground truth (e.g., "3h coding, 20m chat, 1h gaming, overnight idle"), replayable deterministically at faster-than-real-time.

| # | Hypothesis | Test | Pass Criterion |
| :--- | :--- | :--- | :--- |
| **H1a** | The state encodes recent activity mix recoverably | Replay scripted streams; probe vibe at checkpoints; compare to ground-truth labels | $\ge 80\%$ probe accuracy on 3-state Phase 1 vocabulary |
| **H1b** | NL ticks outperform bare category tokens; coalescing prevents saturation | Same streams in both formats; with/without coalescing; measure probe accuracy + state-norm trajectory | NL format $\ge$ token format; coalesced overnight-idle stream retains $\ge 70\%$ next-morning probe accuracy on prior-day queries |
| **H2** | Fork/probe discipline keeps the ambient state clean | Run identical streams with probing on-fork vs. probing in-place | On-fork ambient state trajectory is unaffected by probe frequency; in-place drifts |
| **H3** | The soul persists | Checkpoint mid-stream, restart process, restore; compare probe outputs vs. uninterrupted run | Post-restore probes match uninterrupted run within noise |
| **H3b** | The soul is stable long-horizon | 24h+ continuous synthetic stream; monitor state-norm drift, probe entropy | No degenerate collapse (repeating tokens, frozen vibe, exploding norms) across 24h |
| **H4** | **RWKV beats the trivial baseline** | Implement a ~10-line JS EMA over category frequencies; run every H1 test on both | RWKV probe accuracy strictly exceeds EMA, **or** RWKV demonstrates capabilities the EMA structurally cannot (soliloquy, rich caption inputs) |

*Failure disposition*: If H4 fails outright, the Attention Ecology keeps the EMA for vibe, keeps RWKV solely as the Stage-2 salience judge, and the soul framing is retired.

---

## 9. UI Touchpoint: Control Island Indicator

```
┌──────────────────────────────────────────────┐
│  [ ● VIBE ]  AIRI: Active (Focus Mode)  [ _ ]│
└──────────────────────────────────────────────┘
```

*   **Indicator dot**: Color-mapped to current vibe (green `FOCUSED`, yellow `DRIFTING`/`PLAY`, blue `BROWSE`, purple `AWAY`).
*   **Telemetry popover**:
    *   *Activity mix (last 10m)* — computed from the JS tick buffer (deterministic telemetry).
    *   *Current vibe* — the latest probe result, with its timestamp.
    *   *Vibe confidence* — calibrated probability from the linear head.
*   **Debug drawer** (dev builds): Live tick stream, state-norm sparkline, last probe I/O, checkpoint age.

---

## 10. Privacy Notes

*   Categories enter the tick stream; raw window titles do not, except coarse app hints (`vscode`, `discord`). The regex router runs locally and discards sensitive strings.
*   Excluded apps tick as `IDLE`-equivalent (`private`).
*   Soliloquy entries and prompt modifiers are built from categories and durations only.
*   Checkpoints, tick logs, mismatch logs, and soliloquy logs are local files, covered by the parent proposal's "forget this" purge control.

---

## 11. Milestones

1.  **M1 — State ops + harness**: State operations layer (§4), synthetic replay harness, EMA baseline.
2.  **M2 — Phase 1 ticker**: Binary activity lines, coalescing, 3-state constrained probe, Control Island dot + debug drawer.
3.  **M3 — Phase 2 router**: Category regex UI, 4–5 state vocabulary, prompt modifier with trajectory, soliloquy with JS delta detection.
4.  **M4 — Learning layer**: Mismatch-log collection, linear readout probe, engagement logging + animation policy.

## Relevant Skills

- [[airi-attention-ecology-vision]]
