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

### 4.2 Left or Right Edge Docking & Opposite-Edge Dynamic Docking (`dockedEdge`)
- Users can choose whether the Control Strip docks against the **Left Edge** or **Right Edge** of the screen (`dockedEdge: 'left' | 'right'`), optimizing for left-handed vs. right-handed one-handed thumb use.
- **Opposite-Edge Chatbox Coordination (Landscape & Desktop)**: To eliminate UI collision and maximize viewport balance, the chatbox (`InteractiveArea`) automatically and fluidly anchors to the **exact opposite edge** of the Control Strip:
  - When `dockedEdge === 'right'` (Default) ➔ **Control Strip**: Right edge (`right-0`) · **Chatbox**: Left edge (`left-6`).
  - When `dockedEdge === 'left'` ➔ **Control Strip**: Left edge (`left-0`) · **Chatbox**: Right edge (`right-6`).

```
       [Right Edge Docked (Default)]                         [Left Edge Docked]
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│ ┌──────────────┐          ╭─╮ (14px)   │       │   (14px) ╭─╮          ┌──────────────┐ │
│ │   Chatbox    │  Avatar  │«│ Control  │  OR   │  Control │»│  Avatar  │   Chatbox    │ │
│ │ (Interactive)│  Stage   ╰─╯  Strip   │       │   Strip  ╰─╯  Stage   │ (Interactive)│ │
│ └──────────────┘                       │       │                       └──────────────┘ │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
```

### 4.3 Orientation-Aware Responsive Layout (`isPortraitMobile`)
To seamlessly support mobile phones, landscape rotations, foldable devices, and tablets:
- **`isLandscape` Detection**: Computed via `useMediaQuery('(orientation: landscape)')`.
- **`isPortraitMobile` Guard**: `computed(() => breakpoints.smaller('md').value && !isLandscape.value)`.
- **Layout Switching**:
  1. **Portrait Handheld (`isPortraitMobile === true`)**: Centers the companion vertically above the bottom `MobileWhisperSheet` dock, with the Control Strip 14px tab flush on the selected edge.
  2. **Landscape Handheld / Tablet / Desktop (`isPortraitMobile === false`)**: Seamlessly activates the side-by-side companion theatre layout, centering the avatar between the edge-docked Control Strip and the opposite-edge `InteractiveArea` chatbox.

### 4.4 Expand / Collapse Touch Physics
- **Collapsed**: A subtle 14px rounded glass tab (`╭─ ⠿ ─╮`) rests flush against the screen bezel.
- **Expanded**: Tapping or swiping inward expands the **vertical translucent pill** anchored to that edge with fluid spring easing (`slide-in-from-right` or `slide-in-from-left`).
- **Auto-Collapse**: Tapping the stage or swiping back toward the bezel re-docks it into the tab.

### 4.5 Touch Viewport Paradigm (Replacing Clumsy Desktop Sliders)
In legacy mobile, opening coordinate controls spawned desktop-oriented slider inputs that hijacked touch events and froze the screen. Under the Control Strip model:
- **Pointer Cursor Cycler (`[↖] i-solar:cursor-bold-duotone`)**: Replaced generic refresh arrows with an intuitive pointer cursor icon whose symbol color dynamically synchronizes with the active interaction mode:
  - **Tactile Mode**: Rose cursor (`text-rose-500`) + Rose dot badge. Poking triggers physical Live2D reactions without coordinate drift.
  - **Drag Mode**: Orange cursor (`text-orange-500`) + Orange dot badge. 1-finger drag pans the model smoothly (`position.x`, `position.y`).
  - **Positioning Mode**: Emerald cursor (`text-emerald-500`) + Emerald dot badge. Pinch-to-zoom scales the avatar model (`scale`).
  - **Orbit Mode**: Indigo cursor (`text-indigo-500`) + Indigo dot badge. Drag rotates camera viewport around 3D/VRM environments.
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

## 6. WhisperDock Family & Dual-Mode Mobile Posture Architecture

To maintain a single source of truth without bloating desktop leaf components or duplicating mobile logic:

```
WhisperDock Family
├── WhisperComposerBar.vue        ← Shared visual composer row ([+] · [✨] · [textarea] · [🎤] · [✈])
├── WhisperDock.vue               ← Desktop Actor-stage wrapper (4-state mouse hover/proximity, auto-dismiss)
├── MobileWhisperSheet.vue        ← Unified mobile touch wrapper (safe-area insets, 3 postures, dual presentation modes)
├── useChatComposer.ts            ← Core state: message input, attachments, STT, optimistic send/rollback
└── useProducerSuggestions.ts     ← Extracted suggestion state controller (unifying actor.vue & mobile)
```

