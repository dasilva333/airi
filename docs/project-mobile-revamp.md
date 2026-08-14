# Architecture & Design Spec: AIRI Mobile Experience Revamp

## 1. Executive Summary & Core Philosophy

The AIRI mobile application (`apps/stage-pocket`) is evolving from a fragmented layout of disconnected floating buttons into a cohesive, tactile, and emotionally immersive companion workspace.

### The Foveal Vision & Emotional Connection Axiom

> **"People cannot read detailed text and study a face simultaneously; foveal vision is too narrow (~2°). A caption at the bottom of the screen forces repeated saccadic eye movements (`face → drawer → face → drawer`), turning the companion into decoration behind a messaging app."**

When interacting with an AI companion on a handheld touchscreen, facial expressions, micro-glances, head tilts, and kinetic body language are where the bond is forged. To preserve spatial presence and eye contact, the mobile experience is divided into four strictly organized interaction planes:

1. **Stage & Ambient Atmosphere Layer**: Pure companion presence (Live2D/VRM/MMD/Spine), subtle floating heart particle canvas, and grounding concentric digital pedestal.
2. **Top System Control Plane (4-Pill Power Strip + Profile Capsule)**: Character/Storyline hot-swap (`[📖 ProfileSwitcher]`), model selection (`[🧠]`), context injections & runtime engine (`[⚡]`), Control Customizer (`[⊞]`), and Settings (`[⚙]`).
3. **Vertical Edge Notch & Control Strip**: A 14px edge tab docked to the **Left** or **Right** edge that smoothly expands into a **5–7 slot vertical ribbon** for quick companion actions (Tactile/Zoom modes, Outfits, Emotions, Live voice).
4. **Composition & Archive Layer (WhisperDock Family)**: The user's streamlined message creation dock (`[+]`, `[✨]`, input, `[🎤]`, `[✈]`) anchored above the bottom safe area with an expandable 3-posture history drawer.

---

## 2. The 4-Way Mobile Interaction Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] [📖 Profile / Story ▾]    [🧠 LLM] [⚡ Injections] [⊞ Strip] [⚙] │ ← Top System Bar
│ ═════════════════════════════════════════┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈   │ ← Token Progress Line
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│             ♥           ♡            ♥                                 │ ← Ambient Rising Hearts
│                  ┌─────────────────┐   ♡                               │
│                  │  Head-Tethered  │                       ╭─╮         │
│                  │  Live Caption   │                       │⠿│         │ ← 14px Edge Notch Tab
│                  └───────┬─────────┘                       ╰─╯         │   (Left or Right Docked)
│                          ▼                                             │
│                  [Live2D / VRM Model]                                  │
│                                                                        │
│                    ╭──────────╮                                        │
│                   │ ◯ Platform ◯                                       │ ← Concentric Pedestal
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ MobileWhisperSheet (Compact Posture) ─────────────────────────────┐ │
│ │  [+]   [✨]   [          Say something...          ]   [🎤]   [✈]  │ │ ← Composition Layer
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Top System Control Bar: Profile Capsule & 4-Pill Power Strip

- **Primary file**: `packages/stage-layouts/src/components/Layouts/MobileHeader.vue`
- **Minimal Brand Anchor**: Icon-only AIRI logo (`Logo.svg` / `LogoDark.svg`) on the top-left.
- **Token Capacity Progress Bar**: 1.5px glowing animated line beneath the header line (`sessionTokens / contextWidth`).

### 3.1 Character & Profile Capsule (`ProfileSwitcherPopover`)
- Reuses the shared desktop `ProfileSwitcherPopover.vue` (`packages/stage-ui/src/components/misc/profile-switcher-popover.vue`) directly via DRY architecture.
- **Trigger Pill**: A frosted glass capsule pill beside the logo: `[ 🐱 Kira ▾ ]` with max-width clamping (`max-w-28 sm:max-w-36 truncate`).
- **Instant Hot-Swap**: Tapping drops down the active character & story profile list to hot-swap cards and models with zero stage reload.
- **Variant Support**: `variant="mobile"` prop allows sharing identical data logic while adapting popover padding and touch targets for mobile.

