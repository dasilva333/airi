import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const skillsDir = path.join(projectRoot, '.agents', 'skills')

// Mapping: skill folder -> array of { path, note } authoritative docs to cite
const mapping = {
  // ── Cross-cutting / Architecture (residual) ───────────────────────────────
  'airi-app-entry-wiring': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §1 eventa/DI composition, §13 BroadcastChannel registry.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md', note: 'Control Island / Stage UI context bridge architecture.' },
    { path: 'docs/project-navigation-routing-overhaul.md', note: 'Navigation & routing overhaul project plan.' },
  ],
  'airi-ipc-eventa': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §1 eventa IPC contracts, §13 BroadcastChannel registry.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md', note: 'Control Island / Stage UI context bridge architecture.' },
  ],
  'airi-broadcast-channels': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical BroadcastChannel registry (§13).' },
  ],
  'airi-binary-safety': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical failure-mode index; §16 Model Persistence & IndexedDB Serialization (binary-proxy lesson).' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-indexeddb-storage.md', note: 'IndexedDB storage architecture.' },
  ],
  'airi-codebase-verification': [
    { path: 'docs/rosetta-stone.md', note: 'Known-failure-mode index.' },
    { path: 'docs/project-specialized-skills.md', note: 'Specialized skills project plan.' },
    { path: 'docs/project-how-to-maintain-manual.md', note: 'How-to-maintain manual.' },
  ],
  'airi-data-persistence': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §16 binary/serialization lesson.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-indexeddb-storage.md', note: 'IndexedDB storage architecture.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-text-journal-storage.md', note: 'Text journal storage design.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-image-journal-storage.md', note: 'Image journal storage design.' },
    { path: 'docs/project-byos-cloud-sync.md', note: 'BYOS cloud sync outbox/reconciliation design.' },
    { path: 'docs/data-catalog.md', note: 'Data catalog reference.' },
  ],
  'airi-i18n-localization': [
    { path: 'docs/settings-yaml.md', note: 'Canonical key→file map and yaml-manager command interface guide.' },
    { path: 'docs/proposal-broader-unicode-support.md', note: 'Broader Unicode support proposal.' },
  ],
  // ── Memory & Retrieval ──────────────────────────────────────────────────────
  'airi-memory-systems': [
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §9 memory-systems canonical path index.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-memory-system-overview.md', note: 'Memory system architecture overview.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-long-term-memory-journal.md', note: 'Long-term memory journal architecture.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-short-term-memory-summaries.md', note: 'Short-term memory summaries architecture.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-text-journal-storage.md', note: 'Text journal storage design.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-image-journal-storage.md', note: 'Image journal storage design.' },
    { path: 'docs/memory_lab/state-of-system.md', note: 'Memory lab state-of-system document.' },
    { path: 'docs/memory_lab/memory-engine-integration-plan.md', note: 'Memory engine integration plan.' },
    { path: 'docs/memory_lab/production-transition-spec.md', note: 'Memory production transition spec.' },
    { path: 'docs/proposal-echo-chips-rwkv-synthesis.md', note: 'Echo chips RWKV synthesis proposal.' },
  ],
  'airi-memory-retrieval-engine': [
    { path: 'docs/memory_lab/retrieval-and-ranking-spec.md', note: 'Canonical spec for the retrieval pipeline.' },
    { path: 'docs/memory_lab/search-probe-harness-plan.md', note: 'Test-harness plan for measuring product-shaped search quality.' },
    { path: 'docs/memory_lab/evaluation-and-benchmarking-methodology.md', note: 'Evaluation and benchmarking methodology.' },
    { path: 'docs/memory_lab/benchmark_history_and_outlook.md', note: 'Benchmark history and outlook.' },
    { path: 'docs/memory_lab/scoped-probe-window-plan.md', note: 'Scoped probe window plan.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-semantic-search-browser-native.md', note: 'Browser-native semantic search design.' },
    { path: 'docs/content/en/docs/advanced/architecture/blueprint-semantic-search-integration.md', note: 'Semantic search integration blueprint.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §9 memory-systems canonical path index.' },
  ],
  'airi-memory-consolidation-dreaming': [
    { path: 'docs/memory_lab/design-prospective-rich-journal.md', note: 'Triple-Store model, Sacred Journal Rule, Dream Worker, Emotional Exhaust/MoodState.' },
    { path: 'docs/memory_lab/memory-schema-and-lifecycle-spec.md', note: 'Canonical schema & lifecycle spec.' },
    { path: 'docs/memory_lab/memory-lifecycle-and-features.md', note: 'Lifecycle & features spec (Adaptive Indexing Model).' },
    { path: 'docs/memory_lab/great_merger_cheat_sheet.md', note: 'Great merger cheat sheet.' },
    { path: 'docs/memory_lab/ultimate_hybrid_design_doc_detailed.md', note: 'Ultimate hybrid design doc (detailed).' },
    { path: 'docs/memory_lab/lifetime-artifact-generation-plan.md', note: 'Lifetime artifact generation plan.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-long-term-memory-journal.md', note: 'Long-term memory journal architecture.' },
  ],
  'airi-memory-ui-pages': [
    { path: 'docs/memory_lab/memory-settings-home-page-plan.md', note: 'Memory settings home page plan.' },
    { path: 'docs/memory_lab/rich-journal-mockups.md', note: 'Rich journal mockups.' },
    { path: 'docs/memory_lab/archive-index.md', note: 'Archive index.' },
    { path: 'docs/memory_lab/in_progress.md', note: 'In-progress items.' },
  ],
  // ── Avatar & Stage Rendering ────────────────────────────────────────────────
  'airi-character-rendering': [
    { path: 'docs/content/en/docs/advanced/architecture/design-vrm-animation-ecosystem.md', note: 'VRM animation ecosystem design.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-live2d-wasm-optimization.md', note: 'Live2D WASM optimization architecture.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-act-token-expression-system.md', note: 'ACT token expression system design.' },
    { path: 'docs/vrm-cloth-interaction-deepdive.md', note: 'VRM cloth interaction deep dive.' },
    { path: 'docs/mmd-issues-and-regressions.md', note: 'MMD issues and regressions.' },
    { path: 'docs/spine-model-design.md', note: 'Spine model design.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §16 binary-proxy lesson.' },
  ],
  'airi-live2d-dsl-interpreter': [
    { path: 'docs/live2d-dsl-interpreter-spec.md', note: 'Formal specification for the Live2D Scripting DSL instruction set.' },
    { path: 'docs/handoff-live2d-dsl-phase2.md', note: 'Phase 2 implementation handoff (instruction dispatch, test cases).' },
    { path: 'docs/project-live2d-multimoc-changecos-design.md', note: 'Multi-moc3 costume switching (change_cos) design.' },
    { path: 'docs/live2d-dsl-test-cases-handoff.md', note: 'DSL test cases handoff.' },
    { path: 'docs/live2d-change-cos-dependency-challenge.md', note: 'change_cos dependency challenge.' },
    { path: 'docs/live2d-special-sauce-insights.md', note: 'Live2D special sauce insights.' },
    { path: 'docs/project-standalone-live2d-engine-plan.md', note: 'Standalone Live2D engine plan.' },
  ],
  'airi-modular-outfits-system': [
    { path: 'docs/proposal-visual-state-outfit-hook.md', note: 'Visual state outfit hook proposal.' },
    { path: 'docs/proposal-visual-state-outfit-hook-evolution.md', note: 'Visual state outfit hook evolution design.' },
    { path: 'docs/project-live2d-multimoc-changecos-design.md', note: 'Live2D multi-moc3 change_cos design.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-modular-outfits-system.md', note: 'Modular outfits system design.' },
    { path: 'docs/airi-card-design.md', note: 'AIRI card design (packages, manifestations, visual assets).' },
  ],
  'airi-generative-motion-vrma': [
    { path: 'docs/proposal-text-to-vrma-system.md', note: 'Text-to-VRMA system proposal.' },
    { path: 'docs/design-text-to-motion.md', note: 'Text-to-motion architecture design.' },
    { path: 'docs/content/en/references/research/text-to-motion.md', note: 'Text-to-motion research reference.' },
    { path: 'docs/content/en/references/research/mocap.md', note: 'Mocap research reference.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-vrm-animation-ecosystem.md', note: 'VRM animation ecosystem design.' },
    { path: 'docs/proposal-emotion-motion-library.md', note: 'Emotion motion library proposal.' },
  ],
  'airi-vrm-vhack-studio': [
    { path: 'docs/vhack-design-doc.md', note: 'V-HACK DevTools design document.' },
    { path: 'docs/vrm-cloth-interaction-deepdive.md', note: 'VRM cloth interaction deep dive.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §16 binary-proxy lesson.' },
  ],
  'airi-scenes-backgrounds': [
    { path: 'docs/content/en/docs/advanced/architecture/design-scenes-and-backgrounds-system.md', note: 'Scenes and backgrounds system design.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-image-journal-storage.md', note: 'Image journal storage design.' },
    { path: 'docs/artistry-porting-report.md', note: 'Artistry porting report.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §16 toRaw/binary lesson.' },
  ],
  'airi-caption-subsystem': [
    { path: 'docs/head-tethered-captions-design.md', note: 'Canonical design for head-tethered captions vs windowed captions.' },
    { path: 'docs/live2d-caption-design.md', note: 'Live2D caption pipeline design (motion Text/Language fields).' },
    { path: 'docs/captions-widget-system.md', note: 'Captions widget system.' },
    { path: 'docs/catalog-control-strip.md', note: 'Control strip catalog (caption toggles, docking cyclers).' },
  ],
  // ── Control Strip & Customizer ──────────────────────────────────────────────
  'airi-model-customizer': [
    { path: 'docs/modelcustomizer-design.md', note: 'ModelCustomizer.vue separation of concerns, settings panel adoption matrix.' },
    { path: 'docs/catalog-control-strip.md', note: 'Master catalog of control strip items and customizer rows.' },
    { path: 'docs/project-control-strip-rfc.md', note: 'Control strip RFC.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md', note: 'Stage UI context bridge / control island architecture.' },
    { path: 'docs/bugfix-apply-btn-race.md', note: 'Apply-button race bugfix.' },
  ],
  'airi-stage-ui-surfaces': [
    { path: 'docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md', note: 'Stage UI context bridge / control island architecture.' },
    { path: 'docs/catalog-control-strip.md', note: 'Master catalog of control strip items.' },
    { path: 'docs/project-control-strip-rfc.md', note: 'Control strip RFC.' },
    { path: 'docs/project-navigation-routing-overhaul.md', note: 'Navigation & routing overhaul project plan.' },
    { path: 'docs/proposal-studio-sidetab.md', note: 'Studio sidetab proposal.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §1 eventa, §13 BroadcastChannel registry.' },
  ],
  'airi-chatbox-ui-surface': [
    { path: 'docs/content/en/docs/advanced/architecture/design-tamagotchi-chatbox-ux-improvements.md', note: 'Tamagotchi chatbox UX improvements design.' },
    { path: 'docs/design-chatbox-magic-wand-flow.md', note: 'Chatbox magic wand flow design.' },
    { path: 'docs/proposal-chatbox-revamp.md', note: 'Chatbox revamp proposal.' },
    { path: 'docs/proposal-chatbox-slash-commands.md', note: 'Chatbox slash commands proposal.' },
    { path: 'docs/content/en/docs/showcase/05-chatbox-redesign.md', note: 'Chatbox redesign showcase.' },
    { path: 'docs/linux-wayland-chat-cpu-spikes.md', note: 'Linux Wayland chat CPU spikes (performance failure mode).' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §13 BroadcastChannel registry.' },
  ],
  'airi-artistry-comfyui-widgets': [
    { path: 'docs/content/en/docs/advanced/architecture/design-comfyui-image-generation-widget.md', note: 'ComfyUI image generation widget design.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-comfyui-native-api-engine.md', note: 'ComfyUI native API engine architecture.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-flux-grid-slice-image-generation.md', note: 'Flux grid slice image generation design.' },
    { path: 'docs/artistry-porting-report.md', note: 'Artistry porting report.' },
    { path: 'docs/ideogram-4-schema.md', note: 'Ideogram 4 schema.' },
    { path: 'docs/project-widget-system-status-report.md', note: 'Widget system status report.' },
    { path: 'docs/content/en/docs/showcase/09-artistry.md', note: 'Artistry showcase.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §1 eventa/IPC wiring, §13 BroadcastChannel registry.' },
  ],
  // ── Proactivity & Telemetry ─────────────────────────────────────────────────
  'airi-proactivity-sensory-telemetry': [
    { path: 'docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md', note: 'Proactivity heartbeats engine design (5-phase pipeline).' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md', note: 'Chat/STT/proactivity pipelines architecture.' },
    { path: 'docs/project-proactivity-enrichment-roadmap.md', note: 'Proactivity enrichment roadmap.' },
    { path: 'docs/proposal-proactivity-vision.md', note: 'Proactivity vision proposal.' },
    { path: 'docs/director-producer-roles.md', note: 'Director/producer roles document.' },
    { path: 'docs/content/en/docs/showcase/07-producer-subsystem.md', note: 'Producer subsystem showcase.' },
  ],
  'airi-attention-ecology-vision': [
    { path: 'docs/proposal-attention-ecology-local-webgpu-guard.md', note: 'Attention ecology local WebGPU salience guard spec.' },
    { path: 'docs/implementation-plan-vision-witness.md', note: 'Vision witness implementation plan and salience scoring harness.' },
    { path: 'docs/proposal-poc-attention-ecology-vibe-island.md', note: 'Vibe Island proof-of-concept design.' },
    { path: 'docs/design-vision-system-support.md', note: 'Vision system support design.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-vision-system-support.md', note: 'Vision system support (localized architecture copy).' },
    { path: 'docs/content/en/docs/advanced/architecture/design-vision-api-cost-analysis.md', note: 'Vision API cost analysis.' },
    { path: 'docs/research-vision-witness-report.md', note: 'Vision witness research report.' },
    { path: 'docs/project-vision-architecture-review-alpha22.md', note: 'Vision architecture review alpha22.' },
    { path: 'docs/proposal-salience-gate-ui-integration.md', note: 'Salience gate UI integration proposal.' },
    { path: 'docs/proposal-vlm-forward-to-llm.md', note: 'VLM forward-to-LLM proposal.' },
    { path: 'docs/content/en/docs/showcase/08-situational-awareness.md', note: 'Situational awareness showcase.' },
  ],
  'airi-prefix-cache-alignment': [
    { path: 'docs/proposal-prefix-cache-alignment.md', note: 'Prefix-cache alignment architectural spec.' },
    { path: 'docs/proposal-director-cache-alignment-analysis.md', note: 'Director cache alignment risk analysis (do not force-fit).' },
    { path: 'docs/token-usage-metrics.md', note: 'Token usage metrics.' },
    { path: 'docs/journal-the-reasoning-content-bug.md', note: 'Reasoning-content bug journal (related prompt pipeline issue).' },
  ],
  // ── Discord & Social Integrations ───────────────────────────────────────────
  'airi-discord-integration': [
    { path: 'docs/feat-discord-revamp.md', note: 'Current Discord revamp spec.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md', note: 'Original Discord bot integration design.' },
    { path: 'docs/design-discord-context-routing.md', note: 'Discord context routing design.' },
    { path: 'docs/design-discord-control-plane.md', note: 'Discord control plane design.' },
    { path: 'docs/content/en/docs/manual/config/discord-commands.md', note: 'Discord commands manual.' },
    { path: 'docs/content/en/docs/contributing/services/discord.md', note: 'Contributing guide for Discord service.' },
    { path: 'docs/content/en/docs/showcase/10-discord-integration.md', note: 'Discord integration showcase.' },
    { path: 'docs/cloud-relay-design.md', note: 'Cloud relay architecture (Discord Edge deployment).' },
    { path: 'docs/project-telegram-design.md', note: 'Telegram project design.' },
    { path: 'docs/content/en/docs/contributing/services/telegram.md', note: 'Contributing guide for Telegram service.' },
    { path: 'docs/content/en/docs/contributing/services/satori.md', note: 'Contributing guide for Satori protocol.' },
    { path: 'docs/proposal-twitch-plugin.md', note: 'Twitch plugin proposal.' },
    { path: 'docs/proposal-destiny2-plugin.md', note: 'Destiny 2 plugin proposal.' },
  ],
  // ── Provider & Commercial Boundaries ─────────────────────────────────────────
  'airi-provider-core-registry': [
    { path: 'docs/settings-yaml.md', note: 'Canonical key→file map and yaml-manager guide (provider i18n keys).' },
    { path: 'docs/provider-catalog.md', note: 'Provider catalog reference.' },
    { path: 'docs/project-provider-metadata-catalog.md', note: 'Provider metadata catalog project.' },
    { path: 'docs/design-multi-instance-provider-studio.md', note: 'Multi-instance provider studio design.' },
    { path: 'docs/proposal-web-cors-proxy-bypass.md', note: 'Web CORS proxy bypass proposal.' },
  ],
  'airi-provider-store-instances': [
    { path: 'docs/design-multi-instance-provider-studio.md', note: 'Multi-instance provider studio architecture design.' },
    { path: 'docs/provider-catalog.md', note: 'Provider catalog reference.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md', note: 'Provider store current structure architecture.' },
    { path: 'docs/project-provider-store-restructuring-plan.md', note: 'Provider store restructuring plan.' },
    { path: 'docs/project-codex-provider-restructuring-plan.md', note: 'Codex provider restructuring plan.' },
    { path: 'docs/project-provider-store-phase1-handoff.md', note: 'Provider store phase 1 handoff.' },
    { path: 'docs/project-provider-store-phase2-handoff.md', note: 'Provider store phase 2 handoff.' },
    { path: 'docs/project-provider-store-phase3-handoff.md', note: 'Provider store phase 3 handoff.' },
    { path: 'docs/project-provider-store-phase4-handoff.md', note: 'Provider store phase 4 handoff.' },
    { path: 'docs/project-provider-store-phase5-handoff.md', note: 'Provider store phase 5 handoff.' },
    { path: 'docs/settings-yaml.md', note: 'Canonical key→file map and yaml-manager guide.' },
  ],
  'airi-provider-ui-pages': [
    { path: 'docs/design-multi-instance-provider-studio.md', note: 'Multi-instance provider studio design (UI implications).' },
    { path: 'docs/provider-catalog.md', note: 'Provider catalog reference.' },
    { path: 'docs/project-cloud-model-browsing.md', note: 'Cloud model browsing project.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md', note: 'Provider store current structure architecture.' },
    { path: 'docs/settings-yaml.md', note: 'Canonical key→file map and yaml-manager guide (provider settings i18n).' },
  ],
  'airi-cloud-relay-infrastructure': [
    { path: 'docs/cloud-relay-design.md', note: 'Master document for Cloud Relay Architecture.' },
    { path: 'docs/project-byos-cloud-sync.md', note: 'BYOS cloud sync logic and S3/R2 reconciliations.' },
    { path: 'docs/project-audit-cloudsync.md', note: 'Cloud sync audit.' },
    { path: 'docs/project-generic-cloudflare-framework-plan.md', note: 'Generic Cloudflare framework plan.' },
    { path: 'docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md', note: 'Commercial backend subscription requirements brainstorm.' },
    { path: 'docs/brainstorms/2026-07-06-commercial-backend-customer-acceptance-checklist.md', note: 'Commercial backend customer acceptance checklist.' },
    { path: 'docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md', note: 'Commercial backend phase 0 design.' },
    { path: 'docs/superpowers/specs/2026-07-04-commercial-backend-phase-1-provider-data-boundary-design.md', note: 'Provider data boundary design.' },
    { path: 'docs/superpowers/specs/2026-07-04-phase-1-hard-block-design.md', note: 'Phase 1 hard block design.' },
    { path: 'docs/superpowers/plans/2026-07-04-commercial-backend-phase-0-closure.md', note: 'Commercial backend phase 0 closure plan.' },
    { path: 'docs/superpowers/plans/2026-07-04-commercial-backend-phase-1-provider-data-boundary.md', note: 'Provider data boundary plan.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-gateway-security-hardening.md', note: 'Gateway security hardening architecture.' },
    { path: 'docs/delivery/AIRI-customer-deployment-guide.zh-CN.md', note: 'AIRI customer deployment guide.' },
  ],
  'airi-local-inference-engines': [
    { path: 'docs/proposal-built-in-llm-webgpu.md', note: 'WebGPU local inference harness specification.' },
    { path: 'docs/proposal-attention-ecology-local-webgpu-guard.md', note: 'Attention ecology local WebGPU salience guard.' },
    { path: 'docs/proposal-toggle4-rework-and-rwkv-harness.md', note: 'Toggle4 rework and RWKV harness proposal.' },
    { path: 'docs/project-rwkv-kimi.md', note: 'RWKV Kimi project.' },
    { path: 'docs/project-rwkv-cleanroom-harness-plan.md', note: 'RWKV cleanroom harness plan.' },
    { path: 'docs/proposal-moss-tts-nano-provider-unified-webgpu.md', note: 'MOSS TTS nano provider unified WebGPU proposal.' },
    { path: 'docs/moss-tts-nano-research-report.md', note: 'MOSS TTS nano research report.' },
  ],
  'airi-audio-pipeline': [
    { path: 'docs/feat-audio-studio.md', note: 'Audio studio feature spec (VoiceProfiles, UST).' },
    { path: 'docs/openai-compatible-tts.md', note: 'OpenAI-compatible TTS.' },
    { path: 'docs/content/en/docs/advanced/architecture/blueprint-tts-universal-speech-transformer.md', note: 'TTS universal speech transformer blueprint.' },
    { path: 'docs/content/en/docs/advanced/architecture/blueprint-aws-polly-integration.md', note: 'AWS Polly integration blueprint.' },
    { path: 'docs/analysis-pocket-tts-viability.md', note: 'Pocket TTS viability analysis.' },
    { path: 'docs/analysis-gpt-sovits-onnx-webgpu-viability.md', note: 'GPT-SoVITS ONNX WebGPU viability analysis.' },
    { path: 'docs/proposal-higgs-audio-v3-tts-integration.md', note: 'Higgs Audio V3 TTS integration proposal.' },
    { path: 'docs/proposal-moss-tts-nano-provider-unified-webgpu.md', note: 'MOSS TTS nano provider unified WebGPU proposal.' },
    { path: 'docs/project-multimodal-audio-transport.md', note: 'Multimodal audio transport project.' },
    { path: 'docs/content/en/references/research/tts.md', note: 'TTS research reference.' },
    { path: 'docs/content/en/references/research/lipsync.md', note: 'Lipsync research reference.' },
  ],
  'airi-gemini-live-api': [
    { path: 'docs/content/en/docs/advanced/architecture/design-gemini-live-api-integration.md', note: 'Canonical Gemini Live API integration design.' },
    { path: 'docs/project-multimodal-audio-transport.md', note: 'Multimodal audio transport project.' },
    { path: 'docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md', note: 'Chat/STT/proactivity pipelines architecture.' },
  ],
  'airi-mcp-integration': [
    { path: 'docs/content/en/docs/advanced/architecture/arch-mcp-integration.md', note: 'MCP integration architecture.' },
    { path: 'docs/finding-open-apis-mcp-servers-plugins.md', note: 'Finding open APIs, MCP servers, and plugins.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §1 eventa contract registry.' },
  ],
  // ── Onboarding & Cards ──────────────────────────────────────────────────────
  'airi-card-schema': [
    { path: 'docs/airi-card-design.md', note: 'AIRI Package Spec v2, upstream ZIP packaging, ecosystem interoperability.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-character-card-import-export.md', note: 'Character card import/export design.' },
    { path: 'docs/content/en/docs/manual/config/character-card.md', note: 'Character card manual/config.' },
    { path: 'docs/content/en/docs/showcase/01-card-system.md', note: 'Card system showcase.' },
    { path: 'docs/starter-character-gold-standard.md', note: 'Starter character gold standard.' },
  ],
  'airi-card-editor-wizard': [
    { path: 'docs/content/en/docs/advanced/architecture/design-character-card-import-export.md', note: 'Character card import/export design.' },
    { path: 'docs/content/en/docs/showcase/02-animadex-wizard.md', note: 'AnimaDex wizard showcase.' },
    { path: 'docs/proposal-animadex-wizard.md', note: 'AnimaDex wizard proposal.' },
    { path: 'docs/proposal-animadex-new-characters.md', note: 'AnimaDex new characters proposal.' },
    { path: 'docs/animadex-wizard-pending-items.md', note: 'AnimaDex wizard pending items.' },
    { path: 'docs/proposal-default-cards-revamp.md', note: 'Default cards revamp proposal.' },
    { path: 'docs/airi-card-design.md', note: 'AIRI card design spec.' },
    { path: 'docs/nan0-integration-feedback.md', note: 'NAN0 integration feedback.' },
  ],
  'airi-onboarding-v2': [
    { path: 'docs/project-onboarding-modernize.md', note: 'Onboarding modernization design doc (Core Principles, per-step behavior, Step 7 assembly).' },
    { path: 'docs/onboarding-overhaul-plan.md', note: 'Onboarding overhaul plan.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-onboarding-character-selection.md', note: 'Onboarding character selection design.' },
    { path: 'docs/proposal-global-user-profile.md', note: 'Global user profile proposal.' },
  ],
  'airi-dating-sim-engine': [
    { path: 'docs/dating-sim-gamestate-mechanics.md', note: 'Dating sim gamestate mechanics.' },
    { path: 'docs/dating-sim-intimacy-spec.md', note: 'Dating sim intimacy spec.' },
    { path: 'docs/director-producer-roles.md', note: 'Director/producer roles document.' },
    { path: 'docs/content/en/docs/showcase/07-producer-subsystem.md', note: 'Producer subsystem showcase.' },
    { path: 'docs/rosetta-stone.md', note: 'Canonical concept-to-path index; §13 BroadcastChannel registry.' },
  ],
  'airi-prompt-builder-engine': [
    { path: 'docs/prompt-crafting-catalog.md', note: 'Prompt crafting catalog.' },
    { path: 'docs/proposal-introspective-context-injection.md', note: 'Introspective context injection proposal.' },
    { path: 'docs/proposal-dynamic-memory-rag-injection.md', note: 'Dynamic memory RAG injection proposal.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-character-configurable-llm.md', note: 'Character-configurable LLM design.' },
    { path: 'docs/director-producer-roles.md', note: 'Director/producer roles document.' },
    { path: 'docs/proposal-core-agent-revamp.md', note: 'Core agent revamp proposal.' },
    { path: 'docs/journal-the-reasoning-content-bug.md', note: 'Reasoning-content bug journal.' },
    { path: 'docs/content/en/docs/advanced/architecture/design-act-token-expression-system.md', note: 'ACT token expression system design.' },
  ],
  // ── Upstream Sync & Architecture Proposals ────────────────────────────────
  'airi-roadmap-upstream-research': [
    { path: 'docs/content/en/docs/chronicles/roadmap.md', note: 'AIRI Pending Items Catalog (roadmap triage source of truth).' },
    { path: 'docs/project-selective-upstream-sync-protocol.md', note: 'Selective upstream sync protocol.' },
    { path: 'docs/project-selective-upstream-sync-shortlist.md', note: 'Selective upstream sync shortlist.' },
    { path: 'docs/project-selective-upstream-sync-p1-file-manifest.md', note: 'Selective upstream sync P1 file manifest.' },
    { path: 'docs/project-selective-upstream-sync-phase-a-buy-in.md', note: 'Selective upstream sync phase A buy-in.' },
    { path: 'docs/project-selective-upstream-sync-phase-b-buy-in.md', note: 'Selective upstream sync phase B buy-in.' },
    { path: 'docs/project-critical-upstream-sync-hashes.md', note: 'Critical upstream sync hashes.' },
    { path: 'docs/project-upstream-sync-alpha15-alpha22.md', note: 'Upstream sync alpha15→alpha22.' },
    { path: 'docs/project-upstream-sync-alpha15-alpha22-v2.md', note: 'Upstream sync alpha15→alpha22 v2.' },
    { path: 'docs/project-upstream-sync-report-alpha22-to-latest.md', note: 'Upstream sync report alpha22→latest.' },
    { path: 'docs/project-upstream-pr-catalog.md', note: 'Upstream PR catalog.' },
    { path: 'docs/project-upstream-squat-candidates.md', note: 'Upstream squat candidates.' },
    { path: 'docs/project-squat-1622-report.md', note: 'Squat 1622 report.' },
    { path: 'docs/project-rebase-changelog.md', note: 'Rebase changelog.' },
    { path: 'docs/fork-harvest-report.md', note: 'Fork harvest report.' },
    { path: 'docs/forks-ecosystem.md', note: 'Forks ecosystem.' },
    { path: 'docs/proposal-fork-explorer-harvest-scanner.md', note: 'Fork explorer harvest scanner proposal.' },
    { path: 'docs/superpowers/README.md', note: 'Superpowers docs README (commercial backend plans/specs index).' },
    { path: 'docs/project-specialized-skills.md', note: 'Specialized skills project plan.' },
  ],
}

function toLink(rel) {
  return `[${rel}](${rel})`
}

function buildSection(entries) {
  const lines = entries.map(e => `- ${toLink(e.path)} — ${e.note}`)
  return `\n### Authoritative Design & Architecture Documents\n\n${lines.join('\n')}\n`
}

function run() {
  const folders = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
  let edited = 0
  let skipped = 0
  const danglingRemoved = []

  for (const folder of folders) {
    const skillPath = path.join(skillsDir, folder, 'SKILL.md')
    if (!fs.existsSync(skillPath)) continue
    let content = fs.readFileSync(skillPath, 'utf-8')

    const entries = mapping[folder]
    if (!entries || entries.length === 0) {
      skipped++
      continue
    }

    // Normalize existing variant headers to canonical
    content = content.replace(/### Authoritative Documentation/g, '### Authoritative Design & Architecture Documents')
    content = content.replace(/### Authoritative Design Documents/g, '### Authoritative Design & Architecture Documents')

    // Remove dangling references (case-insensitive, with or without trailing colon/period)
    const dangling = [
      'docs/content/en/docs/manual/ui-customizer.md',
      'docs/content/en/docs/advanced/architecture/design-captions-subsystem.md',
    ]
    for (const d of dangling) {
      const re = new RegExp(`^.*${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$\\r?\\n?`, 'gmi')
      if (re.test(content)) {
        content = content.replace(re, '')
        danglingRemoved.push(`${folder}: ${d}`)
      }
    }

    // If section already exists, append missing docs into it; otherwise insert before Verification
    if (content.includes('### Authoritative Design & Architecture Documents')) {
      const sectionStart = content.indexOf('### Authoritative Design & Architecture Documents')
      const nextHeaderIdx = content.indexOf('\n## ', sectionStart + 1)
      const insertAt = nextHeaderIdx === -1 ? content.length : nextHeaderIdx

      // Determine which entries are missing (by relative path or basename)
      const sectionContent = content.slice(sectionStart, insertAt)
      const toAdd = entries.filter(e => {
        const base = path.basename(e.path).toLowerCase()
        const stem = base.replace(/\.md$/, '')
        return !sectionContent.toLowerCase().includes(e.path.toLowerCase())
          && !sectionContent.toLowerCase().includes(base)
          && (stem.length <= 5 || !sectionContent.toLowerCase().includes(stem))
      })

      if (toAdd.length === 0) {
        // still write back if we normalized/removed dangling
        fs.writeFileSync(skillPath, content, 'utf-8')
        edited++
        continue
      }

      const newLines = toAdd.map(e => `\n- ${toLink(e.path)} — ${e.note}`).join('')

      // Find the true end of the section content (skip trailing '---' / blank lines before next header)
      let insertAt = nextHeaderIdx === -1 ? content.length : nextHeaderIdx
      while (insertAt > sectionStart) {
        const before = content.slice(0, insertAt).replace(/\s+$/u, '')
        if (before.endsWith('---')) {
          insertAt = before.lastIndexOf('---')
          continue
        }
        insertAt = before.length
        break
      }

      content = content.slice(0, insertAt) + newLines + '\n' + content.slice(insertAt)
      fs.writeFileSync(skillPath, content, 'utf-8')
      edited++
    }
    else {
      // Insert before Verification section if present, else append at end
      const verIdx = content.search(/^##+ Verification/m)
      const section = buildSection(entries)
      if (verIdx !== -1) {
        content = content.slice(0, verIdx) + section + '\n' + content.slice(verIdx)
      }
      else {
        content = content.replace(/\s*$/, '') + '\n' + section
      }
      fs.writeFileSync(skillPath, content, 'utf-8')
      edited++
    }
  }

  console.log(`✅ Edited ${edited} skill files, skipped ${skipped} (no authoritative docs to add).`)
  if (danglingRemoved.length) {
    console.log('🗑️  Removed dangling references:')
    danglingRemoved.forEach(d => console.log(`   - ${d}`))
  }
}

run()