### 6.1 Dual Presentation Modes (Translucent HUD vs. Frosted Sheet)

Mobile users interact with companions across diverse aesthetic preferences. To support both Visual Novel / HUD immersion and high-contrast message archiving, the mobile chat container supports two distinct presentation modes, switchable via a 1-tap toggle in the posture handle strip:

1. **Mode A: Translucent HUD (Floating Canvas — Anime VN Style)**:
   - Container background is `bg-transparent border-transparent shadow-none`.
   - Chat bubbles float directly over the 3D/2D avatar canvas.
   - The top of the message stream applies a soft vertical CSS gradient mask (`mask-image: linear-gradient(to bottom, transparent 0%, black 20%)`) so messages gracefully dissolve as they scroll upward toward the header.
   - Preserves 100% avatar visibility behind active conversation.

2. **Mode B: Frosted Sheet (Encased Card — Traditional Mobile Style)**:
   - Container is encased in a frosted backdrop-blur sheet (`bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl border-t border-neutral-200/40 dark:border-neutral-800/40`).
   - Guarantees 100% text contrast and readability against complex, bright, or rapidly moving 3D scenes.

### 6.2 The Four Unified Mobile Postures

| Feature / State | Posture 1: `voice` (Voice Capsule) | Posture 2: `composer` (Dock Only) | Posture 3: `preview` (~40–50vh) | Posture 4: `history` (~85vh Full) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Focus** | Hands-free verbal intimacy & gaze | Clean stage canvas with quick input access | Conversational back-and-forth & recent turns | In-depth transcript review, editing & memory actions |
| **Translucent HUD Presentation** | Minimal floating voice capsule pill | Bottom composer dock pinned above safe area | Recent 1–2 messages floating with top gradient dissolve | Full-height message stream extending to header with top fade |
| **Frosted Sheet Presentation** | Minimal floating voice capsule pill | Bottom composer dock pinned above safe area | Classic half-sheet card overlaying bottom half of stage | Full-height sheet container with edge-to-edge scroll |
| **Head-Tethered Caption** | **Active** (focused on companion speech) | **Active** (displays live speech beside head) | **Active** (companion speech tethered or inline) | **Suppressed / Faded** (prevents duplicate text) |
| **Trigger / Transition** | Tapping `[🎤]` voice button | Swiping down to bottom / tap chevron-down | Sending a message / tapping grab handle / chevron-up | Swiping up to max height / tapping grab handle / chevron-up |

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

### Phase 6: Dual-Mode Mobile Chat & Cross-Platform Unification (Completed ✅)
1. Unify `MobileWhisperSheet.vue` across `stage-pocket` and `stage-web` portrait mode.
2. Implement 1-tap mode toggle (Translucent Floating HUD vs. Frosted Sheet) in the drag strip.
3. Wire the soft top gradient mask (`mask-image: linear-gradient(...)`) on the translucent message stream spanning Preview (~40vh) and Full-Height (~85vh) postures.
4. Retire legacy slim input in `MobileInteractiveArea.vue`.

### Phase 7: Priority Feature Track & Major Pending Items

1. **Double-Tap Stage Canvas Coordinate Reset Gesture**:
   - Native double-tap/double-click pointer handler on `WidgetStage` canvas to instantly reset `position.x`, `position.y`, and `scale` to default center without needing the control strip button.
2. **Expressive Speech Bubble Silhouettes for 3D/VRM & Spine**:
   - Currently fully spec'ed and implemented for Live2D models; extend dynamic emotion-morphing balloon shapes (flustered blush scalloping, tsundere burst outline with `💢`, thought bubbles) to 3D/VRM and Spine avatar rendering pipelines.
3. **Autonomous Artistry Spawn Mode Routing across Viewports**:
   - Complete multi-viewport visual manifest routing (`Background` vs. `Widget` vs. `Inline`) spanning single-window mobile/web (`stage-web`, `stage-pocket`) and multi-window desktop (`stage-tamagotchi`).
