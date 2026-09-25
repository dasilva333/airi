<picture>
  <source
    width="100%"
    srcset="./docs/content/public/banner-dark-1280x640.avif"
    media="(prefers-color-scheme: dark)"
  />
  <source
    width="100%"
    srcset="./docs/content/public/banner-light-1280x640.avif"
    media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
  />
  <img width="250" src="./docs/content/public/banner-light-1280x640.avif" alt="Project AIRI" />
</picture>

<h1 align="center">Project AIRI</h1>

<p align="center"><strong>Presence without custody.</strong></p>

<p align="center">
  A private, persistent character who can remember, perceive, speak, appear, and act—
  without surrendering ownership of their life to a platform.
</p>

<p align="center">
  Built for AI companions, virtual characters, and anyone who wants more than a chatbot wearing an avatar.
</p>

---

## A character, not a collection of features

AIRI is a character runtime.

The character has an identity that can be carried, senses that can be changed, a voice that can be replaced, bodies that can be exchanged, memories that can deepen, and tools that can extend what they are able to do. Those faculties may evolve independently. The character connecting them should remain continuous.

That is the promise of this fork: **one enduring presence across conversations, models, bodies, applications, and machines—owned by the person who shares a life with it.**

## The character stack

| Faculty | What AIRI provides |
|---|---|
| **Identity** | Portable AIRI Cards, character profiles, generation behavior, acting direction, and per-character configuration |
| **Continuity** | Short-term memory, long-term journals, lifetime archives, echo chips, timelines, and isolated story universes |
| **Perception** | Hearing, screen vision, image understanding, desktop awareness, attention gating, and environmental context |
| **Mind** | Interchangeable cloud or local models, provider instances, prompt composition, ACT interpretation, and cognitive pipelines |
| **Voice** | Swappable speech and transcription engines, voice profiles, Audio Studio processing, captions, and live audio |
| **Body** | VRM, Live2D, MMD, and Spine renderers with expressions, motion, tactile interaction, wardrobe, and texture editing |
| **Agency** | Proactivity, MCP tools, artistry, production direction, games, and actions that can continue beyond the chat composer |
| **World** | Desktop stages, web and pocket surfaces, Discord, scenes, sidecars, and other places the same character can inhabit |
| **Sovereignty** | Local-first storage, portable character data, optional user-owned cloud sync, and no developer-operated analytics |

