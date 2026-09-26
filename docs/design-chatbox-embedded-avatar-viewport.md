# Design Document: Embedded Companion Stage in Desktop Chat

> **Status**: Proposed
> **Author**: dasilva333 / Antigravity Pair Programming
> **Date**: 2026-09-26
> **Target Subsystems**: Desktop Chat (`apps/stage-tamagotchi/src/renderer/pages/chat.vue`), `packages/stage-ui/src/components/scenarios/chat/`, `packages/stage-ui/src/components/scenes/RendererStage.vue`, `apps/stage-tamagotchi/src/main/windows/`

---

## 1. Executive Summary & Problem Space

### 1.1 Context & Upstream Sentiment (PR #2663)
In upstream PR [#2663](https://github.com/moeru-ai/airi/pull/2663) (`feat(stage-tamagotchi): add a floating chat window beside the character`), upstream contributors identified the desire to keep chat conversations visually anchored to the companion avatar. However, upstream implemented this by creating an entirely separate secondary Electron window (`chat-floating.vue`) and mathematically tethering its window position next to the character stage via polling loops, click-through toggles, and buttons coupled back into `controls-island`.

### 1.2 The Fork Opportunity
In `dasilva333/airi`, we already completed the foundational architectural decoupling:
1. **Decoupled Surfaces**: The **Actor Stage** (`windows/stage`, `RendererStage.vue`) and **Control Strip** (`windows/main`, `ControlStrip.vue`) are separate surfaces.
2. **Unified Chat Architecture**: Our desktop chat window (`windows/chat`) features a dynamic, collapsible right-side drawer/panel used for contextual grounding, memory recall, and inspectable activity.
3. **Proven Arbitrary-Page Avatar Embedding**: In [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-finale.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-finale.vue), we proved that `RendererStage.vue` can be mounted cleanly, reliably, and reactively into an arbitrary container layout with fallback static previews, transform controls, and zero disruption to the underlying model stores.

By segmenting the dynamic right-side chat panel to host an embedded **Companion Stage**, we can provide an elegant, single-window "All-In-One" desktop experience without fragile multi-window OS-level tethering.

---

## 2. Technical Blueprint: The `step-finale.vue` Pattern

In `step-finale.vue` (lines 592–606), the avatar is embedded directly as a child component inside a scoped viewport div:

```vue
<RendererStage
  v-if="stageModelReady && stageModelRenderer && stageModelRenderer !== 'disabled' && isModelActive"
  v-model:state="stageState"
  :focus-at="{ x: 0, y: 0 }"
  :paused="isPaused"
  :show-background="false"
  :radial-menu-enabled="false"
  :draggable="true"
  :x-offset="previewXOffset"
  :y-offset="previewYOffset"
  :scale="previewScale"
  :class="['absolute inset-0 h-full w-full z-0']"
  @offset-change="handleOffsetChange"
  @scale-change="handleScaleChange"
/>
```

### Key Architectural Strengths of this Pattern:
1. **Engine Agnostic**: Natively supports all 4 avatar engines in our fork (VRM 3D, Live2D 2D, Spine 2D, MMD/PMX 3D) without bespoke wrapper code.
2. **Store Reusability**: Driven directly by `useSettings()`, `useDisplayModelsStore()`, and `useModelStore()`.
3. **Zero Leaked Chrome**: Props `:show-background="false"` and `:radial-menu-enabled="false"` ensure the avatar cleanly floats inside whatever panel background the parent surface defines.
4. **Resilient Fallback**: If the model is loading or WebGL is constrained, a static WebP preview badge renders seamlessly (`avatarPreviewUrl`), avoiding layout shifts or broken UI boxes.

---

## 3. Component & Layout Topology: The Expandable Header Pattern

Rather than introducing an artificial tab switcher that segments the right panel, we align with the established design pattern already powering the right-hand panel in `apps/stage-tamagotchi/src/renderer/pages/chat.vue`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Desktop Chat Window (`apps/stage-tamagotchi/src/renderer/pages/chat.vue`)    │
├────────────────────────────────────────┬────────────────────────────────────┤
│ Left Column: Chat Conversation Stream  │ Right Collapsible Sidebar Panel    │
│                                        ├────────────────────────────────────┤
│ • Session history & bubbles            │ COMPANION STAGE [👁️ Open / Closed]  │
│ • Composer input & attachments         │ ┌────────────────────────────────┐ │
│ • Voice transcript pills               │ │ Embedded <RendererStage />     │ │
│ • Grounding telemetry banner           │ │ (Mounted only when expanded)   │ │
│ • Stop / Cancel buttons                │ │   [ Live Avatar Viewport ]     │ │
│                                        │ │   (Aspect 3:4 or Bust Frame)   │ │
│                                        │ └────────────────────────────────┘ │
│                                        ├────────────────────────────────────┤
│                                        │ MEMORIES [👁️]                + New │
│                                        │ • 9/26 Journal Entry              │
│                                        ├────────────────────────────────────┤
│                                        │ CURRENT SCENE [👁️]                 │
│                                        │ • Active background thumbnail     │
│                                        ├────────────────────────────────────┤
│                                        │ MEDIA GALLERY [👁️]    + Add / View │
│                                        │ • Grid of art assets / selfies     │
└────────────────────────────────────────┴────────────────────────────────────┘
```

### Expandable Header Anatomy
* **Header Structure**: Matches `MEMORIES`, `CURRENT SCENE`, and `MEDIA GALLERY`:
  ```vue
  <div class="flex items-center justify-between">
    <span
      :class="['flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
               rightPanelCompanionCollapsed
                 ? 'bg-neutral-100/50 text-neutral-400 dark:bg-neutral-800/50'
                 : 'bg-primary-50/50 text-primary-500 dark:bg-primary-950/30 dark:text-primary-400']"
      @click="toggleCompanionStage"
    >
      Companion Stage
      <span :class="rightPanelCompanionCollapsed ? 'i-solar:eye-closed-linear' : 'i-solar:eye-linear'" class="text-xs" />
    </span>
  </div>
  ```
* **Persistent State**: Managed via `useLocalStorage('airi:chat:rp-companion-collapsed', true)` so user preference persists across chat launches.
* **Viewport Frame**: When expanded (`!rightPanelCompanionCollapsed`), an aspect-ratio container (`aspect-[3/4]` or `h-72 w-full`) mounts `RendererStage.vue` cleanly with rounded borders and subtle backdrop shadow.

---

## 4. Lazy Loading & Resource Management

### 4.1 WebGL Context Conservation
* **Strict Lazy Mounting**: `<RendererStage />` is strictly guarded behind `v-if="!rightPanelCompanionCollapsed"`.
* **Zero Idle GPU Overhead**: When the section is collapsed (`rightPanelCompanionCollapsed === true`), the component is unmounted, its WebGL context is torn down or held suspended, and the standalone stage window is restored.

### 4.2 Texture and Memory Footprint
* Because textures and meshes are loaded via cached stores (`displayModelsStore` / indexedDB `localforage`), expanding the card does not incur network latency.

* Models remain cached in memory via the existing model store LRU cache.

---

## 5. The "Open Twice" / Babysitter Policy: Concrete Consensus

### 5.1 Agreed Mechanism: `toggleStage(false)` / `toggleStage(true)`
Rather than maintaining two competing WebGL contexts or complex window proximity polling, we adopt a clean, declarative visibility handoff:
1. **Expanding the Companion Stage**: When the user clicks the eye icon to expand `COMPANION STAGE` in the right panel (`!rightPanelCompanionCollapsed`):
   - Call `toggleStageVisibility(false)` to hide the standalone detached Actor Stage window.
   - The embedded `<RendererStage />` lazily mounts, becomes the active viewport, and claims the avatar stage.
2. **Collapsing the Companion Stage / Closing Chat**: When the user clicks the eye icon to collapse the section (`rightPanelCompanionCollapsed === true`) or closes the Chat window:
   - Unmount / pause the embedded `<RendererStage />`.
   - Call `toggleStageVisibility(true)` to restore the floating Actor Stage back to its desktop coordinates.

This guarantees:
- **Zero VRAM Duplication**: Never runs two concurrent WebGL renderers for the same companion.
- **Zero Audio Desync**: Lip-sync and audio analyser events target a single active canvas.
- **Seamless Desktop Continuity**: The companion never disappears; it simply docks into chat, then steps back out when chat closes.

---

## 6. Real-Time ACT Token Streaming & Emotion Synchronization

Unlike [`step-finale.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v3/steps/step-finale.vue) (which was a static pre-flight preview for Turn 0 typewriter greeting), the **Desktop Chat embedded companion is live and reactive during conversation streaming**:
1. **Live Stream Parsing**: As LLM tokens stream into the chat history, markers like `<|ACT {"emotion":"joy", "motion":"nod"}|>` are intercepted by the response categoriser.
2. **Instant Visual Feedback**: Because `useModelStore()` is shared across renderer modules, emotional blendshapes, eye blinks, and procedural or VRMA motions execute directly inside the chat panel in real time alongside the typing assistant bubble.
3. **Audio Lip-Sync**: Spoken audio packets generated via `useSpeechStore()` drive the mouth visemes synchronously inside the panel.

---

## 7. Scope Boundaries & UX Consensus

### 7.1 Scope Lock: Exclusively Desktop Chatbox (`apps/stage-tamagotchi`)
- **Strictly Desktop-Only**: This feature is explicitly confined to Desktop Electron (`apps/stage-tamagotchi`).
- **No Web / Pocket Expansion**: We do NOT expand this into `stage-web` or `stage-pocket` shells. Keeping scope tight prevents regressions across mobile responsive layouts and avoids bloating touch-driven interfaces.

### 7.2 Panel Styling & Interaction Controls
- **Clean Aesthetic**: Keep `:show-background="false"` and `:radial-menu-enabled="false"`. The avatar is cleanly embedded inside the panel card without intrusive radial overlays or conflicting scene backdrops.
- **Mouse & Click Interactions**: Initial implementation keeps framing stable (bust-up) and avoids jittery cursor tracking while typing in the chat composer.
- **Post-Integration Ergonomics**: Any secondary controls (such as wardrobe quick-swap buttons or manual expression toggles) will be evaluated post-implementation to avoid cluttering the chat view.