4. **"Sign In with Cloudflare" Zero-Trust Edge Ecosystem & Cross-Device Restore (Top Priority / High Traffic Path)**:
   - Activates Step 2 ("Choose Your Path") in Onboarding (`OnboardingV2` / `step-1-mode-selection.vue`):
     - **Option 1: Local Companion (Offline)**: 100% private on-device setup.
     - **Option 2: Sign In with Cloudflare**: Zero-Trust edge relay and automated cloud sync without manual S3/R2 credential entry.
   - Deploys and connects to user-owned `airi-edge-vault` KV namespace on Cloudflare's free edge tier.
   - 1-click authorization instantly restores all character cards, long-term memories, voice profiles, and settings on fresh installs, mobile devices, and browser web instances without third-party app verification friction.
   - Integrates with generic Cloudflare Worker Deployment Framework (`docs/project-generic-cloudflare-framework-plan.md`) for CORS Proxy, Always-On Discord Relays, and Edge Vaults.

---

## 10. Lessons Learned

### L-01 · Vue `<Transition>` + Scoped CSS = Invisible Elements (Critical Bug Pattern)

**Symptom**: A popover or modal mounts in the DOM (confirmed via DevTools — correct HTML, correct z-index, `display: flex`, `pointer-events: auto`), but `opacity` is permanently `0`. The element is there but invisible and cannot be interacted with.

**Root Cause**: Vue's `<Transition>` component applies CSS class names like `popover-fade-enter-from` and `popover-fade-enter-active` to trigger the animation. When the transition CSS is in a `<style scoped>` block, Vue hashes the selector to e.g. `.popover-fade-enter-from[data-v-b45c11cd]`. In certain build configurations (particularly with UnoCSS or custom Vite plugins active), the hash on the compiled CSS does not match the hash emitted on the element in the same tick, so the `enter-from → enter-to` transition never fires. The element stays stuck at `opacity: 0` for its lifetime.

**How We Found It**: DOM probe (`document.querySelector(...).classList`) showed the element had both `popover-fade-enter-from` and `popover-fade-enter-active` classes simultaneously without `enter-to` ever being applied. `getComputedStyle(...).opacity` confirmed `"0"`.

**Fix**: Remove the `<Transition>` wrapper entirely. Popovers and modals mount/unmount instantly via `v-if` — no animation. This is functionally clean and avoids the bug.

**Files Affected**: `BrainModelPicker.vue`, `MobileUtilityPopover.vue`, `MobileSessionSwitcherPopover.vue`, `WhisperComposerBar.vue`.

**Rule Going Forward**: Never use `<Transition>` with `<style scoped>` CSS class names for popovers/modals in this project. If animation is needed, use either:
- **Inline style transitions** on the element itself (`style="transition: opacity 0.15s"`)
- **Global (non-scoped) CSS** in `index.css` or an unscoped `<style>` block
- **`<Teleport to="body">`** moves the element out of the scoped subtree, but the scoped CSS hash issue can still apply — remove `<Transition>` regardless

---

### L-02 · Vue `<KeepAlive :include>` Requires `defineOptions({ name })` to Match

**Symptom**: Navigating away from the main stage page (e.g. to `/settings/stage`) and back causes the 3D model, WebGL canvas, and floating hearts to disappear. Clicking back restores the route but the stage is blank.

**Root Cause**: `App.vue` wraps `<RouterView>` in `<KeepAlive :include="['IndexScenePage', 'StageScenePage']">`. Vue KeepAlive matches against the component's **internal `name` option** — not the route filename or route meta. Without `defineOptions({ name: 'IndexScenePage' })` in `index.vue`, Vue assigns the default name `index`, which does not match, so the component is unmounted and remounted on every navigation, tearing down the WebGL context.

**Fix**: Add `defineOptions({ name: 'IndexScenePage' })` to `apps/stage-pocket/src/pages/index.vue`.

---

### L-03 · Onboarding Wizard Overlay & Clean-Slate Auto-Launch Lifecycle

**Symptom**: On cold boot with a clean slate, the onboarding setup wizard was not displaying, or when dismissed temporarily, the overlay could block clicks if not cleanly bound to persisted onboarding flags.

**Root Cause**: In `packages/stage-ui/src/stores/onboarding.ts`, `needsOnboarding` is computed from `!hasSkippedSetup.value && !hasCompletedSetup.value` (persisted under `onboarding/skipped` and `onboarding/completed`). If `onboardingStore.showingSetup` was not initialized from `needsOnboarding` on mount, clean installs would skip the setup wizard entirely. Conversely, if closing the modal emitted `@configured` prematurely, `hasCompletedSetup` was wrongly flagged as true.