### 3.2 The 4 Header Action Badges

```
┌─────────────┬───────────────────┬───────────────────┬──────────────┐
│  [🧠 LLM]   │  [⚡ Injections]   │  [⊞ Strip Config] │ [⚙ Settings] │
└─────────────┴───────────────────┴───────────────────┴──────────────┘
```

1. **`[🧠 Brain Selector]`**: 1-tap popover to switch active LLM models (Gemini Flash, OpenRouter, DeepSeek, Claude) without leaving the stage.
2. **`[⚡ Context Injections & Runtime Hub]`** *(Rich Popover / Slide Panel)*:
   - **Chat Layout**: Segmented sizing pills (`Mini` · `Med` · `Large` · `Full`).
   - **Context Injections (Switches)**:
     - `System Sensors` (Inject real-time OS/device telemetry).
     - `Universe Memory (RAG)` (Semantic long-term memory retrieval).
     - `Recent Topics` (Inject active trending conversational context).
     - `Visual Scene State` (Attach Director's latest visual scratchpad).
     - `Salience Gating (RWKV)` (Flag high-intensity turns for grounding).
     - `Dream Intrusion` (Inject offline consolidated dream synthesis).
     - `Journal Intrusion` (Reference latest journal entry).
     - `Artistry Intrusion` (Reference latest visual creations).
   - **Modes & Spawn Settings**:
     - `Image Director` (Autonomous image generation for conversational turns).
     - `Image Spawn Mode`: Segmented pill (`Background` · `Widget` · `Inline`).
     - `Heartbeats` (Periodic proactive character activation).
3. **`[⊞ Control Customizer]`**: Dedicated trigger launching the **Mobile Control Customizer Sheet** to configure the edge strip.
4. **`[⚙ Settings Gear]`**: Direct route to `/settings`.

---

## 4. Vertical Edge Notch & Mobile Control Strip

- **Primary file**: `packages/stage-layouts/src/components/Layouts/MobileControlStrip.vue`
- **Settings store**: `packages/stage-ui/src/stores/settings/control-strip.ts`

### 4.1 Fixed Vertical Orientation & 5–7 Slot Capacity
Unlike desktop (which supports both horizontal bars and vertical columns), **mobile strictly enforces a vertical strip**. A vertical orientation:
- Maximizes vertical thumb travel along the screen edge.
- Comfortably accommodates **5 to 7 action icons** (44px touch targets) without encroaching on the center avatar or bottom WhisperDock.
- Avoids the cramped 3–4 button limit of horizontal mobile bars.

### 4.2 Left or Right Edge Docking (`dockEdge`)
- Users can choose whether the strip docks against the **Left Edge** or **Right Edge** of the screen (`dockEdge: 'left' | 'right'`), optimizing for left-handed vs. right-handed one-handed thumb use.

```
      [Left Edge Docked]                           [Right Edge Docked]
┌──────────────────────────────┐             ┌──────────────────────────────┐
│ │ ⠿ │ (14px Tab)             │             │             (14px Tab) │ ⠿ │ │
│ ────                         │             │                         ──── │
│ ╭────────╮                   │     OR      │                   ╭────────╮ │
│ │   🐾   │ Tactile / Zoom    │             │ Tactile / Zoom    │   🐾   │ │
│ │   👗   │ Wardrobe Outfits  │             │ Wardrobe Outfits  │   👗   │ │
│ │   🎭   │ Expressions Grid  │             │ Expressions Grid  │   🎭   │ │
│ │   ✨   │ Live Voice (Bidi) │             │ Live Voice (Bidi) │   ✨   │ │
│ │   💬   │ Chat Drawer       │             │ Chat Drawer       │   💬   │ │
│ │   📸   │ Vision Capture    │             │ Vision Capture    │   📸   │ │
│ ╰────────╯                   │             │                   ╰────────╯ │
└──────────────────────────────┘             └──────────────────────────────┘
```

### 4.3 Expand / Collapse Touch Physics
- **Collapsed**: A subtle 14px rounded glass tab (`╭─ ⠿ ─╮`) rests flush against the screen bezel.
- **Expanded**: Tapping or swiping inward expands the **vertical translucent pill** anchored to that edge with fluid spring easing (`slide-in-from-right` or `slide-in-from-left`).
- **Auto-Collapse**: Tapping the stage or swiping back toward the bezel re-docks it into the tab.

### 4.4 Touch Viewport Paradigm (Replacing Clumsy Desktop Sliders)
In legacy mobile, opening coordinate controls spawned desktop-oriented slider inputs that hijacked touch events and froze the screen. Under the Control Strip model:
- **Tactile Mode (Default)**: Touching the companion triggers organic pokes, blushes, and physical Live2D reactions with zero coordinate drift.
- **Touch Positioning Mode**: Tapping `[🐾]` enters positioning mode with native mobile gestures:
  - **Pinch-to-zoom**: Dynamically scales avatar model (`scale`).
  - **1-finger drag**: Pans the model smoothly across the screen (`position.x`, `position.y`).
  - **Double-tap**: Instantly resets coordinates to default center.

---

## 5. Dedicated Mobile Control Customizer Sheet

- **Primary file**: `packages/stage-layouts/src/components/Layouts/MobileControlCustomizerDialog.vue`

The desktop customizer (`w-[760px]` 2-column modal) cannot be rendered on mobile portrait displays without severe clipping and squishing. Mobile uses a **dedicated, touch-first customizer sheet**:

```
┌────────────────────────────────────────────────────────┐
│  ⠿ CONTROL STRIP CUSTOMIZER                        (×) │
├────────────────────────────────────────────────────────┤
│  EDGE DOCKING PREFERENCE                               │
│  ┌───────────────────────┬───────────────────────────┐ │
│  │     ◧ Left Edge       │     ◨ Right Edge (✓)      │ │
│  └───────────────────────┴───────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  ACTIVE STRIP SLOTS (5 / 7 Used)                       │
│  [🐾 Tactile] [👗 Wardrobe] [🎭 Emotion] [✨ Live] [📸]│
├────────────────────────────────────────────────────────┤
│  [ Stage View ]  [ Actor & Wardrobe ]  [ AI & Gemini ] │ ← Category Tabs
├────────────────────────────────────────────────────────┤
│  ╭───────────────────────────────────────────────────╮ │
│  │ 🐾 Tactile & Zoom Mode                            │ │
│  │    Toggle between poke and pinch-to-zoom gestures │ │
│  │                                      [STRIP  (●)] │ │
│  ╰───────────────────────────────────────────────────╯ │
│  ╭───────────────────────────────────────────────────╮ │
│  │ 👗 Wardrobe Outfits                               │ │
│  │    Quick-swap character costumes and textures     │ │
│  │                                      [STRIP  (●)] │ │
│  ╰───────────────────────────────────────────────────╯ │
└────────────────────────────────────────────────────────┘
```

### Desktop vs. Mobile Feature Pruning

| Feature | Desktop Strip | Mobile Strip | Rationale |
| :--- | :---: | :---: | :--- |
| **Tactile / Zoom Mode** | ✅ | ✅ | Replaces desktop sliders with pinch-zoom & pan gestures. |
| **Wardrobe Outfits** | ✅ | ✅ | Fast costume changing overlay. |
| **Expressions Grid** | ✅ | ✅ | Instant emotion trigger overlay. |
| **Gemini Live Bidi Voice** | ✅ | ✅ | Real-time WebSocket voice session. |
| **Witness / Vision Capture**| ✅ | ✅ | 1-tap visual snapshot ingestion. |
| **Head-Tethered Captions** | ✅ | ✅ | Toggles live dialogue floating beside head. |
| **Always-on-Top** | ✅ | ❌ | Excluded on mobile (single-app mobile OS sandbox). |
| **Separate Window Hide** | ✅ | ❌ | Excluded on mobile (unified mobile stage viewport). |
| **Detached Chat Window** | ✅ | ❌ | Excluded on mobile (mobile uses slide-up sheet). |

---

## 6. WhisperDock Component Family & DRY Architecture

To maintain a single source of truth without bloating desktop leaf components or duplicating mobile logic:

```
WhisperDock Family
├── WhisperComposerBar.vue        ← Shared visual composer row ([+] · [✨] · [textarea] · [🎤] · [✈])
├── WhisperDock.vue               ← Desktop Actor-stage wrapper (4-state mouse hover/proximity, auto-dismiss)
├── MobileWhisperSheet.vue        ← Mobile touch wrapper (safe-area insets, 3 postures, drag gestures, ChatHistory)
├── useChatComposer.ts            ← Core state: message input, attachments, STT, optimistic send/rollback
└── useProducerSuggestions.ts     ← Extracted suggestion state controller (unifying actor.vue & mobile)
```

### The Three Mobile Postures

| Feature / State | Posture 1: Conversation (Default) | Posture 2: Immersive Voice | Posture 3: History Archive |
| :--- | :--- | :--- | :--- |
| **Primary Focus** | Balanced text & avatar interaction | Hands-free verbal intimacy & gaze | Transcript review & memory management |
| **Bottom Sheet State** | Compact input dock pinned above safe area | Collapsed into minimal notch with recording ring | Expanded full-height frosted glass sheet |
| **Head-Tethered Caption** | **Active** (displays live speech beside head) | **Active** (full focus on companion speech) | **Suppressed / Faded** (prevents duplicate text) |
| **Trigger / Transition** | App launch or sheet swipe-down | Tapping `[🎤]` voice button | Swiping up on grab handle `-` |

---

## 7. Head-Tethered Captions: Kinematics & Physics Guardrails

- **Primary files**: `packages/stage-shared/src/utils/caption-perspective.ts`, `packages/stage-ui/src/composables/use-speech-caption-player.ts`

1. **Lerp / EMA Smoothing Filter**: Damping `lerp(current, target, 0.15)` prevents 60fps frame jitter.
2. **Positional Dead-Band Threshold**: Dead-zone (`±5px` translation, `±2°` rotation) ignores idle breathing sway.
3. **Viewport Safe-Area Clamping & Auto-Pivot**: Clamped against Dynamic Island / notches; auto-pivots below chin if near top bezel.
4. **Pacing & 2–3 Line Segment Chunking**: Long responses stream in natural sentence chunks advancing with TTS audio.
5. **Expressive Silhouette Morphing**:
   - *Neutral dialogue*: Soft rounded pill with directional mouth tail.
   - *Flustered / Affection*: Scalloped border with warm blush wash.
   - *Tsundere / Irritation (e.g. Kira)*: Jagged comic-burst outline with anger mark `💢`.
   - *Inner thoughts*: Scalloped thought cloud with floating bubbles.
6. **Ephemeral Dismiss `(×)`**: Tapping `(×)` dismisses only the active utterance without disabling caption mode.

---

## 8. File Map & Dependency Index

| Area | File Path | Scope of Implementation |
| :--- | :--- | :--- |
| **Mobile Header** | `packages/stage-layouts/src/components/Layouts/MobileHeader.vue` | Profile capsule (`ProfileSwitcherPopover`) + 4-pill power strip (`Brain`, `Injections`, `Customizer`, `Settings`) & token line. |
| **Profile Switcher** | `packages/stage-ui/src/components/misc/profile-switcher-popover.vue` | Shared character & profile switcher popover with `placement` & `variant` support. |
| **Injections Popover** | `packages/stage-layouts/src/components/Layouts/MobileInjectionsPopover.vue` | Chat layout, sensor/memory/intrusion switches, Image Director & spawn modes. |
| **Control Strip** | `packages/stage-layouts/src/components/Layouts/MobileControlStrip.vue` | Vertical edge notch tab & 5–7 slot expandable strip (Left/Right dockable). |
| **Mobile Customizer** | `packages/stage-layouts/src/components/Layouts/MobileControlCustomizerDialog.vue` | Dedicated mobile sheet for slot selection and Left/Right edge preference. |
| **Shared Composer Bar**| `packages/stage-ui/src/components/scenarios/chat/WhisperComposerBar.vue` | Shared visual row (`[+]`, `[✨]`, input, `[🎤]`, `[✈]`) consuming `useChatComposer`. |
| **Mobile Whisper Sheet**| `packages/stage-layouts/src/components/Layouts/MobileWhisperSheet.vue` | Mobile touch wrapper with 3 postures, drag gestures, and collapsible `ChatHistory`. |
| **Desktop WhisperDock**| `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` | Desktop Actor-stage wrapper around `WhisperComposerBar`. |
| **Producer Suggestions**| `packages/stage-ui/src/composables/use-producer-suggestions.ts` | Extracted controller managing suggestion generation & count settings. |
| **Ambient Particle Canvas**| `packages/stage-layouts/src/components/Backgrounds/default/pattern-hearts.vue` | 60fps rising hearts particle canvas & digital pedestal. |
| **Head-Tethered Captions**| `packages/stage-shared/src/utils/caption-perspective.ts` | 2D/3D perspective math with EMA smoothing, dead-band, and safe-area clamping. |
| **Settings Footer** | `packages/stage-pages/src/pages/settings/index.vue` | Mount About dialog and build metadata at the bottom of Settings. |

---

## 9. Phased Implementation Roadmap

### Phase 1: Header Control Hub & Ambient Stage (Completed ✅)
1. Clean up `MobileHeader.vue`: Icon logo, token capacity bar.
2. Relocate About modal & build metadata to the bottom of `/settings`.
3. Implement the ambient dark backdrop with floating multi-toned heart particles and concentric circular pedestal.
4. Clean legacy floating buttons from `MobileInteractiveArea.vue`.

### Phase 2: Profile Capsule, Injections Popover, and Control Strip with Customizer
1. Mount shared `ProfileSwitcherPopover.vue` in `MobileHeader.vue` beside the logo for instant character/story hot-swapping.
2. Build `MobileInjectionsPopover.vue` (`[⚡]` button) matching the rich context injections & modes mockup.
3. Create dedicated `MobileControlCustomizerDialog.vue` (`[⊞]` button) supporting Left/Right edge preference and mobile-filtered slots.
4. Build `MobileControlStrip.vue` (14px edge notch tab with vertical 5–7 slot expansion, left/right docking, and touch gestures).

### Phase 3: WhisperDock Family & Three-Posture Sheet
1. Extract `useProducerSuggestions.ts` controller from `actor.vue`.
2. Build `WhisperComposerBar.vue` on top of `useChatComposer()`.
3. Refactor desktop `WhisperDock.vue` to wrap `WhisperComposerBar`.
4. Build `MobileWhisperSheet.vue` wrapping `WhisperComposerBar` with three postures (**Conversation**, **Immersive Voice**, **History Archive**) and drag gestures.
5. Replace input in `MobileInteractiveArea.vue` with `MobileWhisperSheet`.

### Phase 4: Head-Tethered Captions & Mobile TTS Vocalization
1. Wire `chatStore.onAfterMessageComposed` in `apps/stage-pocket` to `useSpeechStore().generateSpeechBuffered(...)`.
2. Connect Live2D / VRM model lipsync to WebAudio PCM playback.
3. Integrate head-tethered live captions over the avatar with EMA smoothing, dead-band threshold, and safe-area clamping.

### Phase 5: Verification & Performance Tuning
1. Validate on iOS Simulator (iPhone 17) via live HMR.
2. Verify smooth 60fps gesture transitions and 0% CPU burn when idle.
