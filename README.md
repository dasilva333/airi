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

The complete implementation catalog lives in the [feature report](./docs/content/en/docs/chronicles/feature-report.md). The [showcase](./docs/content/en/docs/showcase/index.md) presents the major experiences visually.

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

## Download

<p float="left" align="center">
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.27-stable.20260824/AIRI-0.9.27-stable.20260824-windows-x64-setup.exe">
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
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.27-stable.20260824/AIRI-0.9.27-stable.20260824-darwin-arm64.dmg">
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
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.27-stable.20260824/AIRI-0.9.27-stable.20260824-android.apk">
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
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.27-stable.20260824/AIRI-0.9.27-stable.20260824-ios.ipa">
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
| [Showcase](./docs/content/en/docs/showcase/index.md) | Visual introduction to the major experiences |
| [Feature report](./docs/content/en/docs/chronicles/feature-report.md) | Detailed inventory of fork-specific capabilities |
| [Rosetta Stone](./docs/rosetta-stone.md) | Canonical architecture and source-location map |
| [Major features](./docs/project-major-features-added.md) | Higher-level implementation catalog |
| [Roadmap](./docs/content/en/docs/chronicles/roadmap.md) | Pending ideas and planning history; implementation may move ahead of the document |
| [Agent guide](./AGENTS.md) | Repository-specific working rules for contributors and coding agents |
| [Contributing guide](./.github/CONTRIBUTING.md) | Setup, development, and contribution workflow |

## Lineage

This repository is a maintained downstream fork of [moeru-ai/airi](https://github.com/moeru-ai/airi).

It preserves the original project's credit, foundation, and broad architectural lineage while pursuing a distinct daily-driver direction: persistent character continuity, selective upstream integration, modular faculties, desktop embodiment, and user-owned data.

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