**Fix**:
1. On app boot (`App.vue` `onMounted`), check `if (onboardingStore.needsOnboarding) { onboardingStore.showingSetup = true }` so first-run clean slate launches the Companion Setup Wizard.
2. Only mark `hasCompletedSetup` as true when the user actually completes the wizard (Step 7 Launch), and only mark `hasSkippedSetup` as true when the user explicitly clicks "Skip Permanently". Simply closing/minimizing the sheet without completing leaves the flag unset so the wizard can prompt again on cold boot until configured or permanently dismissed.

---

### L-04 · Capacitor WKWebView Requires `createWebHashHistory` (White Screen Prevention)

**Symptom**: On iOS Simulator / web dev server, the app loaded and rendered properly, but on real physical devices installed via TestFlight (production Capacitor bundle), the app booted into a solid white screen.

**Root Cause**: In `apps/stage-pocket/src/main.ts`, the router was configured with `createWebHistory()` (HTML5 pushState history). When packaged natively inside Capacitor for iOS, WKWebView serves the local asset bundle from `capacitor://localhost/index.html`. `createWebHistory()` parses `window.location.pathname` as `"/index.html"`. Because Vue Router only defined routes for `"/"`, `"/settings"`, etc., `/index.html` resulted in zero matched routes (`matched: []`). `<RouterView>` rendered `undefined`, yielding a completely blank white screen.

**Fix**: Always configure `createRouter({ history: createWebHashHistory() })` for `apps/stage-pocket`. Hash routing (`capacitor://localhost/index.html#/`) maps `#` / `#/` directly to the `/` root route, completely avoiding the `/index.html` path mismatch in native WKWebView. In addition, always ensure `npx cap sync ios` is executed after running `pnpm -F @proj-airi/stage-pocket build` to copy the fresh `dist/` bundle into `apps/stage-pocket/ios/App/App/public/` before creating Xcode archives.

---

### L-05 · `unplugin-vue-router` Multi-Root Directory Shadowing & Single-Window Back Routing

**Symptom**: In `stage-web`, navigating to `/settings` resulted in a blank page or was unable to navigate back to `/`.

**Root Cause**:
1. When `apps/stage-web/src/pages/settings/` exists as a local folder, `unplugin-vue-router` groups routes under `settings/` but requires an explicit `index.vue` in that directory rather than automatically falling through to `packages/stage-pages/src/pages/settings/index.vue`.
2. A legacy router guard (`if (from.meta.rootOfSettings && to.path === '/') return false`) intended strictly for multi-window Electron (`stage-tamagotchi`) was erroneously copied into `apps/stage-web/src/main.ts`, trapping web users on the settings page.

**Fix**: Explicitly mount `SettingsIndexPage` in `apps/stage-web/src/pages/settings/index.vue` with `titleKey: settings.title`, and ensure single-window applications (`stage-web`, `stage-pocket`) always allow returning to the home stage (`/`).

---

### L-06 · Opposite-Edge Docking & Orientation-Aware Reactive Layouts

**Symptom**:
1. In landscape and desktop viewports, the side chatbox collided or overlapped with the Control Strip tab when both were anchored to the same edge.
2. In `apps/stage-pocket`, changing the edge docking preference in Settings moved the Control Strip but left the chatbox statically hardcoded to `right-4`.
3. In handheld devices rotated sideways, screens with narrow pixel dimensions triggered the portrait bottom sheet (`MobileWhisperSheet`), taking up the full height and obscuring the companion.

**Root Cause**:
1. `dockedEdge` in `useSettingsControlStrip` was not persistent and lacked a layout coordinator to dynamically assign opposing anchors.
2. Breakpoints were checking only `width < 768px` (`breakpoints.smaller('md')`), which miscategorized mobile landscape orientations (e.g. 667x375) as portrait mobile.

**Fix**:
1. Persist `dockedEdge` in `useLocalStorageManualReset<'left' | 'right' | 'top' | 'bottom'>('settings/control-strip/docked-edge', 'right')`.
2. Compute `isLandscape = useMediaQuery('(orientation: landscape)')` and define `isPortraitMobile = computed(() => breakpoints.smaller('md').value && !isLandscape.value)`.
3. In single-window applications (`stage-web` and `stage-pocket`), dynamically set `InteractiveArea`'s class to `:class="[dockedEdge === 'left' ? 'right-6' : 'left-6', ...]"` when `!isPortraitMobile`, ensuring zero UI collision between the Control Strip and Chatbox.



