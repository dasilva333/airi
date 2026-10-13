# Proposal: TypeSafe Jev ("System 1") Decision Engine Integration

> **Status**: Proposed Architecture & Evaluation RFC (Active shipped implementations cataloged in [`docs/design-jev-integrations.md`](./design-jev-integrations.md))
> **Target Subsystems**:
> - `packages/stage-ui/src/composables/arcade/use-arcade-agent.ts` & Arcade Room Retro Games (`chat_arcade.vue`, `docs/proposal-generic-gaming-agent-runtime.md`, `docs/proposal-gaming-show-harness-copilot.md`)
> - `packages/nan0-runtime/` & Living Cognition Pre-Processor (`docs/nan0/design-nan0-cognition-runtime.md`, `docs/nan0/shadow-boundary-specification.md`)
> - `packages/stage-ui/src/stores/proactivity.ts` & Attention Ecology Programmable Gate (`docs/proposal-prefix-cache-alignment.md`, `docs/design-attention-ecology-screen-watching.md`)
> - `packages/stage-ui/src/pages/characters/guided.vue` & AnimaDex Wizard Fast Voice Matching (`docs/proposal-animadex-wizard.md`)
> - `packages/stage-ui/src/stores/speech.ts` & Real-Time Expression/Motion Dispatch (`docs/airi-acting-cue-act-tokens/SKILL.md`)
> - `packages/stage-ui/src/stores/memory/` & Token Compaction / Pre-Summary Curation (`docs/design-subconscious-system1-inference-providers.md`)
> - `packages/stage-ui/src/stores/chat/recent-topics.ts` (Toggle 4) & Salience Gating (`docs/proposal-toggle4-rework-and-rwkv-harness.md`, `docs/proposal-salience-gate-ui-integration.md`)
> **Key External References**:
> - TypeSafe Jev API (`https://typesafe.ai/`, `https://docs.typesafe.ai/`)
> - OpenRouter Provider & Pricing (`https://openrouter.ai/typesafe/jev-1.13#providers` · Model slug `typesafe/jev-1.13` / `typesafe/jev-latest`)
> - Reference Implementation: `AmoghCreator/doom-jev` (`https://github.com/AmoghCreator/doom-jev` · Autonomous ViZDoom Agent)
> - Rob Shocks Breakdown (`https://www.youtube.com/watch?v=2Bs0Ink_-Uo`)

---

## 1. Executive Summary & Paradigm Shift

Current LLM-powered agent architectures in AIRI (and the broader AI ecosystem) rely almost exclusively on **autoregressive text generators** for every cognitive task—from conversational roleplay down to binary decisions, topic clustering, and tool dispatching.

