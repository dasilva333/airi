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

<h1 align="center">AIRI — AiriOS</h1>

<p align="center"><strong>💙🐧 Self-hosted, you-owned AI companion.</strong></p>

<p align="center">A container of souls — cyber livings, waifu, digital humans — brought into your Linux machine. The ultimate goal: <strong>AiriOS</strong>, a full desktop OS experience centered around your AI companion.</p>

<blockquote>
<p><strong>This is a maintained downstream fork</strong> of <a href="https://github.com/moeru-ai/airi">moeru-ai/airi</a>, originally created by <a href="https://github.com/moeru-ai/">the Moeru AI team</a>. The original project's vision — re-creating Neuro-sama as an open-source soul container — is the foundation everything here is built on. This fork's focus is turning that vision into an <strong>Arch Linux desktop OS experience</strong>.</p>
</blockquote>

> [!IMPORTANT]
> **Fork context:** This build still credits and depends on the original `moeru-ai/airi` project for its foundation, vision, and broad architecture. The goal here is not to erase that lineage, but to provide a working fork focused on Linux desktop usability, selective upstream integration, and heavily tested improvements.

## Why This Fork Exists

The original AIRI project is a fascinating base — it has real character cards, memory systems, Live2D/VRM support, speech synthesis, proactivity, and a widget system. But it was built as a cross-platform web-first project, and the desktop experience often took a backseat.

This fork exists to:

- **Make AIRI a Linux desktop experience** — not an afterthought, but the primary target
- **Keep the desktop path stable and testable** — no more "works on my machine"
- **Preserve upstream intent where genuinely useful** — the original author's work on character cards, memory, and stage presentation is excellent
- **Selectively forward-port worthwhile upstream work** — not blindly rebasing everything
- **Ship tangible UX, performance, and workflow improvements** for real daily usage on Linux

