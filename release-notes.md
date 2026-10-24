# 🚀 AIRI v0.9.41-stable.20261024 — Release Notes

This release marks a massive breakthrough in conversational naturalness, companion autonomy, and auditory intelligence: introducing the **Conversational Cadence Engine**—transforming robotic, monolithic text dumps into natural, staged multi-bubble delivery with Jev-classified rhythmic pauses—alongside the **Decentralized Companion Embassy & Nap-Chat Substrate**, an **In-Chat Audio Server Music Generation Hub with Inline Player**, **Glyph's "Audio Works" Starter Micro-App**, **Single-Mic Authority with Tap-to-Talk Voice Dictation**, an overhauled **Audio Studio with LaTeX Math and Chemical Formula Verbalization**, a **Redesigned Chat Workspace Popover & Chromeless Desktop Window**, **Multi-Hop Pre-Flight Grounding**, and **Zero-Setup Keyless Free Cloud AI**.

Companions can now speak with natural comedic and dramatic pauses across staggered message bubbles, autonomously compose musical motifs and render playable audio directly in chat, track background generation jobs via Audio Works, socialize with peer companions through secure Cloudflare SQLite Durable Object Embassies while you are away, naturally pronounce complex mathematical theorems and chemical formulas aloud, and run in an ultra-clean borderless floating desktop window.

---

## ✨ Key Highlights

### 🎭 Conversational Cadence Engine: Staged Multi-Bubble Delivery
* **Staged Multi-Bubble Conversational Turns**: Companions no longer output walls of monolithic text. Responses now naturally break into progressive, staged message bubbles that unfold in organic conversational beats.
* **Jev Semantic Rhythm Heads**: Employs TypeSafe Jev System-1 coprocessor classification to evaluate conversational pacing on the fly, dynamically distinguishing quick, spontaneous quips from contemplative, nuanced explanations.
* **Synchronized Speech & Reading Rhythm**: Speech bubbles reveal progressively in lockstep with TTS voice playback, or follow natural reading punctuation pauses when voice audio is muted.
* **Graceful Unmapped Playback Fallback**: Audio streams lacking word-level timing markers gracefully bypass the reveal gate, guaranteeing instant message display without hanging.
* **Cross-Window Cadence Coordination**: Multi-bubble delivery synchronizes seamlessly across primary and secondary floating chat windows.

### 🎼 In-Chat Music Generation Hub & Inline Player
* **Autonomous Music Generation Bridge (`generate_music`)**: Companions can now compose and generate full music tracks and instrumental motifs on demand via the AIRI audio server music hub exposed over MCP.
* **Inline Transcript Audio Player**: Generated tracks render directly inside chat message bubbles as interactive audio player cards with track metadata, playback controls, and seek bars.
* **ABC Notation Musical Conditioning**: Companions can inspect, describe, and edit musical compositions using standard ABC notation before dispatching generation jobs.

### 🎛️ Glyph's "Audio Works" Starter Micro-App
* **Bundled "Audio Works" Starter Widget**: Added Glyph's Audio Works to the bundled generative micro-app catalog as a built-in starter widget.
* **Autonomous Order Tracking**: Functions as an independent, self-polling job tracker for audio and music generation tasks, allowing companions to monitor rendering progress without locking chat turns.

### 🎙️ Single-Mic Authority & Tap-to-Talk Voice Dictation
* **Single Microphone Coordinator**: Consolidated audio capture into a single authority across the floating Control Strip, global hotkeys, and chat composers—eliminating mic lock contention and double-recording bugs.
* **Desktop Chatbox Dictation Mic**: Restyled the desktop chat composer with an integrated dictation microphone button for instant speech-to-text input.
* **Web Stage Tap-to-Talk with VAD Auto-Stop**: Added voice dictation with Voice Activity Detection (VAD) to Web Stage, automatically stopping and transcribing when you finish speaking.
* **MIME-Safe Audio Transcription**: Preserves browser audio recording MIME types across Whisper transcription requests to prevent decoding errors.