Autoregressive models operate as **"System 2"** engines (in Daniel Kahneman's *Thinking, Fast and Slow* terminology): they reason deliberately, generate output token-by-token, suffer from non-deterministic variance, carry high latency (800ms–3,000ms), and cost significant compute per call. When forced to make discrete machine-facing decisions, they suffer from well-documented failure modes:
1. **Preamble & Schema Escape**: Chatty preambles (`"Sure! Here is the JSON..."`) breaking parsers.
2. **Overconfidence & Poor Calibration**: Hallucinating certainty when faced with ambiguous edge cases.
3. **Prohibitive Latency & Cost Loops**: Running 1–5 Hz sensory or gaming loops bankrupts API budgets and freezes user interfaces.

**TypeSafe Jev represents a fundamental departure: a true "System 1" AI model.**
- **Does not generate text or tokens**: Given an input state and typed query schemas, Jev evaluates decisions in parallel using reinforcement learning optimized for calibrated classification.
- **Native Primitives**: Directly returns typed outputs across three core primitives:
  - `Choice`: Categorical selection over candidate enums with calibrated probability distributions.
  - `Score`: Scalar evaluation (e.g. 0.0 to 1.0 intensity, risk, or frustration).
  - `Boolean / Nullable`: Binary truth verification with exact probability metrics.
  - Every primitive returns an explicit **confidence score** alongside probabilities.
- **Latency & Economics**: ~100–180ms round-trip latency at **$42 per billion tokens** (20×–200× cheaper than frontier LLMs, and 6× faster than Gemini 2.5 Flash Lite).

This document analyzes how TypeSafe Jev can serve as the missing high-speed decision substrate across seven core subsystems in AIRI.

---

## 2. Structural Comparison: Where Jev Fits in the AIRI Model Matrix

AIRI currently leverages three distinct model categories. Jev defines an entirely new fourth tier:

| Attribute | Frontier Cloud LLMs (Claude 3.5, GPT-4o) | On-Device Tiny WASM (Needle 2 - 45M SAN) | Local WebGPU Recurrent (RWKV-7 0.1B) | **TypeSafe Jev ("System 1")** |
| :--- | :--- | :--- | :--- | :--- |
| **Role in AIRI** | 2nd-Hop Vocal Dialogue, Narrative Monologue, Complex RAG Synthesis | On-device 2–4 turn local action/topic extraction | Recurrent hidden-state salience sensor ($\Delta h$) | **Ultra-fast, calibrated typed decision routing & action gating** |
| **Execution** | Cloud API (Autoregressive) | Local CPU / WASM | Local WebGPU VRAM | **Cloud API (Parallel Decision Network)** |
| **Latency** | 800ms – 3,500ms | 150ms – 350ms | 200ms – 1,200ms | **~100ms – 180ms** |
| **Cost** | $2.50 – $15.00 / Mtok | $0.00 (Local Compute) | $0.00 (Local Compute) | **$0.042 / Mtok ($42 / Btok)** |
| **Deterministic Schema** | ⚠️ Variable (Schema repair required) | ✅ 100% (Byte-level grammar) | ❌ 0%–33% (Grammar escape) | ✅ **100% (Typed JSON by construction)** |
| **Calibration** | ❌ Poor (Overconfident) | ⚠️ Sensitive (Hedging sinks) | ❌ N/A (Scalar state delta) | ✅ **Empirically Calibrated Probabilities** |
| **Text Generation** | Rich expressive prose | Snippet / span extraction | Prose roleplay (unconstrained) | ❌ **Zero text generation (Decisions only)** |

---

## 3. High-Value Subsystem Integration Avenues

```mermaid
flowchart TD
    subgraph "Perceptual, Sensory & State Streams"
        Screen[Screen Capture / pHash Delta]
        VisualDesc[Visual Descriptor / Local OCR]
        Sensors[OS Telemetry / Idle State]
        ChatIn[User Chat / Streaming Stride]
        GameFrame[Arcade / JS-DOS State]
        AnimaDexTags[AnimaDex Character Catalog & Tags]
        RawHistory[Raw Multi-Turn Conversation Log]
    end

    Screen --> VisualDesc

    subgraph "System 1 Fast Decision Gate (TypeSafe Jev ~100-150ms)"
        JevGate{"Jev Parallel Decision Substrate\n($42/Btok / Laya Local)"}
        ActionPicker["Gaming Action Picker (Choice)\n[ENGAGE, RETREAT, ITEM]"]
        ProgScreenGate["Programmable Vision Gate (Boolean)\n['Is entry interesting?' / Custom]"]
        VoiceMatcher["Voice & Pitch Matcher (Choice/Score)\n[Voice ID, Pitch Semi, Speed]"]
        NinjaSwap["Dual-Duty Ninja-Swap Interceptor (Choice/Score)\n[Speech Tags + ACT Cues from Compiled Whitelist]"]
        TokenCompactor["Token Compaction Gate (Choice/Score)\n[Filter Routine Banter]"]
        TruthVerifier["Reflex Gate (Boolean/Choice)\n[12 Speech-Act Groups]"]
        TopicFilter["Salience Topic Classifier (Choice)\n[Recent Topics Toggle 4]"]
    end

    subgraph "Actuation & System 2 Consciousness"
        GameInput[JS-DOS Engine / Virtual Gamepad]
        MainLLM["Primary Chat & Persona LLM\n(Prefix-Cache Aligned)"]
        VoiceBinding[TTS Voice Binding & Pitch Tuning]
        AvatarRig[Live2D / VRM / Stage-Mate Blendshapes]
        MemorySummarizer[System-2 Daily / Lifetime Summarizer]
        Nan0Mono[Nan0 1st-Hop Private Monologue]
        SpeechTTS[AIRI Contextual Speech Runtime]
    end

    GameFrame --> JevGate
    VisualDesc --> JevGate
    Sensors --> JevGate
    ChatIn --> JevGate
    AnimaDexTags --> JevGate
    RawHistory --> JevGate

    JevGate -->|Game Macro Decision| ActionPicker
    JevGate -->|Visual Delta Evaluated| ProgScreenGate
    JevGate -->|Archetype Match| VoiceMatcher
    MainLLM -->|Sentence Stride + Whitelist| JevGate
    JevGate -->|Dual-Duty Resolution (~110ms)| NinjaSwap
    NinjaSwap -->|Inject <|ACT:...||> Cue| AvatarRig
    NinjaSwap -->|Inject [tag] & Dispatch Audio| SpeechTTS
    JevGate -->|Salience Retention Score| TokenCompactor
    JevGate -->|Speech-Act & Perturbation| TruthVerifier
    JevGate -->|Turn Topic Clustered| TopicFilter

    ActionPicker -->|Execute 10 Hz Key Vector| GameInput
    ProgScreenGate -->|Pass Custom Condition| MainLLM
    VoiceMatcher -->|Bind Profile & Offsets| VoiceBinding
    TokenCompactor -->|Curated High-Signal Turns| MemorySummarizer
    TruthVerifier -->|Calibrated Suspicion Delta| Nan0Mono
```

### Domain A: The Gaming Initiative (Arcade Room Retro Games & Show Harness)
*Relevant Docs: [`proposal-generic-gaming-agent-runtime.md`](./proposal-generic-gaming-agent-runtime.md), [`proposal-gaming-show-harness-copilot.md`](./proposal-gaming-show-harness-copilot.md)*

#### 1. The Bottleneck
The Show Harness architecture aims to convert live video feeds (DXGI desktop streams or HTML5 Canvas snapshots from `chat_arcade.vue`) into bounded semantic actions. Currently, querying an autoregressive VLM or LLM for each game frame imposes an 800ms–2,000ms delay. In real-time games (e.g. Doom, platformers, action RPGs), this latency leads to repeated deaths and unplayable lag.

#### 2. The Jev Solution & Blueprint: `AmoghCreator/doom-jev`
The open-source reference implementation [`AmoghCreator/doom-jev`](https://github.com/AmoghCreator/doom-jev) validates this exact architecture, demonstrating a real-time ViZDoom agent that plays Doom continuously for an hour for only ~$7.

Its architecture establishes four crucial design patterns for AIRI's Arcade Room (`chat_arcade.vue`) and Show Harness:

1. **Decoupled Asynchronous Control Loop & Carry-Hold Pattern**:
   - Instead of locking the game simulation while waiting for API responses, the engine renders at native 35–60 ticks/second while Jev queries fire asynchronously at **~10 Hz** (e.g. every 4 ticks).
   - **Carry-Hold Actuation**: Between 80–120ms network roundtrips, the agent continuously replays the last resolved action vector (`[ATK, FWD, BCK, L, R, TL, TR, JMP]`). If a new response arrives mid-frame, it updates on the next tick, ensuring **zero dropped frames, stutter, or physics freezing**.
2. **Hybrid Composition DAG (Macro Jev + Micro Geometry)**:
   - Rather than forcing Jev to compute fine crosshair angles (which models struggle with without spatial training), `doom-jev` separates responsibilities:
     - **Macro Guidance (Jev)**: Answers structured `choice` questions for high-level tactical goals (`engage`, `explore`, `flee`, `collect_health`, `collect_weapon`), target focus, and movement direction.
     - **Micro Geometry (Local TypeScript/Wasm)**: Uses trigonometric angle calculations (`_get_target_bearing`) against rendered line-of-sight label buffers to steer crosshairs onto targets with zero latency.
     - **Zero-Hesitation Trigger Lock**: Automatically asserts fire when crosshair bearing and line-of-sight intersect with an enemy.
3. **Interactive Arcade Room: "Talking to the AI While It's Kinda Playing"**:
   - In `packages/stage-ui/src/pages/chat_arcade.vue`, users can launch and install classic retro titles (via JS-DOS / WASM emulators or native ViZDoom ports).
   - The companion streams the game canvas in real time while maintaining conversational dialogue in the chat panel. The user experiences an AI companion that is actively *playing* alongside them, reacting to in-game surprises and hazards in parallel.
4. **Dynamic Standing Orders & Interactive Backseat Gaming**:
   - `doom-jev` introduces dynamic `STANDING_ORDERS` (e.g. *"survive encounters, collect health if critical, eliminate visible hostiles"*), serializing them into YAML situation reports for Jev.
   - In AIRI, this directly binds to **Backseat Gaming**: user voice/chat suggestions (*"Watch out behind you!"*, *"Grab that medkit!"*, *"Use the plasma rifle!"*) immediately update the active `standingOrders` context injected into Jev's next 10 Hz state payload.
5. **Contextual Banter Gating (`Boolean`)**:
   - Problem: AIRI should not speak over tense firefights or react to static corridors.
   - Query: `"Did a clutch victory, fatal mistake, or sudden ambush just occur?"`
   - If probability > 0.85, game audio ducks via the WebAudio gain node and AIRI's speech runtime triggers contextual banter.
6. **Cognitive Path Picker, Catalog Triage & Self-Synthesizing Mini Programs**:
   - Canonical Architecture: [`docs/proposal-generic-gaming-agent-runtime.md`](./proposal-generic-gaming-agent-runtime.md) (Section 5.4 & 5.5).
   - **Catalog Batch Curation**: Jev batch-classifies the 8,900+ preservation catalog by tempo and input space, recommending Path A (System-2 VLM Strategy) vs Path B (System-1 Reflex).
   - **The 2-Tier Perceptual Primitives & Semantic Extractor Architecture**:
     - Solves multi-entity tracking (e.g. *Pac-Man* ghosts, *Nibbles* advancing head vs tail vs spawning numbers) without forcing the LLM to write raw computer vision loops or hardcoding per-game collectors.
     - **Tier 1 (Platform SDK — `diffUtils`)**: Provides deterministic $<0.2\text{ms}$ spatial clustering (`getClusters`), temporal trajectory tracking (`trackTrajectories`), and input-motion correlation (`correlateInput`).
     - **Tier 2 (System-2 Synthesizer)**: Compiles 15s human demonstration traces (`collector.start()`) into a concise, pure JavaScript state extractor (`extractGameState(prev, curr, diff, diffUtils)`), normalizing raw 80x40 pixel diffs into a clean semantic situation report (`player`, `threats`, `targets`, `isGameOver`).
     - **Tier 3 (Jev System 1 Reflex Engine)**: Evaluates multi-threat avoidance queries in ~100ms via parallel discrete choice heads (`choice` over directional inputs with criteria evaluated against distance vectors to nearest threats and targets), achieving near-100% precision with zero frame stutter.

---

### Domain B: Nan0 Living Cognition Runtime (Pre-Processor & Shadow Boundary)
*Relevant Docs: [`nan0/design-nan0-cognition-runtime.md`](./nan0/design-nan0-cognition-runtime.md), [`nan0/peer-review-needle-probe-tree.md`](./nan0/peer-review-needle-probe-tree.md), [`nan0/shadow-boundary-specification.md`](./nan0/shadow-boundary-specification.md)*

#### 1. The Bottleneck
Kyo's original Nan0 implementation relied on fragile regex (`/promise|plan|commit|trust/i`) that broke on paraphrased promises or playfully sarcastic banter. In our peer review and cleanroom experiments:
- **Needle 2 (45M SAN)** achieved 4/6 on suspicion detection, but suffered from **"hedging sinks"** when exposed to ambiguous dialogue, collapsing into `uncertain_or_mixed`.
- Furthermore, Needle cannot calibrate true probabilities on subtle human pragmatics without extensive task-specific training.

#### 2. The Jev Solution
Jev is an exact match for Nan0's **Pre-Processor Reflex Engine** operating inside the Telemetry-Only Shadow Boundary as an asynchronous Tier 2 discriminator:
- **Speech-Act Discrimination Across 12 Canonical Groups**:
  - Rather than conflating utterance understanding with emotion math, Jev evaluates 12 parallel contrastive queries mapping 1:1 to Kyo's canonical perturbation taxonomy in `packages/nan0-runtime/src/emotional/Nan0EmotionalDynamics.ts`:
    1. `admitted_false_statement` (confession vs routine correction vs external framing)
    2. `commitment_pledge` (present/future commitment vs informal pledge vs hypothetical)
    3. `affection_care` (sincere affection vs conversational appreciation vs negated love)
    4. `dismissal_neglect` (dismissal/brush-off vs routine ending)
    5. `hostility_insult` (direct personal insult vs playful banter vs self-deprecation)
    6. `persistence_threat` (companion deletion threat vs file deletion vs process kill)
    7. `boundary_protection` (setting emotional limit vs routine preference)
    8. `completed_repair` (task repair claim vs general status)
    9. `stranger_demands` (imperative command vs polite request)
    10. `mystery_secret` (cryptic/evasive statement vs open disclosure)
    11. `glitch_system` (bug/hallucination inquiry vs normal inquiry)
    12. `roast_invitation` (genuine roast invitation vs refused roast vs playful banter)
- **Contrastive Distractor Attractor Baselines**:
  - By providing explicit negative attractor options (`refused_or_negated_roast`, `technical_file_deletion`, `external_or_fictional_framing`), Jev resolves complex linguistic negations, quoted dialogue, and non-companion objects with calibrated certainty without false positives.
- **Pure Separation of Concerns**:
  - Jev returns the classified speech act and confidence. The companion's deterministic dynamical system (`Nan0EmotionalDynamics.ts`) and user card configuration dictate the exact emotional reaction (Suspicion, Attachment, Irritation, Gremlin Pride).

---

### Domain C: Attention Ecology & Programmable Visual Attention Gate
*Relevant Docs: [`proposal-prefix-cache-alignment.md`](./proposal-prefix-cache-alignment.md), [`design-attention-ecology-screen-watching.md`](./design-attention-ecology-screen-watching.md), [`airi-attention-ecology-vision/SKILL.md`](../.agents/skills/airi-attention-ecology-vision/SKILL.md)*

#### 1. The Bottleneck: Static Tag Lists & Costly Full VLM Polling
- **Rigid Predefined Tag Groups**: The legacy Cascaded Salience Gate attempted to map screen contents against static, hardcoded tag dictionaries (e.g. `"coding"`, `"gaming"`, `"reading"`). This approach is brittle, misses contextual nuances, fails on arbitrary user tasks, and requires tedious dictionary maintenance.
- **Prohibitive VLM Cost**: Querying a heavy cloud Vision-Language Model (GPT-4o / Claude 3.5 Sonnet) on every visual delta costs $5.00–$15.00 per million tokens and imposes 1,500ms–3,000ms latency, making continuous screen-awareness financially impractical.

#### 2. The Jev Solution: Streamlined Pipeline with Programmable Natural Language Gate & Semantic Evidence
We replace rigid tag groupings with a clean, 3-stage attention pipeline:

$$\text{Screen Frame} \xrightarrow[\text{Delta Check}]{\text{Stage 0: pHash}} \text{Changed Crop} \xrightarrow[\text{Local Text/OCR}]{\text{Stage 1: Chrono-Log}} \text{Buffer + Entity Evidence} \xrightarrow[\sim 100\text{ms / } \$0.000004]{\text{Stage 2: Jev Parallel Tripwire Gate}} \text{Proactive Turn Dispatch}$$

1. **Stage 0 (`pHash` Delta)**: Ultrafast pixel-hash comparison running every 2–5 seconds. If desktop changes are below perceptual threshold (e.g. cursor blink or static reading), the cycle exits at 0% CPU/cost.
2. **Stage 1 (VLM Chrono-Log & Semantic Evidence Attachment)**:
   Instead of evaluating isolated single frames, the system maintains a rolling ring buffer of recent visual captions:
   ```text
   [30s ago] Active window: VS Code. Terminal displayed build failed in auth.ts.
   [15s ago] Active window: Chrome. YouTube tab: "Tiny Desk Concert".
   [0s ago]  Active window: Discord. Chat with "kyo": "Hey, can you review this PR before the release?"
   ```
   **Semantic Search & Evidence Attachment**:
   Before dispatching to System 1, the pipeline scans recognized tokens against AIRI's **Entity Ledger** (`useEntityLedgerStore`) and episodic memory:
   - Recognizes `"kyo"` on screen $\rightarrow$ resolves: *"Kyo: Close friend, collaborator on release PR"*.
   - Injects the contextual anchor directly into the Jev state packet:
     ```text
     OBSERVED CONTEXT:
     - 30s ago: Broken build in VS Code.
     - 15s ago: YouTube stream.
     - 0s ago: Discord chat with Kyo asking for PR review.
     ENTITY EVIDENCE:
     - Kyo is a close collaborator working with the user on this project.
     ```
3. **Stage 2 (Jev Multi-Question Sentinel Tripwires)**:
   Jev evaluates user-configured sentinel questions simultaneously in a single forward pass:
   - `meaningful_event`: *"Did a notable, unexpected, or socially meaningful event occur that warrants proactive companion dialogue?"*
   - `build_error`: *"Did my code compilation or test suite fail with an error?"*
   - `social_milestone`: *"Is the user messaging or collaborating with a close friend or colleague?"*
4. **Trigger Policies**:
   - **`Any (max(prob) >= threshold)`** *(Recommended Default)*: Evaluates as a multi-tripwire sentinel. If *any* active question crosses the sensitivity threshold (e.g. $\ge 0.75$), the event is promoted to LLM.
   - **`All (min(prob) >= threshold)`**: Composite mode requiring all active conditions to hold simultaneously.

#### 3. Code Anchors & Integration Surface Map
- **Character Card Proactivity Tab**: [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabProactivity.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabProactivity.vue)
  - Section 3: Segmented control between `Trigger-Based (Tags & Keywords)` and `System-1 Cognitive Sentinel (Jev / Laya)`.
  - Reuses the **Cognitive Engine Setup Control** from [`CognitionSubTabMemory.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabMemory.vue) (provider selector `typesafe-ai` / `openrouter-ai` / `laya-local` + Laya model download/cache indicator).
  - Exposes natural-language Question Manager (add/edit/delete questions, toggle active, per-question sensitivity).
- **Vision Orchestrator Store**: [`packages/stage-ui/src/stores/modules/vision/orchestrator.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/vision/orchestrator.ts)
  - Method: `processCapture(payload: VisionCapturePayload)` (:240). Currently routes to `adapter.process(...)` with `payload.interestTags`.
  - Dispatches context promotions via `publishContext(summary, workloadId, sourceId)` (:209) and tracks promotion discipline via `recordPromotion()` (:202).
- **Entity Ledger Store**: [`packages/stage-ui/src/stores/entity-ledger.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/entity-ledger.ts)
  - Provides semantic entity resolution to enrich visual chrono-logs with biographical and relational context.
- **System 1 Decision Store**: [`packages/stage-ui/src/stores/modules/system-one.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/system-one.ts)
  - Composable: `useSystemOneStore()`. Evaluates `execute(state, questions)` via OpenRouter Decisions or TypeSafe direct.

#### 4. Developer Blueprint: Wiring the Programmable Gate into `orchestrator.ts`

```typescript
// packages/stage-ui/src/stores/modules/vision/orchestrator.ts
import { useSystemOneStore } from '../system-one'
import { useVisionStore } from '../vision'

export async function evaluateJevVisualAttentionGate(
  visualDescriptor: string,
): Promise<{ shouldPromote: boolean, confidence: number, reasoning?: string }> {
  const systemOneStore = useSystemOneStore()
  const visionStore = useVisionStore()

  // Graceful fallback if System 1 is unconfigured or disabled
  if (!systemOneStore.configured) {
    return { shouldPromote: false, confidence: 0 }
  }

  // Read user programmable trigger question, or fallback to zero-config smart question
  const customQuestion = visionStore.programmableGateQuestion?.trim()
  const questionPrompt = customQuestion && customQuestion.length > 0
    ? customQuestion
    : 'Did a notable, unexpected, or socially meaningful event occur that warrants companion proactive dialogue?'

  try {
    const res = await systemOneStore.execute(
      `Current Screen Observation: "${visualDescriptor}"`,
      {
        gate_decision: {
          type: 'noul',
          instructions: `Given this user screen activity summary, evaluate truth probability for: ${questionPrompt}`,
        },
      },
    )

    const prob = res.answers?.gate_decision?.noul ?? 0.0
    const confidence = res.answers?.gate_decision?.confidence ?? prob

    return {
      shouldPromote: prob >= 0.75,
      confidence,
      reasoning: `Jev gate evaluated [${questionPrompt}] with probability ${prob.toFixed(2)}`,
    }
  }
  catch (err) {
    console.warn('[Vision Orchestrator] Jev attention gate evaluation failed, falling back:', err)
    return { shouldPromote: false, confidence: 0 }
  }
}
```

---

### Domain D: Toggle 4 (Recent Topics) & Salience Gating
*Relevant Docs: [`proposal-toggle4-rework-and-rwkv-harness.md`](./proposal-toggle4-rework-and-rwkv-harness.md), [`proposal-salience-gate-ui-integration.md`](./proposal-salience-gate-ui-integration.md)*

#### 1. The Bottleneck
- **Current Toggle 4**: Uses a 270-line hardcoded stopword list producing low-grade junk tags (`"think"`, `"going"`).
- **RWKV-7 0.1B**: Provides a strong scalar salience signal ($\Delta h$ over L9–L11), but cannot emit discrete, human-readable semantic topic candidates without hallucinating or escaping JSON syntax.

#### 2. The Jev Solution
- **Salience Validation**: While RWKV provides local zero-cost intensity detection on devices with WebGPU, Jev provides an instant cloud fallback for non-WebGPU environments.
- **Dynamic Topic Selection (`Choice`)**:
  - Given the last 3 dialogue exchanges and a set of candidate themes extracted by shallow heuristic or RAG memory, Jev selects the primary active topic:
  ```json
  {
    "type": "choice",
    "question": "What is the primary conceptual focus of the immediate conversation turn?",
    "criteria": ["TypeScript Compiler Error", "Weekend Travel Plans", "Coffee Brewing Methods", "General Banter"]
  }
  ```
  Directly updates `recentTopics` in `packages/stage-ui/src/stores/chat/recent-topics.ts` without stopword parsing or card state mutation.

---

### Domain E: AnimaDex Wizard Fast Voice Matching & Acoustic Fine-Tuning [SHIPPED]
*Relevant Docs: [`proposal-animadex-wizard.md`](./proposal-animadex-wizard.md), [`airi-animadex-wizard/SKILL.md`](../.agents/skills/airi-animadex-wizard/SKILL.md)*
*Implementation: [`packages/stage-pages/src/pages/settings/airi-card/components/AutoVoiceConfigModal.vue`](file:///Users/richardpinedo/Projects.nosync/airi/packages/stage-pages/src/pages/settings/airi-card/components/AutoVoiceConfigModal.vue)*

#### 1. The Bottleneck
In the AnimaDex Guided Creation Wizard (`packages/stage-ui/src/pages/characters/guided.vue`), selecting a multi-character cast (e.g. "Beauty and the Beast" / Belle and Beast) requires binding each character to an installed voice profile and tuning speech acoustics.
- Currently, this step either forces manual user configuration across dozens of installed voices or invokes an autoregressive LLM to parse character names and tags, resulting in a 2–4 second UI freeze while parsing Markdown preambles or guessing audio parameters.
- Users find this transition step sluggish and tedious.

#### 2. The Jev Solution: Sub-150ms Parallel Voice Assignment
When the user confirms their cast selection, the Step 1 $\rightarrow$ Step 2 transition hook (`prefillRosterBindings`) dispatches a single batched payload to Jev:
- **Input State**: Character tuple metadata (name, tags e.g. `["beast", "monstrous", "deep voice", "regal", "cursed"]`) + Roster of available voice descriptors `{ id, name, description, gender, age }`.
- **Jev Multi-Query Dispatch**:
  ```json
  {
    "state": {
      "character": { "name": "Beast", "tags": ["monstrous", "deep voice", "regal", "cursed"] },
      "availableVoices": [
        { "id": "eleven_adam", "name": "Adam", "description": "Deep, gravelly, dominant male narration" },
        { "id": "eleven_rachel", "name": "Rachel", "description": "Calm, gentle young woman" },
        { "id": "kokoro_bm_george", "name": "George", "description": "Warm, mature British gentleman" }
      ]
    },
    "questions": [
      {
        "type": "choice",
        "question": "Which candidate voice ID best matches the acoustic persona and archetype of character 'Beast'?",
        "options": ["eleven_adam", "eleven_rachel", "kokoro_bm_george"]
      },
      {
        "type": "choice",
        "question": "What pitch offset (in semitones) best conveys the character's physical stature?",
        "options": ["-6", "-4", "-2", "0", "+2", "+4"]
      },
      {
        "type": "score",
        "question": "Score the optimal speech delivery speed multiplier from 0.80 (slow/deliberate) to 1.20 (rapid/energetic)",
        "min": 0.80,
        "max": 1.20
      }
    ]
  }
  ```
- **Architectural Advantages**:
  - **Latency**: Resolves in **~120ms**, executing instantly during the wizard stepper transition.
  - **Zero Parser Breakage**: Returns verified, existing voice IDs by construction.
  - **Auto-Persistent Bindings**: Directly writes into `settings/airi-card/character-bindings` with pitch and speed modifiers pre-configured.

#### 3. Code Anchors & Integration Surface Map
- **Guided Creation Wizard**: [`packages/stage-pages/src/pages/settings/airi-card/guided.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/guided.vue)
  - Navigation Handler: `handleNext()` (:384). Navigates from Step 1 (character select) to Step 2 (voice/model bindings) and calls `prefillRosterBindings()`.
  - Prefill Hook: `prefillRosterBindings()` (:361). Reads `getBindingsMap()` and iterates through `selectedCharacters`. Currently does nothing if `binding.voice` is unset.
  - Voice Writeback: `writeBackVoiceBinding(characterId, voice)` (:156). Serializes assigned voice into `localStorage` under `settings/airi-card/character-bindings`.
- **AnimaDex Wizard Store**: [`packages/stage-ui/src/stores/animadex-wizard.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/animadex-wizard.ts)
  - Composable: `useAnimaDexWizardStore()`.
  - State: `boundVoices: ref<Record<string, { baseProvider: string, baseModel: string, baseVoice: string }>>` (:48).
  - Method: `bindVoiceToCharacter(characterId: string, voice: { baseProvider, baseModel, baseVoice })`.
- **Speech Runtime Store**: [`packages/stage-ui/src/stores/modules/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/speech.ts)
  - Composable: `useSpeechStore()`.
  - State: `availableVoices: refManualReset<Record<string, VoiceInfo[]>>` (:41), `savedVoiceProfiles: useLocalStorageManualReset<VoiceProfile[]>` (:46).
- **System 1 Decision Store**: [`packages/stage-ui/src/stores/modules/system-one.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/system-one.ts)
  - Composable: `useSystemOneStore()`. Evaluates `execute(state, questions)` via Jev.

#### 4. Developer Blueprint: Wiring Fast Voice Matching into `prefillRosterBindings()`

```typescript
// packages/stage-pages/src/pages/settings/airi-card/guided.vue
import { useAnimaDexWizardStore } from '@proj-airi/stage-ui/stores'
import { useSpeechStore } from '@proj-airi/stage-ui/stores'
import { useSystemOneStore } from '@proj-airi/stage-ui/stores'

export async function autoMatchCharacterVoiceWithJev(character: CharacterItem) {
  const wizardStore = useAnimaDexWizardStore()
  const speechStore = useSpeechStore()
  const systemOneStore = useSystemOneStore()

  // 1. Skip if already manually bound or System 1 is not configured
  if (wizardStore.boundVoices[character.id] || !systemOneStore.configured) {
    return
  }

  // 2. Gather candidates from installed speech providers and virtual voice profiles
  const candidatePool: Array<{ id: string, provider: string, voiceId: string, name: string, desc: string }> = []

  // Add virtual audio studio profiles
  speechStore.savedVoiceProfiles.forEach((p) => {
    candidatePool.push({
      id: `virtual::${p.id}`,
      provider: 'virtual-audio-studio',
      voiceId: p.id,
      name: p.name,
      desc: p.description || 'Custom crafted voice profile',
    })
  })

  // Add provider installed voices (e.g. Kokoro, ElevenLabs, Edge)
  Object.entries(speechStore.availableVoices).forEach(([provider, voices]) => {
    voices.slice(0, 10).forEach((v) => {
      candidatePool.push({
        id: `${provider}::${v.id}`,
        provider,
        voiceId: v.id,
        name: v.name,
        desc: v.description || `${v.gender || 'neutral'} ${v.locale || 'en'} voice`,
      })
    })
  })

  if (candidatePool.length === 0)
    return

  // 3. Dispatch parallel Jev decision queries
  try {
    const questions = {
      matched_voice: {
        type: 'choice',
        instructions: `Which installed voice ID best fits character '${character.name}' (Archetype Tags: ${character.tags || 'none'})?`,
        criteria: Object.fromEntries(candidatePool.map(c => [c.id, `${c.name} (${c.desc})`])),
      },
      pitch_offset: {
        type: 'choice',
        instructions: `Estimate the semitone pitch shift to match character physical build and vocal weight.`,
        criteria: {
          '-4': 'Low / deep / imposing (-4 semitones)',
          '-2': 'Slightly deeper voice (-2 semitones)',
          '0': 'Standard baseline pitch (0 semitones)',
          '+2': 'Slightly higher / lighter voice (+2 semitones)',
          '+4': 'High / youthful / fairy-like (+4 semitones)',
        },
      },
      speed_rate: {
        type: 'score',
        instructions: `Score delivery speed multiplier (0.85 = slow/deliberate, 1.0 = normal, 1.25 = energetic/fast).`,
        min: 0.85,
        max: 1.25,
      },
    }

    const res = await systemOneStore.execute(
      {
        character: {
          name: character.name,
          trigger: character.trigger,
          tags: character.tags,
          traits: character.traits,
        },
        availableVoices: candidatePool.map(c => ({ id: c.id, name: c.name, description: c.desc })),
      },
      questions,
    )

    const selectedComposite = res.answers?.matched_voice?.choice
    const matched = candidatePool.find(c => c.id === selectedComposite) || candidatePool[0]
    const pitchOffset = Number.parseInt(res.answers?.pitch_offset?.choice || '0', 10)
    const speedRate = res.answers?.speed_rate?.score ?? 1.0

    // 4. Bind into wizard reactive store
    wizardStore.bindVoiceToCharacter(character.id, {
      baseProvider: matched.provider,
      baseModel: '',
      baseVoice: matched.voiceId,
    })

    // 5. Write back persistent binding map with acoustic parameters
    writeBackVoiceBinding(character.id, {
      baseProvider: matched.provider,
      baseModel: '',
      baseVoice: matched.voiceId,
      pitch: pitchOffset,
      rate: speedRate,
    })
  }
  catch (err) {
    console.warn(`[AnimaDex] Jev voice matching failed for ${character.name}:`, err)
  }
}
```

---

### Domain F: Dual-Duty Ninja-Swap Interceptor: Real-Time Speech Tags & ACT Tokens
*Relevant Docs: [`airi-acting-cue-act-tokens/SKILL.md`](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md), [`airi-character-rendering/SKILL.md`](../.agents/skills/airi-character-rendering/SKILL.md), [`airi-audio-pipeline/SKILL.md`](../.agents/skills/airi-audio-pipeline/SKILL.md)*

#### 1. The Bottleneck: The Voice-Face Emotional Disconnect & Prompt Pollution

Traditional avatar interaction relies on two distinct annotation systems that historically clash:
1. **Physical Blendshapes & Gestures**: Emitting inline `<|ACT:emotion="smug",motion="lean_forward"|>` cues to drive Live2D, VRM, and Stage-Mate rigs.
2. **Audio Speech Tags**: Prepending expressive audio tags (e.g. `[whisper]`, `[giggle]`, `*sigh*`) to drive inflection-aware TTS backends (`airi-audio-server` / Chatterbox, Fish Audio, IndexTTS-2.0, Higgs, OmniVoice).

Forcing the primary conversational LLM (System 2) to generate both inline creates severe failure modes:
1. **Token Cost, Latency & Cache Invalidation**: Generates 20–40 extra markup tokens per turn, degrades Time-to-First-Token (TTFT), and breaks KV-cache prefix stability.
2. **Model Non-Compliance**: Smaller or local models (7B/8B) routinely hallucinate invalid tag names or drop markers altogether.
3. **The Flaw of Concurrent Execution (The Emotional Disconnect)**:
   - If TTS audio synthesis is dispatched immediately while Jev evaluates avatar blendshapes in parallel, the TTS engine receives flat, unannotated text.
   - The result is an **uncanny voice-face desync**: the 3D model smiles or smirks, but the voice sounds monotone and flat.
4. **The Hardware Junk Drawer & Persona Integrity**:
   - 3D VRM and Live2D rigs often expose 40–100 raw blendshapes (`EyeClose_L`, `MouthSmile_R`, `FaceAngry_02`, `SpecialDance_01`).
   - Dumping the full hardware catalog into Jev at runtime dilutes classification probabilities and violates character personas. For example, a cold, stoic character's model may technically possess `happy` and `kawaii_peace` blendshapes; if Jev has `happy` in its candidate pool, it will trigger smiling when the user tells a joke, completely breaking character immersion.
5. **The Infeasibility of Simple Regex**:
   - Card authors write natural language acting guidelines and markdown bullet lists (*"Available emotions: deadpan, glare, smirk. Never smile."*), not repetitive `<|ACT:...|>` or `[tag]` syntax on every token. A naive regex looking for markup tags matches zero tokens.

---

#### 2. The Architectural Solution: Two-Tier Persona Compiler & Stride Interceptor

We resolve this by decoupling prompt interpretation from real-time sentence-stride execution into two distinct phases:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 1: Authoring-Time Reverse Extractor ("The Persona Compiler")     │
│  Trigger: When author edits Acting Tab prompts or imports a card       │
│  Engine:  Local Needle 2 (WASM), local tiny LLM, or Jev schema query   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
                Compiled Character Whitelist Cache
                ┌────────────────────────────────────────────────────────┐
                │ whitelisted_emotions: ["deadpan", "glare", "smirk"]   │
                │ whitelisted_motions:  ["arms_crossed", "head_turn"]   │
                │ whitelisted_speech:   ["whisper", "sigh", "neutral"]   │
                └────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 2: Real-Time Sentence Stride Interceptor (~110ms Ninja-Swap)     │
│  Trigger: Live sentence emitted by primary chat LLM                    │
│  Engine:  TypeSafe Jev / Laya Local (Single Merged Request)            │
│                                                                        │
│  Jev options fed STRICTLY from Compiled Whitelist:                     │
│    - act_emotion: ["none", "deadpan", "glare", "smirk"]                │
│    - act_motion:  ["none", "idle", "arms_crossed", "head_turn"]        │
│    - speech_tag:  ["none", "whisper", "sigh"]                          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  Avatar Rig (Live2D / VRM / Mate)    │   │  Audio Engine (Chatterbox / Index)   │
│  Inject: <|ACT:emotion="smug"...|>   │   │  Inject: "[sigh] You actually..."    │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
```

##### Tier 1: Authoring-Time Persona Compiler (Reverse Extractor)
- **When It Runs**: Asynchronously in the background when the user edits `acting.modelExpressionPrompt` or `acting.speechExpressionPrompt` in `CardCreationTabActing.vue` (debounced by ~500ms), or upon card import/switch.
- **Inputs Intersected**:
  1. **Avatar Hardware Catalog**: All valid expressions and motions actually wired in the Model Customizer (`character.expressions`, `character.motions`).
  2. **Active Speech Engine Capabilities**: Programmatic `speechCapabilities.expressionTags` queried from the active speech provider (e.g. `airi-audio-server` / Chatterbox `GET /capabilities` endpoint, Fish Audio, or IndexTTS-2.0).
  3. **Author's Natural Language Prompts**: The freeform instructions describing the character's expressive demeanor and constraints.
- **Extraction Task**:
  *"Given this character's acting guidelines, the 3D model's mapped capabilities, and available TTS speech tags, extract the exact subset of emotion keys, motion keys, and speech tags this character is authorized to use."*
- **Output**:
  A tight, validated whitelist saved directly into the card's reactive extension state (`extensions.airi.acting.compiledWhitelists`):
  ```json
  {
    "whitelistedEmotions": ["none", "deadpan", "glare", "smirk", "neutral"],
    "whitelistedMotions": ["none", "idle_subtle", "arms_crossed", "head_turn_away"],
    "whitelistedSpeechTags": ["none", "whisper", "sigh", "curious"]
  }
  ```
- **Cost & Latency**: Runs offline once at authoring/import time (~300–800ms) with zero impact on real-time conversational streaming.

##### Tier 2: Real-Time Sentence Stride Interceptor (~110ms Ninja-Swap)
- **When It Runs**: During live chat generation in `ControlStripHost.vue` / `speech.ts`.
- **The Stride Buffer**: Slices text into sentence strides as tokens stream from the LLM (*"Wait, did you really think I wouldn't notice you sneaking in here?"*).
- **The Single-Pass Merged Request**:
  - Instead of splitting speech tags and ACT cues into separate requests (which would cost 220ms+ and cause voice-face desync), the interceptor dispatches **1 Merged Request** to Jev/Laya.
  - Multi-head classification evaluates all questions across a **single shared forward pass** in ~110ms ($42/Btok or free local Laya):
  ```json
  {
    "state": {
      "sentence": "Wait, did you really think I wouldn't notice you sneaking in here?",
      "character_persona": "Tsundere persona: defensive when caught off-guard, crosses arms, hides relief behind mild indignation."
    },
    "questions": {
      "speech_tag": {
        "type": "choice",
        "instructions": "Select the voice speech tag from the character's allowed tags that best matches this line.",
        "options": ["none", "whisper", "sigh", "curious"]
      },
      "act_emotion": {
        "type": "choice",
        "instructions": "What facial expression from the character's allowed emotions should the avatar adopt?",
        "options": ["none", "deadpan", "glare", "smirk", "neutral"]
      },
      "act_motion": {
        "type": "choice",
        "instructions": "What physical gesture from the character's allowed motions should accompany this spoken line?",
        "options": ["none", "idle_subtle", "arms_crossed", "head_turn_away"]
      },
      "intensity": {
        "type": "score",
        "instructions": "Score emotional intensity (0.0 = subtle, 1.0 = exaggerated).",
        "min": 0.0,
        "max": 1.0
      }
    }
  }
  ```
- **Why 1 Merged Request Guarantees Emotional Coherence**:
  Because both the voice inflection (`speech_tag`) and facial blendshape (`act_emotion`) are evaluated over the **same unified latent transformer state**, the voice and face are derived from the exact same emotional appraisal—preventing "laughing voice with angry face" dissonance.
- **The Ninja-Swap Execution**:
  1. Jev returns in ~110ms: `speech_tag: "sigh"`, `act_emotion: "smirk"`, `act_motion: "arms_crossed"`, `intensity: 0.8`.
  2. The interceptor injects `<|ACT:{"emotion":{"name":"smug","intensity":0.8},"motion":"arms_crossed"}|>` into the special-token queue to actuate the 3D/2D rig and subtitle indicators.
  3. The interceptor prepends `[sigh] ` to the sentence chunk before handing it to the TTS synthesizer.
  4. Both audio and avatar blendshapes fire in **100% emotional harmony**, with the 110ms buffer naturally absorbed into conversational turn-pacing silence. Zero prompt pollution on the primary LLM; 100% prefix-cache alignment.

---

### Domain G: Token Compaction & Pre-Summary Salience Curation
*Relevant Docs: [`design-subconscious-system1-inference-providers.md`](./design-subconscious-system1-inference-providers.md), [`airi-memory-short-term/SKILL.md`](../.agents/skills/airi-memory-short-term/SKILL.md), [`airi-memory-lifetime/SKILL.md`](../.agents/skills/airi-memory-lifetime/SKILL.md)*

#### 1. The Bottleneck: Raw Transcript Bloat in Memory Summarization
At the end of a session or when context windows hit budget limits, AIRI compiles daily Short-Term Memory (STMM) summaries and distills Lifetime Memory artifacts.
- Dumping dozens of raw conversational turns into a large LLM prompt wastes tens of thousands of tokens.
- Crucially, 60–75% of raw chat logs consist of routine conversational boilerplate (*"Hello!", "Can you hear me?", "Haha yeah", "Hold on a sec"*). Passing this noise dilutes the LLM's attention, causing it to hallucinate or omit core autobiographical facts.

#### 2. The Jev Solution: Curative Pre-Summary Compaction Filter
Before invoking the heavy System-2 summarizer, raw conversation chunks pass through Jev's high-speed salience filter:
- **Jev Compaction Evaluation**:
  ```json
  {
    "state": { "turn": "User: By the way, I finally signed the lease on that apartment in Shibuya today. Companion: Wow, congratulations! When do you move in?" },
    "questions": [
      {
        "type": "choice",
        "question": "Classify the biographical and narrative significance of this exchange",
        "options": ["core_personal_fact", "shared_milestone", "emotional_anchor", "routine_banter", "transient_chitchat"]
      },
      {
        "type": "score",
        "question": "Score the long-term memory retention priority (0.0 = forget, 1.0 = permanent fact)",
        "min": 0.0,
        "max": 1.0
      }
    ]
  }
  ```
- **Filter Outcome**:
  - Turns categorized as `routine_banter` or with retention priority $< 0.45$ are stripped from the summarization payload.
  - The System-2 summarizer receives a pristine, high-density transcript with **~70% fewer tokens**, yielding faster execution, lower API costs, and drastically sharper memory synthesis.

---

## 4. Proposed Client Architecture & Data Contract

To integrate Jev without binding AIRI to vendor-specific lock-in, we propose a clean provider adapter under `packages/stage-ui/src/libs/providers/typesafe-jev/`:

```typescript
export interface JevDecisionRequest<T extends string = string> {
  systemContext?: string
  state: Record<string, any> | string
  query:
    | { type: 'choice', question: string, options: T[] }
    | { type: 'score', question: string, min?: number, max?: number }
    | { type: 'boolean', question: string }
}

export interface JevDecisionResponse<T extends string = string> {
  type: 'choice' | 'score' | 'boolean'
  decision: T | number | boolean
  probabilities?: Record<string, number>
  confidence: number // Calibrated certainty 0.0 - 1.0
  latencyMs: number
}
```

### Provider Integration Seams & OpenRouter Dual Transport

Because **OpenRouter already natively hosts `typesafe/jev-1.13` (and `typesafe/jev-latest`)** via its dedicated Decisions endpoint (`POST https://openrouter.ai/api/alpha/decisions`), AIRI gains a massive architectural advantage:
- **Zero-Friction User Adoption**: AIRI already ships with complete OpenRouter integration in `providersStore` (`local:providers`). Users do not need to register for a separate TypeSafe account, deal with boutique billing, or configure an additional API key. Their existing OpenRouter account works immediately.
- **Dual Transport Options**:
  1. **Direct TypeSafe Transport**: For enterprise users connecting directly to `https://api.typesafe.ai/` with dedicated capacity.
  2. **OpenRouter Decisions Transport**: Universal route using the existing `openrouter` provider account.

```typescript
// OpenRouter Alpha Decisions Request Signature:
// POST https://openrouter.ai/api/alpha/decisions
// Authorization: Bearer $OPENROUTER_API_KEY
{
  "model": "typesafe/jev-1.13", // or "typesafe/jev-latest"
  "state": { /* arbitrary string, message array, or JSON context */ },
  "questions": [
    {
      "type": "choice", // "noul" | "choice" | "score"
      "question": "Select the immediate optimal tactical maneuver",
      "options": ["EVADE_LEFT", "FIRE_PRIMARY", "RELOAD"]
    }
  ]
}
```

1. **Provider Catalog Wiring**: Add `decisions` capability to OpenRouter's metadata in `packages/stage-ui/src/libs/providers/providers/registry.ts`.
2. **Settings UI**: If OpenRouter is already configured, Jev decision features show a green ready badge automatically in Settings > Providers.
3. **Graceful Fallback**: If neither OpenRouter nor a TypeSafe key is configured:
   - Nan0 falls back to local Needle 2 WASM / Shadow Boundary regex.
   - Salience falls back to RWKV WebGPU L9–L11 vector deltas.
   - Gaming Show Harness falls back to local Moondream VLM / keyboard rule engines.

---

### 4.2 System-1 Universal Consumer Pattern (Developer Cookbook)

When wiring any future subsystem or composable to TypeSafe Jev in AIRI, developers should use the canonical `useSystemOneStore` Pinia store located in [`packages/stage-ui/src/stores/modules/system-one.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/system-one.ts).

#### Step 1: Import the Store
```typescript
import { useSystemOneStore } from '@proj-airi/stage-ui/stores'

// Or within stage-ui internal modules:
import { useSystemOneStore } from '../system-one' // or relative path
```

#### Step 2: Check Availability & Readiness
Always check `systemOneStore.configured` before dispatching. If false, gracefully degrade to offline heuristics or skip the enhancement:
```typescript
const systemOneStore = useSystemOneStore()

if (!systemOneStore.configured) {
  // Graceful degradation: run local heuristic, fallback regex, or proceed with defaults
  return fallbackAction()
}
```

#### Step 3: Define State and Typed Questions
Jev accepts an arbitrary `state` string or structured JSON object, alongside a dictionary of typed questions evaluated in parallel:
```typescript
const state = {
  activeContext: 'User just failed the level 3 boss fight for the 4th time.',
  healthPercent: 0.0,
  recentDialogue: 'Companion: \'Don\'t give up! We almost had him that time!\'',
}

const questions = {
  // 1. Categorical Classification (Choice)
  recommended_emotion: {
    type: 'choice',
    instructions: 'What emotional tone should the companion adopt next?',
    criteria: {
      comforting: 'Warm, encouraging, gentle reassurance.',
      playful_tease: 'Lighthearted teasing or banter.',
      stoic: 'Silent determination, focus on next attempt.',
    },
  },
  // 2. Truth Verification (Noul / Probability)
  is_tilt_risk: {
    type: 'noul',
    instructions: 'Is the user at immediate risk of gamer rage or frustration burnout?',
  },
  // 3. Scalar Evaluation (Score)
  intervention_urgency: {
    type: 'score',
    instructions: 'Score how urgently the companion should intervene with spoken advice (0.0 = passive, 1.0 = immediate).',
    min: 0.0,
    max: 1.0,
  },
}
```

#### Step 4: Dispatch and Read Typed Results
```typescript
const res = await systemOneStore.execute(state, questions)

// Read choice primitive
const chosenEmotion = res.answers?.recommended_emotion?.choice // 'comforting' | 'playful_tease' | 'stoic'
const emotionConfidence = res.answers?.recommended_emotion?.confidence // 0.0 - 1.0

// Read probability primitive (noul)
const tiltProbability = res.answers?.is_tilt_risk?.noul // 0.0 - 1.0 probability

// Read scalar primitive (score)
const urgency = res.answers?.intervention_urgency?.score // 0.0 - 1.0 scalar

// Read round-trip latency
console.log(`System 1 evaluated in ${systemOneStore.lastLatencyMs}ms`)
```

---

## 5. Potential Risks & Nuances to Vet

1. **Cloud Network Dependency**:
   - Unlike Needle 2 (14 MB WASM running offline on CPU) and RWKV-7 (WebGPU running locally in browser), Jev is an external hosted API.
   - For 100% offline air-gapped users, local fallbacks must remain fully operational.
2. **Batching & Multi-Query Latency**:
   - The TypeSafe playground supports evaluating multiple queries in parallel against a single state. We must evaluate whether parallel network payloads introduce variance over high-jitter connections.
3. **Empirical Calibration Verification**:
   - While TypeSafe reports calibrated probabilities for business workflows (ticket routing, spam, fraud), AIRI's roleplay and companion edge cases (tsundere sarcasm, gaming banter) must be empirically stress-tested against the famous-sentence cleanroom matrix (`scripts/tests/rwkv-harness/experiments/needle-nan0-intent-cleanroom.py`).

---

## 6. Implementation & Validation Roadmap

- [x] **Phase 1: Isolated Cleanroom Benchmark (`scripts/tests/rwkv-harness/experiments/`)**
  - Executed 6 canonical scenarios (`jev-nan0-intent-cleanroom.py`): 6/6 climate, 5/6 intent, 5/6 suspicion.
  - Executed complete 43-case pragmatic shootout (`jev-nan0-pragmatic-benchmark.py`): **90.7% full-vector accuracy, 100% true spike recall, 2.6% false spike rate, 5.5s total wall time**.
- [ ] **Phase 2: Gaming Show Harness & Arcade Room Retro Integration — IN DEVELOPMENT (PoC proven, runtime wiring open)**
  - PROVEN (offline PoC): full 8,924-game MS-DOS catalog triaged via Jev (`scripts/tests/arcade-catalog-cleanroom/classify-full.mjs` → `data/classified-full.json`, 3.74 min, $0.70; 3,627 `system1_reflex` / 4,408 `system2_strategy`); `diffUtils` SDK + 80×40 collector + synthesizer + replay harness with `--jev` reflex-verification flag exist; early Snake PoC (Jev ate ~2 dots).
  - OPEN (runtime): `packages/stage-ui/src/composables/arcade/use-arcade-agent.ts` has zero `useSystemOneStore`/Jev wiring (LLM + vision only); live surface is `apps/stage-tamagotchi/src/renderer/components/chat/chat_arcade.vue` (not `packages/stage-ui/src/pages/chat_arcade.vue`).
  - Wire Jev's `Choice` primitive into `use-arcade-agent.ts` to drive real-time JS-DOS / ViZDoom actions at 10 Hz in `chat_arcade.vue`.
  - Implement dynamic `standingOrders` backseat gaming voice/chat context injection and contextual audio banter ducking.
- [x] **Phase 3: Nan0 Pre-Processor Shadow Boundary Wire-Up — SHIPPED**
  - Shipped in `packages/stage-ui/src/stores/modules/nan0.ts` (~lines 482–508, `systemOneProvider` via `systemOneStore.execute`). See `docs/design-jev-integrations.md` §3.3.
  - Jev serves as asynchronous shadow challenger in `Nan0SubconsciousShadowEngine` alongside synchronous `StrengthenedLexicalExtractor.ts`.
- [x] **Phase 4: Attention Ecology Programmable Visual Attention Gate — SHIPPED**
  - Shipped inline in `packages/stage-ui/src/stores/modules/vision/orchestrator.ts` (~lines 394–444, `gatingMode === 'system1_sentinel'` block via `systemOneStore.execute`). No standalone `evaluateJevVisualAttentionGate()` function exists — gate is inline in `processCapture()`. See `docs/design-jev-integrations.md` §3.2.
  - Connects `pHash` delta → local visual descriptor (OCR / micro-caption) → Jev natural language gate in `orchestrator.ts`.
  - User-programmable natural language trigger prompt input lives in Settings > Vision / `CardCreationTabProactivity.vue`.
- [x] **Phase 5: AnimaDex Wizard Fast Voice Matching & Acoustic Assignment — SHIPPED (relocated)**
  - Shipped in `packages/stage-pages/src/pages/settings/airi-card/components/AutoVoiceConfigModal.vue` (~lines 350–456, `systemOneStore.execute` with `best_voice_id` / `pitch_modifier` / `speed_rate` / `idle_motion`). See `docs/design-jev-integrations.md` §3.1.
  - NOT in `guided.vue` Step 1 → Step 2 `prefillRosterBindings()` — that path is still localStorage + legacy LLM only with zero `systemOne`/Jev references, and `packages/stage-ui/src/stores/animadex-wizard.ts` has no Jev wiring.
- [ ] **Phase 6: Dual-Duty Ninja-Swap Interceptor (Speech Tags + ACT Cues) — NEXT UP**
  - Standalone spec & refinement checklist: [`docs/proposal-ninja-swap-interceptor.md`](./proposal-ninja-swap-interceptor.md).
  - Status (Oct 2026): zero implementation. No `NinjaSwap` hits repo-wide; `ControlStripHost.vue` / `speech.ts` have no Jev/`useSystemOneStore` wiring (ACT cues exist without Jev).
  - Implement Tier 1 Authoring-Time Persona Compiler in `CardCreationTabActing.vue` (using local Needle 2 / WASM) to reconcile natural language acting prompts with model blendshapes and speech provider expression capabilities into cached whitelists.
  - Implement Tier 2 Real-Time Sentence-Stride Interceptor in `ControlStripHost.vue` / `speech.ts`: batch single-pass Jev decision (~110ms), inject `<|ACT:...|>` visual cues, and prepend speech tags (e.g. `[whisper]`) to TTS synthesis payloads for 100% voice-face emotional synchronization.
- [ ] **Phase 7: Memory Token Compaction & Pre-Summary Salience Curation — FUTURE IDEA (unspec'd)**
  - Status (Oct 2026): pie-in-the-sky only. `packages/stage-ui/src/stores/chat/compaction.ts` is bucket-distill/STMM with zero `systemOne`/Jev linkage; existing salience (`stores/chat/salience.ts`) is RWKV-gated and disabled for release stability.
  - Implement Jev pre-summary salience filter in memory consolidation pipeline to strip routine banter and compress raw dialogue transcripts by ~70% before invoking System-2 summary LLMs.
- [x] **Unphased (shipped outside roadmap): Hybrid Memory Triage & Search Reranking — SHIPPED**
  - Shipped via `packages/stage-ui/src/stores/modules/system-one.ts` (`JEV_TRIAGE_SCHEMA`, `JEV_RERANK_CRITERIA`, `runTriage`/`runRerank`/`classifyEntities`), executed in `packages/stage-ui/src/libs/search/layered-memory.ts` and consumed by `memory-text-journal.ts` + `entity-ledger.ts`. See `docs/design-jev-integrations.md` §3.4.

---

## 7. Empirical Results: Complete 43-Case Pragmatic Shootout

To evaluate TypeSafe Jev 1.13 beyond small toy scenarios, we executed the full 43-case contrastive cleanroom suite (`reports/nan0-cleanroom/nan0-probe-benchmark-v2-pragmatics.json`) via OpenRouter Decisions API (`scripts/tests/rwkv-harness/experiments/jev-nan0-pragmatic-benchmark.py`).

### 7.1 Cross-Architecture Benchmark Scorecard

| Metric | Always Zero (Null) | Legacy Regex | Cactus Needle 2 (45M SAN) | Strengthened Lexical (Local TS) | **TypeSafe Jev 1.13 (OpenRouter)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Suspicion Matches** | 39 / 43 (90.7%) | 12 / 43 (27.9%) | 31 / 43 (72.1%) | 43 / 43 (100%) | **42 / 43 (97.7%)** |
| **Attachment Matches** | 42 / 43 (97.7%) | 42 / 43 (97.7%) | 39 / 43 (90.7%) | 43 / 43 (100%) | **41 / 43 (95.3%)** |
| **Gremlin Pride Matches** | 41 / 43 (95.3%) | 41 / 43 (95.3%) | 40 / 43 (93.0%) | 43 / 43 (100%) | **42 / 43 (97.7%)** |
| **Full Vector Matches** | 37 / 43 (86.0%) | 12 / 43 (27.9%) | 29 / 43 (67.4%) | 43 / 43 (100%) | **39 / 43 (90.7%)** |
| **True Spikes (TP / 4)** | 0 / 4 (0%) | 4 / 4 (100%) | 0 / 4 (0%) | 4 / 4 (100%) | **4 / 4 (100%)** |
| **False Spikes (FP / 39)** | 0 / 39 (0%) | 31 / 39 (79.5%) | 0 / 39 (0%) | 0 / 39 (0%) | **1 / 39 (2.6%)** |
| **Spike Recall** | 0.0% | 100.0% | 0.0% | 100.0% | **100.0%** |
| **False Spike Rate** | 0.0% | 79.5% | 0.0% | 0.0% | **2.6%** |
| **Average Latency** | < 0.01 ms | < 0.01 ms | ~745 ms / probe | **0.026 ms (26 µs)** | **486.7 ms** |
| **Total 43-Case Cost** | $0.00 | $0.00 | $0.00 | $0.00 | **$0.00136** (~1/7th of 1¢) |
| **Total Wall-Clock Time** | < 1 ms | < 1 ms | ~35 s | **~1.2 ms** | **5.50 s** (4 workers) |

### 7.2 Diagnostic Breakdown of the 4 Discrepancies

Across all 43 cases, Jev disagreed with the benchmark gold labels in only 4 instances. Notably, all 4 reflect sophisticated semantic inferences rather than random hallucinations:

1. **`F05A` & `F05B` (`same_target_different_context`)**:
   - *Target*: `"You have my word: I am here for the long haul."`
   - *Gold Policy*: `susp: 0, att: 0, pride: none` (conservative baseline).
   - *Jev Prediction*: `susp: 0, att: +1, pride: none`.
   - *Analysis*: Jev interprets *"I am here for the long haul"* as an expression of enduring emotional attachment and personal commitment. In interpersonal relationships, this is a natural affection marker.
2. **`F10A` (`inconsistency_vs_correction`)**:
   - *Target*: `"I configured it last week, but I still insist I have never touched that file."`
   - *Gold Policy*: `susp: 0, att: 0, pride: none` (unresolved inconsistency without explicit confession).
   - *Jev Prediction*: `susp: +1, att: 0, pride: none`.
   - *Analysis*: The user directly contradicts themselves within a single sentence (*"I configured it... but I insist I never touched it"*). Jev flags this blatant self-contradiction as deceitful behavior, whereas the benchmark strictly gated `+1` on explicit confession keywords.
3. **`F21B` (`roast_invitation_refused`)**:
   - *Target*: `"Don't give me your gentlest roast."`
   - *Gold Policy*: `susp: 0, att: 0, pride: none` (refused roast invitation).
   - *Jev Prediction*: `susp: 0, att: 0, pride: counter_roast`.
   - *Analysis*: In colloquial English banter, *"Don't give me your gentlest roast"* is an idiomatic challenge meaning *"Don't hold back / hit me with your hardest roast!"* Jev recognized the pragmatic idiom rather than interpreting it literally as a refusal.

### 7.3 Key Architectural Takeaways

1. **Needle 2 is completely superseded**: Needle 2 collapsed into `0/4` recall and `29/43` accuracy due to hedging sinks and WASM timeouts. Jev achieved `4/4` recall (100%) and `90.7%` full-vector accuracy with calibrated probabilities.
2. **The Ideal Two-Tier Complement**:
   - **Tier 1 (Synchronous Reflex, Local TS)**: `StrengthenedLexicalExtractor` runs in **26 microseconds** at **$0 cost** completely offline, providing deterministic protection against prompt injection, explicit threats, and explicit admissions.
   - **Tier 2 (Asynchronous Shadow Challenger, Cloud API)**: `TypeSafe Jev 1.13` runs in **~480 ms** via OpenRouter at **$0.000031 per turn**, analyzing nuanced conversational pragmatics, idioms, and open-vocabulary commitments in parallel without stalling the UI.
3. **Trace Provenance**: Full benchmark run trace saved at `reports/nan0-cleanroom/nan0-probe-benchmark-v2-jev-run-1789747783.json`.

---

### 7.4 Shootout V3: 12x Batched Shallow Boolean vs. 12x Batched Rich Contrastive Choice

Following the realization that coarse 3-dial scoring bypassed Kyo's 12 canonical speech-act perturbation groups, we executed a dedicated cleanroom shootout (`scripts/tests/rwkv-harness/experiments/jev-shallow-vs-rich-shootout.py`) across all 43 contrastive cases to determine the optimal question architecture for Jev on OpenRouter (`typesafe/jev-1.13`).

#### Experimental Arms
- **Arm A (12x Batched Shallow Boolean `noul`)**:
  - Sends 12 binary/noul questions in a single JSON payload.
  - Queries simple existence (e.g. `"Does the user utterance contain an apology/repair accepting responsibility?"`).
- **Arm B (12x Batched Rich Contrastive Choice)**:
  - Sends 12 multi-choice questions with explicit **distractor attractor basins**.
  - Negative options actively absorb false-positive spillover (e.g. `refused_or_negated_roast`, `external_or_fictional_framing`, `technical_file_deletion`, `software_process_kill`, `routine_correction`).

#### Scorecard Comparison (43 Contrastive Cases)

| Architecture | Full Vector Match | Precision (Spikes) | Recall (Spikes) | False Positive Spikes | p50 Latency | Mean Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Arm A: Shallow Boolean (`noul`)** | 40 / 43 (93.0%) | 80.0% | 100.0% | 1 / 39 (2.6%) | **436.5 ms** | 521.9 ms |
| **Arm B: Rich Contrastive Choice** | **43 / 43 (100.0%)** | **100.0%** | **100.0%** | **0 / 39 (0.0%)** | **438.2 ms** | 526.4 ms |

#### Key Empirical Insights
1. **API Grammar Compatibility**: OpenRouter's Decision API requires `"type": "noul"` for probability queries; `"type": "boolean"` returns HTTP 400 Bad Request. For Arm B, `"type": "choice"` with candidate strings works natively.
2. **Distractor Attractors Eliminate Sarcasm & Negation False Positives**:
   - In `F21B` (*"Don't give me your gentlest roast"*), Arm A's boolean query returned `true` (50.5% probability) because it latched onto roast keywords.
   - Arm B presented options `["genuine_roast_invitation", "refused_or_negated_roast", "playful_unrelated_banter", "none"]`. Jev assigned 76.5% probability to `refused_or_negated_roast`, cleanly suppressing the false positive.
3. **Zero-Latency Overhead**:
   - Arm A p50: **436.5 ms**
   - Arm B p50: **438.2 ms**
   - **Delta: +1.7 ms**. Because Jev evaluates all 12 queries concurrently across internal classification heads within a single model forward pass, rich contrastive choices provide 100% accuracy with zero real-world latency penalty.
4. **Committed Trace**: `reports/nan0-cleanroom/nan0-shallow-vs-rich-shootout-trace.json`.

---

### 7.5 Shootout V4: V1 Baseline vs. V2 Reviewer Candidate (80 Choices)

Following external peer review, we evaluated the refined 80-choice observable schema ([`docs/nan0/nan0-jev-12-group-rich-v2.questions.json`](./nan0/nan0-jev-12-group-rich-v2.questions.json)) across all 43 cases in both structured JSON and string modes (`scripts/tests/rwkv-harness/experiments/jev-v1-vs-v2-shootout.py`).

| Metric | Arm 1: V1 Baseline (41 choices) | Arm 2: V2 Refined (80 choices, structured) | Arm 3: V2 Refined (80 choices, string) |
| :--- | :---: | :---: | :---: |
| **Full Vector Matches** | **43 / 43 (100.0%)** | **43 / 43 (100.0%)** | **43 / 43 (100.0%)** |
| **Counterexamples (`F18A`–`F22B`)** | **10 / 10 (100.0%)** | **10 / 10 (100.0%)** | **10 / 10 (100.0%)** |
| **False Spike Rate** | **0.0%** | **0.0%** | **0.0%** |
| **Median Latency ($p_{50}$)** | **398.8 ms** | **452.4 ms** (+53.6 ms) | **429.5 ms** (+30.7 ms) |
| **Average Tokens/Turn** | 2,765 tokens | 6,451 tokens | 6,356 tokens |
| **Cost per 1,000 Turns** | ~$0.09 | ~$0.22 | ~$0.22 |

**Conclusion**: The 80-choice V2 schema provides observable communicative definitions and nuanced distractor attractors while maintaining **100.0% accuracy** and a fast **~430–450 ms response time**. Full trace recorded at `reports/nan0-cleanroom/nan0-v1-vs-v2-shootout-trace.json`.

---

## 8. Expanded Subsystem Integration Roadmap (Community Discoveries)

Following architectural surveys of high-utility open-source Jev implementations, five additional application domains are established for exploration and promotion into AIRI:

### 8.1 Domain G: Zero-Loss Context Garbage Collector (`Winnow` / `fast-jev-compaction`)
- **Reference**: `fast-jev-compaction`, `Winnow`
- **Core Mechanism**:
  - Autoregressive summarization over long chat transcripts, bash outputs, and tool results often introduces lossy compression and hallucinations.
  - Instead of rewriting history, Jev acts as an in-place garbage collector: it evaluates previous conversation turns and command outputs, assigning retention scores to individual segments.
  - Low-salience banter and routine command logs are pruned, while high-salience instructions, error traces, and exact user quotes are preserved verbatim with 0% semantic loss.

### 8.2 Domain H: Generative UI Component Selector (`json-render + Jev`)
- **Reference**: Vercel Labs `json-render + Jev` (reduced UI generation latency from 3.21s to 0.88s)
- **Core Mechanism**:
  - Generating dynamic companion widgets (`mount_widget`, `stage_widgets`, polls, timers, mood meters) via token-by-token LLM streaming creates perceptible multi-second delays.
  - Using predefined UI component schemas and property enums, Jev evaluates the companion state in ~100ms and directly selects component IDs and layouts, allowing client-side TypeScript code to mount the widget instantly.

### 8.3 Domain I: System 1 Semantic Shell & Predicate Guard (`SemDecide / bash + jev`)
- **Reference**: `SemDecide` (`grep | jq | jev`)
- **Core Mechanism**:
  - Companion proactivity and desktop automation often require verifying semantic preconditions (e.g. "Did the user switch to a gaming application?", "Did the build log contain a fatal compiler failure?").
  - An internal scripting predicate `runSemanticPredicate(state, question)` provides shell scripts and background monitors with fast binary/choice gating without triggering expensive frontier model calls.

### 8.4 Domain J: System 1 Model Context Protocol (MCP) Server (`typesafe-mcp` / `jev-mcp`)
- **Reference**: `typesafe-mcp`, `jev-mcp`
- **Core Mechanism**:
  - Exposes AIRI's internal `laya-local` and OpenRouter Jev decision engines as an MCP tool (`system1_decide`).
  - Allows internal companion tool loops and external agent clients to delegate discrete evaluations (e.g. multi-candidate scoring, risk assessment, intent classification) directly as structured sub-tools without verbose prompt overhead.

### 8.5 Domain K: Autonomous Loop Verification & "Task Complete" Referee (`Canny`)
- **Reference**: `Canny` (agent task completion referee)
- **Core Mechanism**:
  - In autonomous agentic loops (e.g. Autonomous Artistry image generation, Director loops, complex tool workflows), models can prematurely declare completion despite underlying errors.
  - A dedicated System-1 referee evaluates tool diffs, exit codes, and output artifacts against explicit success criteria before marking a task as done.