If you want the original project with broader platform support, see [`moeru-ai/airi`](https://github.com/moeru-ai/airi). If you want a Linux-tuned build that treats the desktop as a first-class citizen, this is that branch.

## What Makes This Fork Different

### Linux-First Desktop Experience

This fork treats Linux as the primary platform. That means:

- **Native Wayland support** with proper Ozone platform flags, PipeWire screen capture, and window decorations
- **F12 dev tools** always available regardless of build mode
- **Proper `.desktop` integration** with application icons and system menu entries
- **Build scripts** (`build.sh` + `install.sh`) for easy local packaging and installation as a native Linux app
- **Electron desktop stage** as the primary interface, not a web wrapper

### What We Kept From Upstream (And Why It's Good)

The original AIRI project has genuinely excellent work that this fork preserves and builds on:

**AIRI Cards as a Real Character System** — The original author's card system is one of the best in any open-source VTuber project. Cards can be imported, edited, previewed, and exported. Each card carries the character's identity across machines via AIRI-native JSON and SillyTavern-compatible `chara_card_v2` PNG export. This fork extends it further with per-card model selection, background preferences, and deeper stage integration.

**Multi-Tab Card Editor** — The original's card editor goes beyond simple metadata:
- **Acting** tab: model expressions, ACT tokens, speech-expression tags, speech mannerisms
- **Modules** tab: per-character model, speech provider, avatar, and background selection
- **Artistry** tab: image generation as a first-class character capability (Replicate, ComfyUI)
- **Proactivity** tab: when and how the character decides to speak on her own, with real context injection

**Memory System** — The original's memory architecture is well-designed:
- Short-term memory rebuild from per-character chat history
- Long-term append-only journal via `text_journal` tool
- Unified memory lookup across both layers
- Per-character scoping so one character's continuity doesn't bleed into another's

**Scene System** — Character-aware background workflow with gallery management, per-card background preferences, and export/import preservation.

**Speech Pipeline** — The original author fixed a major audio degradation issue in the speech path, replaced the weak library, and added OpenAI-compatible voice discovery. This fork keeps those improvements.

**Widget System** — The `stage_widgets` tool lets AIRI spawn, update, and remove floating desktop widgets. Pre-built weather and map widgets, plus a generic JSON fallback.

### What This Fork Adds on Top

- **Wayland-native rendering** with Ozone platform hints and PipeWire capture
- **Build & install scripts** for native Linux packaging (deb/rpm)
- **F12 keyboard shortcut** for dev tools in all windows
- **Desktop entry** with proper icon and application menu integration
- **Selective upstream sync** — only pulling in what's genuinely useful for the Linux desktop path
- **Biome linter** replacing ESLint for faster formatting
- **Debug logging infrastructure** for VRM/Live2D model loading pipelines

## The Vision: AiriOS

The ultimate goal is **AiriOS** — a full Linux desktop OS experience where your AI companion isn't just an app you open, but the center of your desktop environment:

- **Always-present stage** — your character lives on your desktop, not in a browser tab
- **System-wide integration** — notifications, screen capture, global shortcuts
- **Character-driven workflows** — your AI companion can see what you're doing, respond to context, and proactively interact
- **Modular stage system** — widgets, backgrounds, and layouts that the character can compose herself

This is the direction. Every change in this fork moves toward that goal.

## Current Status

Capable of:

- [x] **Brain**
  - [x] Chat in [Telegram](https://telegram.org)
  - [x] Chat in [Discord](https://discord.com)
  - [x] Memory system (short-term + long-term journal)
  - [x] Per-character memory scoping
- [x] **Ears**
  - [x] Audio input from Discord
  - [x] Client-side speech recognition
  - [x] Client-side talking detection
- [x] **Mouth**
  - [x] [ElevenLabs](https://elevenlabs.io/) voice synthesis
  - [x] OpenAI-compatible speech providers with voice discovery
- [x] **Body**
  - [x] VRM support with expression controls, auto-blink, auto-look-at
  - [x] Live2D support with expression-oriented tools
  - [x] Customizable idle loops and motion cycling
- [x] **Desktop Stage**
  - [x] Control Island with emotions, favorites, idle-loop cycling
  - [x] Widget system (weather, map, generic JSON)
  - [x] Scene/background management per character
  - [x] Window snapping and position persistence
  - [x] Wayland native support
- [ ] **AiriOS** (WIP)
  - [ ] System tray integration
  - [ ] Global shortcuts
  - [ ] Screen capture integration
  - [ ] Desktop widget composition

## Development

### Prerequisites

- Node.js >= 20.14.0
- pnpm >= 10.0.0
- Linux (primary target platform)

### Quick Start

```shell
pnpm i
pnpm dev:tamagotchi
```

### Building for Linux

```shell
cd apps/stage-tamagotchi
./build.sh           # Build only
./build.sh --install # Build and install locally
```

This produces `.deb` and `.rpm` packages in `dist/`, plus generates an `install.sh` for system-wide installation.

### Nix

```shell
nix run github:moeru-ai/airi
```

On NixOS:

```shell
nix develop .#fhs
pnpm dev:tamagotchi
```

### Troubleshooting

**Electron uninstall error (pnpm 10+):**
```shell
pnpm approve-builds
# Select 'electron' and press Enter
```

**Wayland issues:** The app auto-detects Wayland and applies the correct flags. If you need to force it:
```shell
ELECTRON_OZONE_PLATFORM_HINT=wayland pnpm dev:tamagotchi
```

## LLM API Providers

- [x] [OpenRouter](https://openrouter.ai/)
- [x] [Ollama](https://github.com/ollama/ollama)
- [x] [OpenAI](https://platform.openai.com/)
- [x] [Anthropic Claude](https://anthropic.com)
- [x] [DeepSeek](https://www.deepseek.com/)
- [x] [Google Gemini](https://developers.generativeai.google)
- [x] [Groq](https://wow.groq.com/)
- [x] [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [x] [Together.ai](https://www.together.ai/)
- [x] [vLLM](https://github.com/vllm-project/vllm)
- [x] [SGLang](https://github.com/sgl-project/sglang)
- ...and more

## Community

<p align="center">
  [<a href="https://discord.gg/TgQ3Cu2F7A">Join Discord Server</a>]
  [<a href="https://x.com/proj_airi">Twitter</a>]
  [<a href="https://t.me/+7M_ZKO3zUHFlOThh">Telegram</a>]
</p>

<p align="center">
  <a href="https://github.com/moeru-ai/airi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/moeru-ai/airi.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
  <a href="https://discord.gg/TgQ3Cu2F7A"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FTgQ3Cu2F7A%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
</p>

> Heavily inspired by [Neuro-sama](https://www.youtube.com/@Neurosama)

> [!WARNING]
> **Attention:** We **do not** have any officially minted cryptocurrency or token associated with this project. Please check the information and proceed with caution.

## Acknowledgements

- Original [moeru-ai/airi](https://github.com/moeru-ai/airi) project and its contributors
- [Reka UI](https://github.com/unovue/reka-ui) — UI components
- [pixiv/ChatVRM](https://github.com/pixiv/ChatVRM)
- [xsai](https://github.com/moeru-ai/xsai) — LLM interaction layer

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=moeru-ai/airi&type=Date)](https://www.star-history.com/#moeru-ai/airi&Date)