The complete implementation catalog lives in the [feature report](https://dasilva333.github.io/airi/en/docs/chronicles/feature-report). The [showcase](https://dasilva333.github.io/airi/en/docs/showcase/) presents the major experiences visually. For an evidence-backed architectural landscape comparing 11 desktop AI companions (VPet, Project N.E.K.O., Open-LLM-VTuber, Komorebi, Amica, NekoGPT, etc.), see [**COMPARISONS.md**](COMPARISONS.md).

---

## Capability comparison

> **Legend**: ✅ Implemented capability · ◐ Partial capability · ❌ No equivalent integrated implementation found in the inspected source. These describe feature scope, not bug-free certification.

| Capability | This Fork | Upstream |
| :--- | :---: | :---: |
| **Registered AI provider integrations**¹ | **77** | 69 |
| **Built-in on-device inference engines**² | **9** | 2 |
| **Account-backed portable provider vault**³ | ✅ (Cloudflare R2/KV) | ❌ |
| **Direct provider & model selection**⁴ | ✅ (Full User Custody) | ◐ (Chat/Vision locked to `Auto`) |
| **Prepaid proprietary inference proxy**⁵ | ❌ (Direct Vendor APIs) | ✅ (Stripe / Flux Credits) |
| **Guided free-tier catalog & preset templates**⁶ | ✅ (Planned / In Design) | ❌ |
| [**Interactive Live2D scripts, choices, and discoverable gimmicks**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/live2d-runtime/src/dsl/interpreter.ts) | ✅ | ❌ |
| [**Live2D motion recording and keyframe timeline editing**](https://github.com/moeru-ai/airi/blob/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-ui/src/features/devtools/motion/live2d/devtools.vue) | ❌ | ✅ |
| [**Generate reusable VRM animations from text**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/stores/modules/text-to-motion.ts) | ✅ | ❌ |
| [**Emotion- and dialogue-triggered VRM auras/VFX**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui-three/src/components/ThreeScene.vue) | ✅ | ❌ |
| [**Head-following captions with animated mood effects**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui-live2d/src/composables/live2d/head-tethered-caption.ts) | ✅ | ❌ |
| [**Head-anchored radial controls for the desktop companion**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/components/scenes/HeadTetheredRadialMenu.vue) | ✅ | ❌ |
| [**Tachie avatars with emotion-based illustration switching**](https://github.com/moeru-ai/airi/tree/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-ui-tachie) | ❌ | ✅ |
| [**Edit avatar textures in-app, including AI edits and model export**](https://github.com/dasilva333/airi/tree/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/components/scenarios/settings/model-settings) | ✅ | ❌ |
| [**Reusable actor, outfit, and scene presets with model/voice/prompt bindings**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/docs/content/en/docs/manual/config/studio.md) | ✅ | ❌ |
| [**Switch actors and voices within dialogue at playback time**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/components/scenes/ControlStripHost.vue) | ✅ | ❌ |
| [**Autonomous scene direction with persistent visual continuity**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/stores/modules/artistry-autonomous.ts) | ✅ | ◐ Partial |
| [**Production Studio with cast inspection and Director decision history**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-pages/src/pages/settings/airi-card/components/tabs/ProductionStudioTab.vue) | ✅ | ❌ |
| [**Rehearse acted dialogue and generate model-specific acting instructions**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue) | ✅ | ❌ |
| [**Reusable voice profiles with an audio-effects studio**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue) | ✅ | ❌ |
| [**Contextual spoken fillers while waiting for an answer**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.ts) | ✅ | ❌ |
| [**Consolidate conversations and journals into lifetime memory**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/stores/memory-lifetime.ts) | ✅ | ❌ |
| [**Back up and selectively sync to your own S3/R2 storage**](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-pages/src/pages/settings/modules/cloud-sync.vue) | ✅ | ❌ |

<small>

¹ **77 versus 69** counts distinct registered integrations across chat, vision, TTS, and STT in the primary provider registry, excluding "None" and virtual wrappers. It does not count companies, models, or separate Artistry backends.<br>
² **9 versus 2** counts native embedded on-device runtimes (Web-RWKV, WebLLM, Moondream, Whisper ONNX, Kokoro ONNX, FlowMDM, etc.). Upstream embeds Kokoro and Apple Speech. Separately installed local servers are excluded. FlowMDM is represented by the motion row. Audited snapshots: fork <code>fc46a6e</code>, upstream <code>42e3e9e</code>.<br>
³ **Portable Provider Vault**: This fork enables users to sign in once via their private Cloudflare account to synchronize and restore API credentials and multi-instance configurations across desktop, web, and mobile without third-party escrow. Upstream syncs settings to its proprietary cloud account.<br>
⁴ **Inference Custody**: Upstream's hosted service hardcodes chat and vision models to an opaque <code>Auto</code> gateway route where the operator chooses the underlying LLM. This fork preserves direct user choice over every endpoint, model, and parameter.<br>
⁵ **Prepaid Inference**: Upstream operates a turnkey paid gateway where users purchase "Flux" credits via Stripe without obtaining third-party API keys. This fork deliberately does not operate an inference business, favoring direct-to-provider keys, local engines, and free-tier aggregation.<br>
⁶ **Free-Tier Catalog**: In design under <code>docs/design-free-ai-catalog-and-resilient-fallback.md</code> to provide in-app discovery, quick presets, and client-side failover for dozens of free provider tiers.

</small>

<details>
<summary><b>Meaningful distinctions behind the capabilities</b></summary>

- **Studio is a scene-authoring system:** A concept can bind an avatar, voice, expression state, background, image-prompt fragment, and generation overrides. Base and Layer concepts let users compose locations, actors, outfits, and atmosphere. The implementation supports both Director-driven changes and actor-driven presets—including pinned backgrounds with autonomous generation disabled. [Studio manual](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/docs/content/en/docs/manual/config/studio.md).
- **Actor handoff measures performance behavior:** Playback distinguishes the actor whose tokens are being parsed from the actor currently speaking. It resolves voices for synthesis ahead of time and activates the actor when their marker reaches playback. A single reply can perform multiple speaking roles with their corresponding avatars and voices.
- **Artistry's "Partial" is specific and earned:** Upstream already evaluates recent conversation, scores whether an image is warranted, generates it, and routes it to the background, chat, a floating widget, or both. This fork adds a persistent visual scratchpad, concept selection and composition, configurable history depth, a separate Director model option, and durable decision records. The Director also distinguishes scene management from the currently speaking actor's model ownership. [Upstream implementation](https://github.com/moeru-ai/airi/blob/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-ui/src/stores/modules/artistry-autonomous.ts), [Director controls](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue).
- **Studio interfaces expose depth to users:** The character configuration contains the concept registry, active stack, concept editor, and recent Director decisions. The chatbox provides dedicated Artistry surfaces (Director's Monitor, Cast Review, Scene Vault, Stage Directives) alongside a Rehearsal Room for testing dialogue, expressions, motions, and VFX through the speech/stage pipeline. [Chatbox navigation](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/apps/stage-tamagotchi/src/renderer/pages/chat.vue).
- **Live2D interactivity vs. motion editing:** This fork executes state variables, eligibility conditions, choices, chained actions, costume commands, expressions, and sound. The introspector exposes discovered switches, wardrobes, parts, and reactions through the Gimmick Deck and Model Customizer for compatible authored packages. Upstream provides a dedicated motion workbench with direct controls, recording, playback, and keyframe editing. [Gimmick introspection](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui-live2d/src/interpreter/introspector.ts), [Model Customizer](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue).
- **Animation and presentation deliberate limits:** Text-to-motion has generation, library storage, export, and playback paths, but the chat tool limits support to VRM. The verified production VFX path attaches auras to VRM bones. Head-following captions add mood effects and paced presentation, while the radial menu supplies companion positioning/display controls. [Motion tool format checks](https://github.com/dasilva333/airi/blob/fc46a6e5643db37445e1541bd735ccd9ce6bb34e/apps/stage-tamagotchi/src/renderer/stores/tools/builtin/generate-motion.ts).
- **Memory and sync precision:** Upstream has saved conversations and image journaling; long-term companion-memory settings remain WIP in this snapshot. This fork consolidates conversations into persistent lifetime relationship artifacts, and supplies user-owned S3/R2 backup and selective sync. [Upstream memory page](https://github.com/moeru-ai/airi/blob/42e3e9e8573d3159d40e637fa11a21e13398ebda/packages/stage-pages/src/pages/settings/modules/memory-long-term.vue).

</details>

---

## Design principles

### Character before interface

AIRI should present as somebody, not as a dashboard of AI capabilities. Every surface should strengthen identity, continuity, perception, expression, or agency.

### Continuity before novelty

A clever interaction matters less than whether the character remembers what happened, understands where they are, and remains recognizable when their model, provider, body, or device changes.

### Replaceable faculties, persistent identity

The LLM is not the character. Neither is the voice, renderer, memory engine, or host application. Each is a faculty that can be exchanged without discarding the character at the center.

### Local by default, cloud by choice

Characters, conversations, memories, settings, and assets live on the user's machine by default. Cloud synchronization is optional and uses storage chosen or controlled by the user.

### Daily-driver quality

This fork favors finished, testable paths over indiscriminate accumulation. Upstream changes are reviewed selectively, and work is shaped around an AIRI that can remain present every day.

---

## Privacy & Data Sovereignty

> **Your companion belongs to you.**

An AI companion interacts with your most personal thoughts, daily habits, emotional states, and desktop activities. In Project AIRI, **local-first runtime and user custody are non-negotiable architectural requirements**, not marketing afterthoughts.

### Privacy & Trust Matrix

| Dimension | Architectural Policy & Reality |
| :--- | :--- |
| **Telemetry & Analytics** | **0 telemetry.** No analytics scripts, no tracking pixels (no PostHog, Plausible, or Google Analytics), and no error/crash reporting pings. |
| **Backend & Operators** | **No server operator exists.** There is no Project AIRI database or central relay. The web stage is hosted as static assets via GitHub Pages. |
| **Local Storage** | **Local-first.** All cards, chat sessions, journals, memories, assets, and settings live in browser/Electron IndexedDB on your machine. |
| **Cloud Synchronization** | **Optional & User-Authorized.** Syncs directly to your own Cloudflare infrastructure (Workers, R2, KV) via Cloudflare Access (PKCE). |
| **Data Custody** | **Cloudflare and you.** The developer holds no keys, tokens, or infrastructure access. Your R2 bucket acts as your private raw backup. |
| **What Leaves the Device?** | In local mode, nothing leaves your device. When Cloud Sync is active, application state syncs to your private R2/KV; machine-local hardware settings (audio devices, per-device Discord toggles) stay strictly local. |
| **Discord Cloud Presence** | When enabled, the cloud worker operates as a remote presence using your synced state in KV/R2 while your local desktop stage is powered off. |
| **Retention & Purging** | Disabling sync halts all uploads while preserving remote state. You can completely purge all cloud data directly from the in-app Cloud Relay tab or the Cloudflare dashboard. |

*For the complete architectural trust model, data boundary breakdown, and security specifications, see [**PRIVACY.md**](./PRIVACY.md).*

---

## Download

<p float="left" align="center">
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.34-stable.20260924/airi-dasilva333-0.9.34-stable.20260924-windows-x64-setup.exe">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.windows.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.windows.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.windows.light.en-US.avif" alt="Download AIRI for Windows" />
    </picture>
  </a>
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.34-stable.20260924/airi-dasilva333-0.9.34-stable.20260924-darwin-arm64.dmg">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.macos.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.macos.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.macos.light.en-US.avif" alt="Download AIRI for macOS" />
    </picture>
  </a>
  <a href="https://github.com/dasilva333/airi/releases/latest">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.linux.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.linux.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.linux.light.en-US.avif" alt="Download AIRI for Linux" />
    </picture>
  </a>
</p>

<p float="left" align="center">
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.34-stable.20260924/AIRI-0.9.34-stable.20260924-android.apk">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.mobile.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.mobile.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.mobile.light.en-US.avif" alt="Download AIRI for Android" />
    </picture>
  </a>
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.34-stable.20260924/AIRI-0.9.34-stable.20260924-ios.ipa">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.mobile.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.mobile.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.mobile.light.en-US.avif" alt="Download AIRI for iOS" />
    </picture>
  </a>
  <a href="https://github.com/dasilva333/airi/releases/latest">
    <picture>
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.browser.dark.en-US.avif"
        media="(prefers-color-scheme: dark)"
      />
      <source
        width="33%"
        srcset="./docs/content/public/assets/download-buttons/download-buttons.browser.light.en-US.avif"
        media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)"
      />
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.browser.light.en-US.avif" alt="Open the web release" />
    </picture>
  </a>
</p>

See [all releases](https://github.com/dasilva333/airi/releases/latest) for checksums, alternate packages, and the newest available build.

---

## What it feels like to use

Create or import a character, then choose the faculties that fit them:

- give them a cloud model or a fully local mind
- assign speech, hearing, vision, and a display model independently
- let memory accumulate without mixing unrelated characters or story universes
- allow carefully scoped proactive behavior and tools
- meet the same character through the desktop stage, chat workspace, mobile client, Discord, or another connected surface
- export the character and their portable assets instead of leaving them trapped inside one installation

AIRI can be a quiet desktop companion, a voiced character on stage, a creative collaborator, a roleplay partner, or an autonomous presence. The architecture does not force every character into the same shape.

## Privacy and ownership

This fork is built around a zero-trust relationship with its developer:

- no PostHog
- no developer-operated telemetry or behavioral analytics
- local-first character, conversation, memory, configuration, and asset storage
- cloud synchronization disabled by default
- optional BYOS synchronization through user-selected S3, Cloudflare R2, or Google AppData infrastructure
- portable AIRI Card import and export

Using a hosted model, speech service, or other external provider still sends the information required for that request to the provider you configure. AIRI makes that dependency selectable; it cannot replace the provider's own privacy terms. Local inference paths are available for users who want to keep more of the stack on-device.

For the storage and synchronization boundaries, see the [Rosetta Stone](./docs/rosetta-stone.md) and [BYOS cloud-sync design](./docs/project-byos-cloud-sync.md).

## One character, many implementations

The repository is organized so that the character is not fused to any single service or renderer:

- **AIRI Cards** carry portable identity and character-specific modules.
- **Provider registries** separate metadata and capabilities from configured provider instances.
- **Runtime services** isolate provider lifecycle, validation, model loading, and instance management.
- **Stage renderers** provide interchangeable VRM, Live2D, MMD, and Spine bodies.
- **Shared UI packages** let desktop, web, and pocket surfaces consume the same character systems.
- **Namespaced persistence** keeps characters, sessions, memories, media, and settings independently addressable.
- **Tool bridges and standalone modules** add abilities without redefining the character core.

The [architecture Rosetta Stone](./docs/rosetta-stone.md) maps those systems to their source locations.

---

## Run from source

For complete contribution and environment guidance, read [CONTRIBUTING.md](./.github/CONTRIBUTING.md).

### Requirements

- Node.js 20.14 or newer
- pnpm 10 or newer

### Desktop — Stage Tamagotchi

The desktop application is the canonical daily-driver surface.

~~~shell
pnpm i
pnpm dev:tamagotchi
~~~

One-click helper scripts are also included:

| Script | Platform | Purpose |
|---|---|---|
| <code>start_airi.bat</code> | Windows | Build packages and launch AIRI; prompts for the development port |
| <code>start_airi.sh</code> | macOS/Linux | Unix equivalent with output written to <code>airi.log</code> |
| <code>start_airi_hiperf.bat</code> | Windows | Use the high-performance GPU and an 8 GB Node heap |
| <code>start_airi_skipdl.bat</code> | Windows | Launch without downloading assets that are already cached |
| <code>start_airi_customport.bat</code> | Windows | Launch on a chosen port to recover data associated with that origin |
| <code>install.bat</code> | Windows | Install pnpm and dependencies, build packages, and launch |

A Nix package is available:

~~~shell
nix run github:dasilva333/airi
~~~

On NixOS, use the included FHS shell for Electron dependencies:

~~~shell
nix develop .#fhs
pnpm dev:tamagotchi
~~~

### Web — Stage Web

Run the backend and frontend in separate terminals:

~~~shell
pnpm dev:server
~~~

~~~shell
pnpm dev:web
~~~

### Mobile — Stage Pocket

~~~shell
pnpm dev:pocket:ios <DEVICE_ID_OR_SIMULATOR_NAME>
~~~

Or:

~~~shell
CAPACITOR_DEVICE_ID=<DEVICE_ID_OR_SIMULATOR_NAME> pnpm dev:pocket:ios
~~~

List available targets with:

~~~shell
pnpm exec cap run ios --list
~~~

For wireless server-channel development, start Tamagotchi with the required network privileges and enable secure WebSocket support under <code>settings/system/general</code>.

### Documentation

~~~shell
pnpm dev:docs
~~~

---

## Models, voices, and providers

AIRI supports interchangeable hosted and local services across chat, vision, speech, transcription, image generation, and real-time audio.

That includes OpenAI-compatible endpoints, OpenRouter, Anthropic, Gemini, DeepSeek, Qwen, xAI, Ollama, vLLM, SGLang, Cloudflare Workers AI, Bedrock, Deepgram, Chatterbox, AWS Polly, Gemini Live, local Whisper and Kokoro, MOSS-TTS-Nano, and WebGPU RWKV-7.

The provider system supports multiple configured instances rather than treating a provider name as a single global account. See the [provider catalog](./docs/provider-catalog.md) for the current capability matrix and implementation paths.

## Documentation map

| Document | Use it for |
|---|---|
| [Showcase](https://dasilva333.github.io/airi/en/docs/showcase/) | Visual introduction to the major experiences |
| [Feature report](https://dasilva333.github.io/airi/en/docs/chronicles/feature-report) | Detailed inventory of fork-specific capabilities |
| [Rosetta Stone](./docs/rosetta-stone.md) | Canonical architecture and source-location map |
| [Major features](./docs/project-major-features-added.md) | Higher-level implementation catalog |
| [Roadmap](https://dasilva333.github.io/airi/en/docs/chronicles/roadmap) | Pending ideas and planning history; implementation may move ahead of the document |
| [Agent guide](./AGENTS.md) | Repository-specific working rules for contributors and coding agents |
| [Contributing guide](./.github/CONTRIBUTING.md) | Setup, development, and contribution workflow |

## Lineage

This repository is a maintained downstream fork of [moeru-ai/airi](https://github.com/moeru-ai/airi).

It preserves the original project's credit, foundation, and broad architectural lineage while pursuing a distinct daily-driver direction: persistent character continuity, selective upstream integration, modular faculties, desktop embodiment, and user-owned data. (See the [Capability comparison](#capability-comparison) above for a concrete breakdown of how the runtimes and creator workflows differ.)

The aim is not to erase where AIRI came from. It is to carry the character somewhere more personal, durable, and free.

> Heavily inspired by [Neuro-sama](https://www.youtube.com/@Neurosama).

## Acknowledgements

- [moeru-ai/airi](https://github.com/moeru-ai/airi) — original foundation, vision, and broad architecture
- [Reka UI](https://github.com/unovue/reka-ui) — documentation design and a large collection of UI components
- [pixiv/ChatVRM](https://github.com/pixiv/ChatVRM)
- [josephrocca/ChatVRM-js](https://github.com/josephrocca/ChatVRM-js) — JavaScript adaptations of parts of ChatVRM
- [mallorbc/whisper_mic](https://github.com/mallorbc/whisper_mic)
- [xsai](https://github.com/moeru-ai/xsai) — lightweight model and LLM interaction packages
- UI and visual inspiration from [Cookard](https://store.steampowered.com/app/2919650/Cookard/), [UNBEATABLE](https://store.steampowered.com/app/2240620/UNBEATABLE/), and [Sensei! I like you so much!](https://store.steampowered.com/app/2957700/_/)

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=dasilva333/airi&type=Date)](https://www.star-history.com/#dasilva333/airi&Date)