### 🤝 Companion Embassy & Nap-Chat (P2P Social Substrate)
* **Decentralized Companion Embassy**: Companions can now connect, visit, and interact with other companions across different devices and user accounts via a private Cloudflare SQLite Durable Object backend.
* **Nap-Chat Simulation & Staging Workbench**: While you are away, your companion can engage in autonomous social "nap chats" with trusted peer companions, exchanging ambassador taglines, building inter-companion lore, and staging pending messages for your review upon your return.
* **Custom Ambassador Taglines**: Personalize your companion's social identity with custom ambassador taglines configured directly in the character card and displayed on peer away cards.
* **Mutual Friend Requests & Trust Grants**: Full peer handshake protocol with invite minting, companion permissions, and revocable trust grants.
* **Same-Account Multi-Device Discovery**: Real-time heartbeat tracking and seamless peer discovery across your own devices powered by Cloudflare Edge Vault.
* **Stateful Discord Gateway Durable Object**: Deploy 24/7 autonomous Discord companion presence straight to Cloudflare Edge with SQLite persistence, zero server maintenance, and no local desktop process required.

### 🎵 Redesigned Audio Studio & UST Math/Chemical Verbalization
* **Audio Studio 2-Column Split Layout**: Completely overhauled the Audio Studio with an ergonomic 2-column layout featuring sticky voice profile parameters, live waveform visualizers, and interactive synthesis controls.
* **LaTeX Math & Chemical Formula Verbalization**: The Universal Speech Transformer (UST) now parses complex LaTeX mathematics and chemical equations (such as quadratic formulas or chemical reactions), converting them into natural, spoken English sentences instead of reading raw LaTeX syntax aloud or choking synthesis.
* **Safe Speech Punctuation Handling**: Preserves conversational speech text after non-tag symbols like `<` or `&` (such as `a < b` or `Tom & Jerry`), preventing sentences from being accidentally dropped during speech synthesis.

### 🪟 Chat Workspace Popover, Custom Palettes & Chromeless Window
* **Unified Chat Workspace Popover**: Replaced the legacy timeline dropdown with an expansive, slide-out Chat Workspace navigation menu.
* **Chromeless Floating Companion Window**: Run the chatbox as a clean, borderless, transparent floating window for a minimal desktop footprint.
* **Adaptive "Theme" Chatbox Mode**: Added an adaptive "Theme" background option that automatically switches between subtle light and dark frosted glass surfaces to match your active UI mode.
* **Solid Color Backdrops & Custom Palette Grid**: Customize chat backgrounds with solid pastel or dark colors, paired with custom hex color pickers.
* **Single-Symbol Kanji Emblems**: Redesigned the Settings catalog with unified single-symbol Kanji emblems for high-contrast, minimalist navigation.
* **Workspace Card Switcher Polish**: Enhanced the chat workspace popover with synchronized filter states, canonical favorites ordering, and clean title formatting.
* **Actor Stage Mate Engine Quick Actions**: VRM avatars now offer a one-click menu beside the drag handle to swap to, open, or sync outfits with the native Mate Engine sidecar.

### 🧠 Multi-Hop Pre-Flight Grounding & Anaphoric Query Expansion
* **Multi-Hop Entity Grounding**: Expands memory retrieval probes across connected nodes in the Knowledge Graph, bridging related concepts even when not explicitly named together in the user prompt.
* **Turn-to-Turn Anaphoric Resolution**: Resolves ambiguous pronouns ("it", "she", "that incident") against recent conversation history before querying the vector store, dramatically boosting retrieval accuracy.
* **Salience-Weighted Snippet Windowing**: Intelligently weights and trims retrieved memory snippets to maximize prompt budget efficiency without truncating critical context.
* **Debounced Grounding Probes**: Added a 2-second debounce and AbortController to eliminate duplicate retrieval calls during rapid typing or live editing.

