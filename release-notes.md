# 🚀 AIRI v0.9.34-stable.20260924 — Release Notes

This release marks the full arrival of the **Nan0 Living Cognition Architecture**, graduating from an early design preview into an operational multi-domain cognitive core featuring subconscious shadow reflexes, long-term relationship memory, and epistemic grounding. Alongside Nan0, we introduce the **Mind Map 4D Cognitive Graph & Dual-View Memory Explorer**, providing rich visual insight into AIRI's evolving memory through both an interactive chronological timeline and a force-directed celestial constellation view.

Under the hood, this release debuts the **System 1 Coprocessor Engine**, pairing the remote **Jev** model with the local, free **Laya** runtime—offering users two flexible paths for intelligence (high-speed remote execution or completely free on-device processing) to power instant semantic triage, entity classification, and relational memory retrieval. In addition, creators gain access to the interactive **Conversational Pacing & Thinking Fillers Lab** for fine-tuning natural speech cadences, an **External VLM Vision Tier** for Screen Watching with hourly quota safeguards, robust **Serialized Voice Input Recovery** across microphone hardware changes, and vital companion animation restorations for both Live2D and MMD models.

---

## ✨ Key Highlights

### 🧠 Nan0 Living Cognition: Subconscious Shadow Engine & Relationship Memory
*Graduated from experimental UI preview to active cognitive architecture.*
- **Full 5-Domain Architecture**: Transitioned Nan0 from a conceptual interface preview into an active cognitive kernel fully synchronized with chat turns and stage expressions.
- **System 1 80-Choice Schema**: Subconscious reflex schema that evaluates immediate reactions, behavioral impulses, and emotional undertones in milliseconds across remote Jev and local Laya coprocessors before conscious response synthesis.
- **PCL Grievance Ledger & Semantic Salience**: Long-term interpersonal relationship tracking that records mutual rapport, boundary respect, emotional warmth, and resolved friction over time.
- **Epistemic Memory Grounding**: 1st-hop thought engine ensuring that inner monologues, self-reflections, and unspoken musings are strictly anchored to verified autobiographical memories.
- **Configurable Owner Anchor**: Dynamic identity boundary protection within character definitions, enforcing clear companion versus owner distinctions while preventing persona drift.

### 🌌 Mind Map: 4D Cognitive Graph & Dual-View Memory Explorer
- **Dual-View Explorer**: Seamless toggle between a Chronological Timeline and a force-directed Constellation Canvas directly from Chat and Long-Term Memory settings.
- **Chronological Timeline View**: High-fidelity visual memory ledger strictly bounded to actual interaction timestamps. Features deterministic vertical event packing (+N overflow badges), closest-zoom (4.0x) playhead default, direct canvas ruler scrubbing, and smart camera follow.
- **Constellation Canvas**: Dynamic force-directed relational graph displaying memories, entities, and conceptual connections as celestial stars and interconnected clusters.
- **Universal Time Scrubber & Entity Detail Drawer**: Scrub through past dates to inspect relational triples, semantic confidence scores, and historical memory evidence.

### ⚡ System 1 Coprocessor Engine: Jev, Laya & LoCoMo Memory Architecture
- **Dual-Deployment Coprocessor**: Choose between the high-throughput remote **Jev** model (via TypeSafe AI and OpenRouter Decisions) or the completely free, zero-token local **Laya** runtime for instant on-device classification and reranking.
- **LoCoMo Memory Architecture (75.97% F1 Score)**: Benchmark results achieve an outstanding **75.97% F1 score** with remote Jev and **72.74% F1 score** with local Laya, powered by a Dual-Searcher architecture uniting vector document retrieval with Knowledge Graph relational triples, automatic query triage (C1–C4), and zero-shot entity taxonomy classification.
- **Interactive Coprocessor Lab**: Built-in 3-tab playground in Settings (`/settings/modules/system-one`) for live testing of Query Triage, Semantic Reranking, and Emotional Affect deltas.

