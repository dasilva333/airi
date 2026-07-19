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
  <img width="250" src="./docs/content/public/banner-light-1280x640.avif" />
</picture>

<h1 align="center">Project AIRI</h1>

<p align="center">A soul container of AI waifu / virtual characters — brought to your desktop as a practical, privacy-first daily driver.</p>

<p align="center">
  This repository is a maintained downstream fork of <a href="https://github.com/moeru-ai/airi">moeru-ai/airi</a>, focused on keeping the desktop experience usable, integrating high-value upstream ideas selectively, and shipping heavily tested improvements on top of the original project.
</p>

> [!IMPORTANT]
> **Fork context:** This build still credits and depends on the original `moeru-ai/airi` project for its foundation, vision, and broad architecture. The goal here is not to erase that lineage, but to provide a working fork that continues to land practical desktop-focused improvements while upstream changes are reviewed more selectively.

## Why This Fork Exists

This fork exists to keep AIRI moving as a practical daily-driver build. The priority is:

- keep the desktop path stable and testable
- selectively forward-port worthwhile upstream work instead of blindly rebasing
- ship tangible UX, performance, and workflow improvements for real usage

If you want the original project history and broader upstream context, see [`moeru-ai/airi`](https://github.com/moeru-ai/airi). If you want the branch actively tuned for usability, this repository is that branch.

For the full list of major features added in this fork (34 systems and counting), see [`docs/major-features-added.md`](./docs/major-features-added.md). For detailed sub-features and technical specifics, see [`docs/content/en/docs/chronicles/feature-report.md`](./docs/content/en/docs/chronicles/feature-report.md). For pending and planned work, see [`docs/content/en/docs/chronicles/roadmap.md`](./docs/content/en/docs/chronicles/roadmap.md).

---

## Major Features

### Character System
- **AIRI Cards** — import/export (native JSON + SillyTavern PNG), multi-tab editor (Acting, Modules, Artistry, Generation, Proactivity), per-character generation settings and tool gating
- **Multi-Character & Actor Tokens** — dynamic model switching mid-conversation with in-memory LRU cache to prevent flicker; multiple actors per card
- **AnimaDex Wizard** — guided multi-step card creator with AI story suggestions, WD14 auto-tagging, and voice auto-assignment
- **Sparkle AI** — AI-assisted field generation across all card tabs
- **Production Studio** — layered concept stacking (Base/Additive) for complex character behaviors and visual manifestations
- **Modular Wardrobe** — base/overlay outfit layers with interactive build mode, integrated into the Control Strip

### Stage & Models
- **Model Selector** — search by title/filename/tags/groups, filter by type, WD14 tagging, dual 2-column and dense 4-column layouts
- **VRM Animation** — 24 presets, per-character palettes, idle hairball random cycle, ACT-triggered, user VRMA uploads, batch import
- **Live2D** — hold-to-map expression binding, multi-moc3 zip normalization, tactile hit zones with audio+captions, lhack texture editor
- **MMD / PMX** — real-time physics, VMD motion support, mouse tracking, auto-blink, morph integration
- **Spine 2D** — binary format, bone-based tactile interaction, motion audio, auto-detect premultiplied alpha
- **Tactile Mode** — cross-model interactive touch: Live2D hit zones play audio and show captions; VRM tug-and-pull physics
- **V-Hack & L-Hack** — unified texture editors for model reskinning across all four model runtimes
- **Scene & Background Manager** — per-character backgrounds, AI-driven creation, photo mode, portability on card export

### Memory & Continuity
- **Two-Layer Memory** — short-term daily blocks + long-term journal archive, unified retrieval, echo chips, dream state, introspective feedback loops
- **Universe-Based Story Isolation** — session switching, isolated story universes, clean session creation free of prior memory artifacts
- **Eternal Thread** — long-term archive view with token budget controls and persona-driven auto-titles

### Chat & Desktop
- **Chatbox Redesign** — three-column workspace with left navigation, right context panel (memory cards + media gallery), session switcher, brain popover
- **Chat UX** — real-time spoken highlights (CSS Custom Highlight API), mood tags & colored chat bubbles, screenplay formatting, inline editing, draft autosave, timeline management, caption system
- **Desktop Control Strip** — floating glassmorphic bar, snap-to-edge auto-hide, customizer, decoupled actor stage, touch-gesture dragging
- **Studio Monitor** — creative diagnostics console for auditing concept stacks, wardrobes, and configurations

### AI & Cognition
- **ACT Token Pipeline** — expanded syntax formats, MMD/Spine integration, LLM emotion keyword clustering, bracket-driven bubble styling (upstream invented the pipeline; this fork broadens it)
- **AI Producer Subsystem** — Producer Lite (stateless, zero-config suggestions in chatbox + actor stage) and Producer+ (campaign orchestration with intimacy engine)
- **Situational Awareness & Proactivity** — OS sensors, environment telemetry, activity history, deep context awareness (expression/sticker/scene awareness)
- **Dating Sim System** — dynamic encounter modes (sandbox vs goal-driven), intimacy engine, real-time overlay

### Creative & Vision
- **Artistry** — ComfyUI, Replicate, NanoBanana, BYOW, workflow templates/presets, "Imagine" mode, automated image journal handoff
- **Vision Support** — decoupled VLM ("Mind" vs "Senses"), Direct Response vs Forward-to-LLM strategies, WD14 local image tag extractor, model collection scouting
- **Audio Studio** — virtual proxy TTS provider with Web Audio DSP, UST rules, voice bundling, pitch/rate/EQ effects

### Discord Integration
- **Discord Revamp** — classic TTS pipeline (STT→LLM→TTS), bidirectional Gemini Live audio bridge (audio-to-audio, zero text), slash commands (`/status`, `/vision`, `/selfie`, `/timelines`, `/journalmoment`), per-channel isolation, DM access control, queue/steer interaction modes

### Platform & Infrastructure
- **MCP Management Hub** — curated server discovery, per-tool toggles, one-click install, real-time status monitoring
- **Cloud Sync (BYOS)** — S3/Cloudflare R2/Google AppData, selective sync filtering, conflict triage UI, automated 24-hour backups
- **Onboarding Overhaul** — Sense Portal easy mode, Google sign-in for BYOS restore, human-centered terminology (Consciousness/Speech/Hearing)
- **Global User Profiles** — user self-concepts, voice profile store, narrator voice fallback
- **Speech & Provider Integrations** — Chatterbox, local Whisper/Kokoro, MOSS-TTS-Nano, WebGPU RWKV-7, Deepgram, AWS Polly, Gemini Live/TTS, DeepSeek/GLM-4, Qwen Portal
- **Zero-Trust Privacy** — no telemetry, no analytics, local-first, opt-in cloud sync
- **Platform Hardening** — CORS bypass, single instance lock, cross-window IndexedDB sync, native module safeguards, production Electron sandbox

> :camera: **[See the Feature Showcase](./docs/content/en/docs/showcase/index.md)** — visual walkthroughs with screenshots and key capabilities for the most impactful features. (Also available in the in-app docs under _Showcase_ once you build.)

---

## Download

<p float="left" align="center">
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.15-stable.20260707/AIRI-0.9.15-stable.20260707-windows-x64-setup.exe">
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
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.windows.light.en-US.avif" />
    </picture>
  </a>
  <a href="https://github.com/dasilva333/airi/releases/download/v0.9.15-stable.20260707/AIRI-0.9.15-stable.20260707-darwin-arm64.dmg">
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
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.macos.light.en-US.avif" />
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
      <img width="33%" src="./docs/content/public/assets/download-buttons/download-buttons.linux.light.en-US.avif" />
    </picture>
  </a>
</p>

> Heavily inspired by [Neuro-sama](https://www.youtube.com/@Neurosama)

---

## Development

> For detailed instructions to develop this project, follow [CONTRIBUTING.md](./.github/CONTRIBUTING.md)

### Desktop Version (Stage Tamagotchi)

The easiest way to get started — no terminal required. Helper scripts build packages and launch the desktop app in one click:

| Script | Platform | What It Does |
|---|---|---|
| `start_airi.bat` | Windows | Default start. Prompts for port (default 5173), builds packages, launches. |
| `start_airi.sh` | macOS/Linux | Same as above for Unix systems. Logs to `airi.log`. |
| `start_airi_hiperf.bat` | Windows | Forces high-performance GPU and 8GB Node heap. Use if you hit GPU or memory issues. |
| `start_airi_skipdl.bat` | Windows | Skips asset downloads. Use if you already have models cached locally. |
| `start_airi_customport.bat` | Windows | Forces a specific port (defaults to 5174). Use to recover settings/models from a previous port. |
| `install.bat` | Windows | Full setup from scratch: installs pnpm, project deps, builds packages, then launches. |

Or from the terminal:

```shell
pnpm i
pnpm dev:tamagotchi
```

A Nix package for Tamagotchi is included. To run airi with Nix, first make sure to enable flakes, then run:

```shell
nix run github:dasilva333/airi
```

#### NixOS

Electron requires shared libraries that aren't in standard paths on NixOS. Use the FHS shell defined in `flake.nix`:

```shell
nix develop .#fhs
pnpm dev:tamagotchi
```

### Web Version (Stage Web)

The web version requires **two processes** running in separate terminals — a backend and a frontend.

**Terminal 1 — Backend:**

```shell
pnpm dev:server
```

**Terminal 2 — Frontend:**

```shell
pnpm dev:web
```

### Mobile Version (Stage Pocket)

Start the development server for the capacitor:

```shell
pnpm dev:pocket:ios <DEVICE_ID_OR_SIMULATOR_NAME>
# Or
CAPACITOR_DEVICE_ID=<DEVICE_ID_OR_SIMULATOR_NAME> pnpm dev:pocket:ios
```

You can see the list of available devices and simulators by running `pnpm exec cap run ios --list`.

If you need to connect server channel on pocket in wireless mode, you need to start tamagotchi as root:

```shell
sudo pnpm dev:tamagotchi
```

Then enable secure websocket in tamagotchi `settings/system/general`.

### Documentation Site

```shell
pnpm dev:docs
```

---

## Support of LLM API Providers (powered by [xsai](https://github.com/moeru-ai/xsai))

- [x] [AIHubMix (recommended)](https://aihubmix.com/?aff=OOiX)
- [x] [OpenRouter](https://openrouter.ai/)
- [x] [vLLM](https://github.com/vllm-project/vllm)
- [x] [SGLang](https://github.com/sgl-project/sglang)
- [x] [Ollama](https://github.com/ollama/ollama)
- [x] [302.AI (sponsored)](https://share.302.ai/514k2v)
- [x] [OpenAI](https://platform.openai.com/docs/guides/gpt/chat-completions-api)
- [x] [Anthropic Claude](https://anthropic.com)
- [x] [DeepSeek](https://www.deepseek.com/)
- [x] [Qwen](https://help.aliyun.com/document_detail/2400395.html)
- [x] [Google Gemini](https://developers.generativeai.google)
- [x] [xAI](https://x.ai/)
- [x] [Groq](https://wow.groq.com/)
- [x] [Mistral](https://mistral.ai/)
- [x] [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [x] [Together.ai](https://www.together.ai/)
- [x] [Fireworks.ai](https://www.together.ai/)
- [x] [Novita](https://www.novita.ai/)
- [x] [Zhipu](https://bigmodel.cn)
- [x] [SiliconFlow](https://cloud.siliconflow.cn/i/rKXmRobW)
- [x] [Stepfun](https://platform.stepfun.com/)
- [x] [Baichuan](https://platform.baichuan-ai.com)
- [x] [Minimax](https://api.minimax.chat/)
- [x] [Moonshot AI](https://platform.moonshot.cn/)
- [x] [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro)
- [x] [Player2](https://player2.game/)
- [x] [Tencent Cloud](https://cloud.tencent.com/document/product/1729)
- [x] [Amazon Bedrock](https://aws.amazon.com/bedrock/)
- [x] [xAI Grok Voice](https://x.ai/) (TTS/STT)
- [x] [Amazon AWS Polly](https://aws.amazon.com/polly/) (TTS)
- [x] [Deepgram](https://deepgram.com/) (STT, Nova-2/Nova-3)
- [x] [Chatterbox](https://github.com/chatterbox-ai/chatterbox) (TTS)
- [x] Local Whisper / Kokoro via [xsai-transformers](https://github.com/moeru-ai/xsai-transformers) (STT/TTS, WebGPU)
- [x] MOSS-TTS-Nano (TTS, browser-local, voice cloning)
- [x] WebGPU RWKV-7 (local LLM inference)
- [x] [Gemini Live](https://developers.generativeai.google) (real-time audio streaming)
- [x] OpenAI Compatible TTS (BYO endpoint — see [`docs/openai-compatible-tts.md`](./docs/openai-compatible-tts.md))

---

## Acknowledgements

- [moeru-ai/airi](https://github.com/moeru-ai/airi): The original project this fork is built on. Full credit for the foundation, vision, and broad architecture.
- [Reka UI](https://github.com/unovue/reka-ui): for designing the documentation site and implementing a massive amount of UI components.
- [pixiv/ChatVRM](https://github.com/pixiv/ChatVRM)
- [josephrocca/ChatVRM-js](https://github.com/josephrocca/ChatVRM-js): A JS conversion/adaptation of parts of the ChatVRM (TypeScript) code.
- Design of UI and style was inspired by [Cookard](https://store.steampowered.com/app/2919650/Cookard/), [UNBEATABLE](https://store.steampowered.com/app/2240620/UNBEATABLE/), and [Sensei! I like you so much!](https://store.steampowered.com/app/2957700/_/).
- [mallorbc/whisper_mic](https://github.com/mallorbc/whisper_mic)
- [`xsai`](https://github.com/moeru-ai/xsai): Packages to interact with LLMs and models, like [Vercel AI SDK](https://sdk.vercel.ai/) but way small.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=dasilva333/airi&type=Date)](https://www.star-history.com/#dasilva333/airi&Date)