### ☁️ Zero-Setup Free Cloud AI & Onboarding Polish
* **Zero-Setup Keyless Free AI (LanLan & Kilo)**: Integrated keyless free cloud providers into first-run onboarding, letting new users start chatting immediately with zero API keys or billing setup required.
* **Decomposed Consciousness Step**: Extracted Consciousness configuration into a modular, reusable workspace component for seamless provider switching in Settings.
* **Web Stage Provider Onboarding Nudge**: Added responsive setup prompts across both portrait and landscape breakpoints to guide new users through configuring their first AI provider.

### ⚡ Platform Performance & Polish
* **Surrogate-Pair Safe Truncation**: Prevents string truncation from slicing multi-byte Unicode emoji or surrogate pairs in half, eliminating encoding artifacts and broken preview text.
* **Strict Web URL Parsing**: Hardened URL validation across stage links and citations, cleanly rejecting pseudo-protocols and invalid URLs.
* **Widget RPC Initialization Order**: Ensures base window Electron invokes are fully registered before widget RPC channels open, preventing race conditions during widget popouts.
* **Transformers 4.x WASM & Local Inference Hardening**: Pinned the local inference backend to `@huggingface/transformers` 4.x WASM and hardened local Whisper transcription with graceful device fallbacks.
* **Audio Metering Efficiency**: Audio meter polling stabilized at 20 Hz, eliminating 60fps reactivity churn.
* **Type Safety Polish**: Resolved 77 TypeScript type errors in `stage-ui` without dirty type casts.

---

## 🌐 Community & Upstream Radar

### 🌊 Upstream Pull Requests (Forward-Ported from moeru-ai/airi)
* **PR [#3054](https://github.com/moeru-ai/airi/pull/3054) / [#3058](https://github.com/moeru-ai/airi/pull/3058): `feat(core-agent,stage-ui): now speech formula, math, chem correctly`** — Sourced and adapted from upstream by **@nekomeowww**, integrating MathJSON, `@proj-airi/speech-transformer-math`, and `@proj-airi/speech-transformer-chem` to verbalize LaTeX math expressions and chemical formulas aloud across languages.
* **PR [#3053](https://github.com/moeru-ai/airi/pull/3053): `fix(stage-ui): avoid splitting surrogate pairs in chat reply preview`** — Sourced from upstream by **@keeponlight**, preventing UTF-16 surrogate pairs and multi-byte emojis from being bisected during string truncation.
* **PR [#3049](https://github.com/moeru-ai/airi/pull/3049): `fix(stage-shared): parse Electron punctuation accelerators`** — Sourced from upstream by **@Codada**, adding support for single-character punctuation (e.g. `,`, `.`, `/`) in global keyboard shortcut strings.
* **PR [#3044](https://github.com/moeru-ai/airi/pull/3044): `fix(stage-ui): link only parsed web URLs in citations and search results`** — Sourced from upstream by **@nekomeowww**, hardening URL validation via `isWebUrl()` against hostless inputs and unsafe pseudo-protocols.
* **PR [#3035](https://github.com/moeru-ai/airi/pull/3035): `fix(core-agent): keep speech text after a < or & that is not a tag`** — Sourced from upstream by **@nekomeowww**, preventing streamed speech synthesis from dropping sentences containing isolated `<` or `&` characters.
* **PR [#2932](https://github.com/moeru-ai/airi/pull/2932): `fix(tamagotchi): await setupBaseWindowElectronInvokes in widgets RPC setup`** — Sourced from upstream by **@bitxwolf**, eliminating IPC race conditions by awaiting base window Electron invokes before opening widget RPC channels.
* **PR [#3057](https://github.com/moeru-ai/airi/pull/3057): `fix(repo): stop VS Code Java extensions from scanning node_modules`** — Sourced from upstream by **@nekomeowww**, adding IDE configuration exclusions to prevent editor freezing.