### 🎙️ Conversational Pacing & Thinking Fillers Lab
- **Dedicated Acting Sub-Tab Lab**: Interactive testing playground built into the Character Card Editor under the Acting tab.
- **Spontaneous Spoken Asides & Thinking Fillers**: Natural vocal pauses, hums, and context-aware thinking fillers seamlessly generated during extended chain-of-thought deliberations.
- **Interactive Scenario Presets**: Built-in challenging prompts (Relativistic Spacecraft, Chess Endgame, Kernel Deadlock, Riemann Hypothesis) to simulate complex reasoning latency and cadence handoffs.
- **One-Click Pacing Profiles**: Quick presets (`Snappy`, `Balanced`, `Deep CoT`) with live waveform visualization, latency stopwatches, and cognitive gating diagnostics.

### 🎭 Avatar Runtimes: Live2D Flicker Fix & MMD Animation Recovery
- **MMD Models Break Free from T-Pose**: Fixed an issue in packaged desktop releases where 3D MMD companions were frozen in a T-pose due to unresolved motion assets under desktop protocols. Built-in dances and motions now load and play smoothly!
- **Restored Live2D Idle Animation Cycles**: Fixed an issue where companion idle animation loops configured in the Avatar Customizer failed to trigger. 2D models now seamlessly cycle through their designated idle motions.
- **Live2D Resize Buffer Repaint**: Ported canvas buffer repaint synchrony during window resizing, eliminating blank canvas flashing when resizing the avatar stage.
- **Smooth MMD Motion Cycling**: Corrected animation playlist filtering so MMD companions cycle through their full repertoire of dances and motions without skipping tracks.

### 👁️ Screen Watcher: External VLM Vision Tier & Visual Quota Safeguards
- **3-Tier Visual Engine**: Added support for **External VLM** (routing through your configured global Vision model such as Claude 3.5 Sonnet, GPT-4o, or Gemini 2.0 Flash) alongside Lightweight WebGPU and Local Moondream.
- **Direct Screen Commentary**: Switched to direct commentary (`screen:interpret`) for rich, human-like visual awareness of your desktop activities.
- **Hourly Quota Tracking & Budget Safeguards**: Live intervention counters and automated cooldown timers to protect rate limits and prevent unexpected API usage.

### 🌐 Free AI Hub & Proactivity Diagnostics
- **Remote Ollama Authentication & URL Routing**: Fixed an issue where cloud-hosted or remote Ollama endpoints failed with 401 Unauthorized errors during conversations. Custom base URLs and authentication tokens are now fully respected.
- **Heartbeat Failure Logging**: If proactive background heartbeats encounter network timeouts, rate limits, or unconfigured providers, errors are now explicitly reported to the Event Log instead of failing silently.

### 🔊 Audio Pipeline & Hardware Recovery
- **Serialized Voice Input Lifecycle**: Ported upstream hardware recovery (PR #2645) with an explicit state machine preventing dropped microphone streams, audio crashes, or UI freezes during microphone hardware changes.
- **Persistent VAD & Push-to-Talk Recording**: Saved voice activity detection sensitivity thresholds across restarts and restored manual push-to-talk recording fallbacks.

### 🎨 Desktop Chat UI, Search & Onboarding Polish
- **Side-by-Side Media Gallery**: Modernized chat interactive area with compact 85px thumbnails, leading control endcaps, and tighter padding.
- **Diacritic-Normalized Search & Nickname Lookups**: Character switcher, Card Gallery, and Discord bot now seamlessly match diacritics, character nicknames, and fuzzy queries.
- **Reasoning Stream Persistence**: Preserved multi-turn reasoning metadata across continuous message streaming and tool executions.
- **Onboarding V3 Cloud Sync Registration**: Newly committed starter companion cards created during onboarding are now immediately enrolled into selective BYOS cloud synchronization upon completion.
- **Onboarding Triage Locale Parity**: Fixed localized text keys for air-gapped and local companion setup paths across multiple languages.
