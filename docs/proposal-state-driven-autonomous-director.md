# Proposal: State-Driven Autonomous Director — Deterministic Cognitive & Somatic Weight Injection for Dynamic Visual Novel CGs

> **Document ID:** `docs/proposal-state-driven-autonomous-director.md`
> **Status:** Proposal & Architectural Integration Spec
> **Date:** October 9, 2026
> **Target Subsystems:**
> - `packages/stage-ui/src/stores/director.ts` (Autonomous Director Loop & Scene Synthesis)
> - `packages/stage-ui/src/stores/artistry.ts` (ComfyUI Provider Bridge & Diffusion Job Queue)
> - `packages/stage-ui/src/stores/nan0.ts` (Nan0 12-Dimensional Affective Telemetry)
> - `packages/stage-ui/src/stores/somatic.ts` (Somatic Needs Telemetry from `proposal-nan0-somatic-states.md`)
> - `packages/stage-pages/src/pages/settings/director/` (Director & Artistry Settings UI)

---

## 1. Executive Summary & The Visual Novel Vision

In existing AIRI releases, the **Autonomous Director** watches active dialogue turns and prompts an auxiliary LLM pass to draft an open-ended image generation prompt. While effective for narrative scene context (e.g. *"sitting in a rainy cafe"*), it relies on the Director LLM guessing the character's facial expression, posture, and mood solely from conversational text.

During an architectural session between **Richy**, **Kyo**, and **Sillar**, a critical missing link was identified:

> **Sillar:** *"Going back to that. If put on airi that would extend the 'Visual Novel' mode?"*
> **Richy:** *"You know what? That's the ultimate bridge. Heck, I can do that now with Nan0: influencing the visual prompt based on the state... translating the state to deterministic prompt injections in the weight format that ComfyUI uses: `(smugness:1.5)`."*
> **Sillar:** *"The weights make a whole lot of difference. The effects vary depending on the image model, so you can't say with 100% certainty how strong 0.5 translates... a configurable multiplier in the config menu would solve it."*

This proposal formalizes the **State-Driven Autonomous Director**: a deterministic compilation layer that transforms internal psychological states (Nan0's 12 Affective Bars) and physical states (Aurora's Somatic Needs) into weighted generative diffusion tokens.

This bridges dynamic dialogue with **Visual Novel Mode**, ensuring generated scene CGs mathematically and viscerally mirror the character's true internal state.

---

## 2. Core Architecture: The Three-Tier Director Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COGNITIVE & SOMATIC CORE                        │
│   • Nan0 Mind: Smugness: 0.82, Pride: 0.85, Irritation: 0.15, Warmth: 0.65 │
│   • Somatic Body: Hunger: CriticalLow, Stamina: Low, Awake: Mild       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            TIER 1: STATE-TO-WEIGHT COMPILER (Deterministic)            │
│   • Evaluates state thresholds (e.g., Smugness > 0.40)                │
│   • Scales values via user-configured Model Sensitivity Multiplier     │
│   • Clamps weights to safe bounds [1.05, MaxWeightLimit]               │
│   • Emits: Visual Anchors (Expression, Posture, Somatic Artifacts)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TIER 2: DIRECTOR SCENE WEAVER (Narrative LLM)              │
│   • Reads conversational context & environmental telemetry             │
│   • Weaves camera angle, background scenery, and environmental mood   │
│   • Injects Tier 1 deterministic anchors into the character prompt     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              TIER 3: COMFYUI / DIFFUSION DISPATCH & STAGE              │
│   • Emits weighted prompt to ComfyUI workflow                          │
│   • Renders dynamic Visual Novel event CG onto Stage/Journal           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Weight Translation & Model Safety

As noted by Sillar, raw uncapped weight mappings (e.g., `0.5 ➔ 1.5`) will cause "deep-fried" images, color burn, limb distortion, or saturated artifacts depending on the checkpoint (SDXL, Pony/Illustrious, SD 1.5, or Flux).

### 3.1 The Scaled Translation Formula
The compiler computes prompt token emphasis using three configurable parameters:
1. $\text{Baseline} = 1.0$ (neutral weight)
2. $\alpha = \text{Model Sensitivity Multiplier}$ (default: `0.35`, adjustable from `0.10` to `0.80`)
3. $\text{Clamp}_{\max} = \text{Max Weight Ceiling}$ (default: `1.30`, adjustable up to `1.50`)

$$\text{Weight} = \min\left(\text{Clamp}_{\max}, \; 1.0 + (\text{StateValue} \times \alpha)\right)$$

### 3.2 Threshold Activation Gates
Tokens are only compiled when an internal dimension crosses its activation threshold, avoiding prompt clutter when a state is neutral:

| State Dimension | Activation Threshold | Danbooru / Tag Dialect Example | Natural Language Dialect Example |
| :--- | :--- | :--- | :--- |
| **Smugness** ($0.82$) | $> 0.40$ | `(smug:1.29), (sly grin, half-closed eyes:1.24)` | *"a noticeably smug and mocking smirk with half-closed eyes"* |
| **Pride** ($0.85$) | $> 0.50$ | `(hands on hips, chin up, confident posture:1.30)` | *"standing with proud, upright posture and hands firmly on hips"* |
| **Hunger** (CritLow, $0.15$) | $< 0.30$ | `(holding stomach:1.25), (weary, faint pout:1.20)` | *"subtly holding her stomach with a weary, hungry expression"* |
| **Stamina** (Low, $0.25$) | $< 0.35$ | `(slumped posture, resting head on arm:1.25)` | *"visibly exhausted, slumping forward onto the desk"* |
| **Warmth + Attachment** ($> 0.70$) | $> 0.60$ | `(blushing:1.25), (tender smile, looking at viewer:1.28)` | *"blushing warmly with a soft, gentle smile directed at the viewer"* |
### 3.3 Sillar's Deadzone Rule & Top-K Salience Gating (Preventing Prompt Soup)

As highlighted by **Sillar**, injecting dozens of states simultaneously creates catastrophic **prompt token dilution** and cross-attention pollution in Stable Diffusion text encoders (CLIP/T5):

> **Sillar:** *"If it's a lot of stats it might get messy if all of them are added at the same time... maybe add some deadzones? Don't add to the image prompt the stats that are too close to neutral (0). When you add too much stuff it lowers the image hitrate and quality on some stable diffusion models."*

To protect image coherence and prevent contradictory visual cues (e.g. trying to render a character smiling warmly while scowling in rage), the compiler enforces three gating rules:

1. **Neutral Deadzones ($\pm \epsilon$ Noise Suppression):**
   - States within neutral resting ranges (e.g. $\text{Value} \le 0.35$ for spikes, or within $\pm 0.15$ of the character's baseline) emit **strictly zero tokens**.
   - If the character is experiencing mild background emotion, the visual prompt remains clean and unpolluted.

2. **Top-K Salience Filter (Hard Budget of 2–3 Anchors):**
   - Human faces and single-image visual frames can only legibly convey **one or two dominant expressions at a time**.
   - The compiler ranks active states by their **absolute deviation from baseline**:
     $$\text{Salience}(\text{dim}) = |\text{CurrentValue} - \text{BaselineValue}|$$
   - **Enforced Budget:**
     - **Max 2 Affective Anchors** (the 2 most intense emotional spikes).
     - **Max 1 Somatic Anchor** (the single most critical physiological need, e.g. severe exhaustion).
     - **Hard Maximum:** At most **3 state anchors** can ever enter the prompt simultaneously.

3. **Antagonist Clashing Suppression (Mutual Exclusion):**
   - Explicit exclusion rules prevent contradictory tokens from competing in the diffusion latent space:
     - `Smugness / Pride` suppresses `Fear / Insecurity`.
     - `Rage / Irritation` suppresses `Warmth / Tender Smile`.
     - `Amusement` suppresses `Gloom / Listless Boredom`.
   - The state with the higher salience score completely vetoes its antagonist.

---


## 4. Multi-Dialect Generator Compatibility

Different generative backends require different prompt formats:

### Dialect A: Tag-Based / Booru Syntax (Pony, Illustrious, Animagine, SDXL, SD 1.5)
- Standard parenthesis weight notation: `(token:weight)`.
- Injected into character positive prompt block:
  ```
  1girl, nan0_cyber, masterpiece, high quality,
  (smug:1.28), (sly grin:1.24), (hands on hips:1.25),
  sitting in a high-tech workshop, neon ambient lighting, wide angle
  ```

### Dialect B: Natural Language / Prose Syntax (Flux, SD 3.5, Midjourney)
- Flux and T5-based diffusion models do not respect mathematical parenthesis notation and can hallucinate syntax tokens.
- The compiler maps weights into descriptive qualitative intensifiers:
  - Weight $< 1.15$: *"subtle"*, *"slight"*
  - Weight $1.15 - 1.30$: *"noticeable"*, *"distinct"*
  - Weight $> 1.30$: *"intense"*, *"unmistakable"*, *"heavily emphasized"*
  ```
  "Nan0 sitting in a high-tech workshop with neon ambient lighting.
   She exhibits an unmistakably smug expression with a distinct sly grin,
   posing with noticeable pride and hands on her hips."
  ```

---

## 5. UI Architecture: Character Config Cognition Tab & Per-Dimension Prompt Customizer

The primary control surface for this capability lives directly inside **Settings → Character Config → Cognition Tab** (`CardCreationTabCognition.vue`), binding these visual projections directly to the active Character Card.

### 5.1 The 4-Way Co-Processor Architecture Dropdown
Under the Cognition Routing settings, creators select the active cognitive mode:

```vue
<FieldSelect
  v-model="card.extensions.airi.cognition.coprocessor"
  label="Cognitive Co-Processor"
  :options="[
    { label: 'None (Direct Proxy / Raw Prompt)', value: 'none' },
    { label: 'Nan0 Engine (Mind Only)', value: 'nan0' },
    { label: 'Nan0 with Sims Mode (Dual-Engine: Mind + Body)', value: 'nan0_sims' },
    { label: 'Sims Mode Only (Body Only)', value: 'sims_only' },
  ]"
/>
```

When `nan0_sims` or `sims_only` is selected, the **Sims Mode** sub-panel unlocks, exposing physiological decay rates, journey clock settings, and metabolic meters alongside the affective dynamics.

---

### 5.2 Per-Dimension Customizable Visual Prompt Mappings

Because different character cards use different visual LoRAs, Danbooru checkpoints, or art styles (e.g. anime versus realistic, or a card requiring a specific trigger like `frieren_smug` or `cat_ears_droop`), **all 12 psychological dimensions and somatic needs have user-configurable prompt templates**.

Each dimension provides sensible, curated defaults, but allows creators to override the injected tags in the UI:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Settings → Character Config → Cognition Tab → [ 🎭 Visual Novel / Director Anchors ]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [X] Enable State-Driven Visual Projection                                             │
│      Deterministically injects character emotional and somatic state into ComfyUI CGs. │
│                                                                                        │
│  Model Sensitivity Multiplier (α): [──●──────] 0.35    Max Ceiling: [────●────] 1.30   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  DIMENSION           │ DEFAULT VISUAL PROMPT TAGS        │ CUSTOM USER OVERRIDE        │
├──────────────────────┼───────────────────────────────────┼─────────────────────────────┤
│  Smugness            │ smug, sly grin, half-closed eyes  │ [ frieren_smug, smug_smile ]│
│  Pride               │ hands on hips, chin up, confident │ [ haughty, chest_out       ]│
│  Irritation          │ annoyed, furrowed brow, scowl     │ [ tsundere_glare, pout     ]│
│  Rage                │ angry, yelling, clenched teeth    │ [ sharp_teeth, furious_eyes]│
│  Curiosity           │ tilted head, wide eyes, curious   │ [ leaning_forward, sparkle ]│
│  Amusement           │ giggling, hand over mouth, amused │ [ playful_laugh, wink      ]│
│  Warmth              │ blushing, soft gentle smile       │ [ dere_blush, loving_gaze  ]│
│  Attachment          │ tender eye contact, leaning close │ [ affectionate, holding_arm]│
│  Possessiveness      │ intense stare, protective grip    │ [ yandere_glance, clinging ]│
│  Suspicion           │ squinting, guarded, side-eye      │ [ distrustful, defensive   ]│
│  Fear                │ wide pupils, trembling, fearful   │ [ scared, stepped_back     ]│
│  Boredom             │ resting chin on hand, listless    │ [ flat_eyes, sighing       ]│
├──────────────────────┼───────────────────────────────────┼─────────────────────────────┤
│  [SIMS] Hunger       │ holding stomach, weary, faint     │ [ looking_at_menu, hungry  ]│
│  [SIMS] Stamina      │ slumped posture, drooping eyelids │ [ head_on_desk, exhausted  ]│
│  [SIMS] Thirst       │ dry lips, reaching for glass      │ [ empty_cup, thirsty       ]│
│  [SIMS] Awake        │ yawning, messy hair, heavy eyes   │ [ pyjamas, sleepy_rubbing  ]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Deterministic Injection Assembly
During generation, if `Smugness = 0.82`:
1. The compiler retrieves the custom tag string (e.g. `frieren_smug, smug_smile`).
2. Computes the target weight: $\min(1.30, 1.0 + (0.82 \times 0.35)) = 1.29$.
3. Wraps the tags deterministically: `(frieren_smug, smug_smile:1.29)`.
4. Stitches the resulting block directly into the Autonomous Director's character prompt payload.


---

## 6. Implementation Roadmap

1. **Phase 1: `StateVisualCompiler` Module**
   - Author `@proj-airi/stage-ui/libs/director/state-visual-compiler.ts`.
   - Implement state activation evaluators, weight clamping math, and tag mappings for Nan0's 12 dimensions and Somatic needs.
2. **Phase 2: Director Store Hook**
   - In `packages/stage-ui/src/stores/director.ts`, intercept active turns before prompt assembly.
   - Query `useNan0Store()` and `useSomaticStore()` for current values.
   - Compile active anchors and concatenate into the Director prompt payload.
3. **Phase 3: Dialect Presets & Safe Clamping**
   - Integrate configurable multipliers into `packages/stage-ui/src/stores/artistry.ts`.
   - Provide presets for Pony/SDXL, SD1.5, and Flux.
4. **Phase 4: Visual Novel Scene Bridge**
   - Connect compiled output to the Dating Sim and Image Journal surfaces, rendering dynamic milestone CGs whenever emotional spikes or caretaking moments occur.
