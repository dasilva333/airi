import { listProviders } from '../libs/providers/providers/registry'

export type NodeKind = 'root' | 'area' | 'category' | 'page' | 'tool'

export interface SettingsTopologyNode {
  id: string
  label: string
  shortLabel?: string
  titleKey?: string
  description?: string
  descriptionKey?: string
  route?: string
  parentId: string | null
  children: string[]
  order: number
  kind?: NodeKind
  glyph?: string
  icon?: string
  desktopOnly?: boolean
  disabled?: boolean
  hidden?: boolean
  metadata?: Record<string, unknown>
}

export interface SettingsTopology {
  rootId: string
  nodesById: Record<string, SettingsTopologyNode>
}

export interface CatalogNodeItem {
  id: string
  label: string
  shortLabel?: string
  titleKey?: string
  description?: string
  descriptionKey?: string
  glyph?: string
  clusterGroup?: string
  route?: string
  icon?: string
  order: number
  parentId: string | null
  kind?: 'root' | 'area' | 'category' | 'page' | 'tool'
  desktopOnly?: boolean
}

/**
 * Canonical Exhaustive Settings Catalog definition.
 * 3 Top-Level Hub Groups:
 *  1. CHARACTER & SCENE 姿 (AIRI Card, Stage Backgrounds, Companion Avatars, Dating Sim)
 *  2. INTELLIGENCE 知 (Memory Systems, Modules, Inference Providers)
 *  3. SYSTEM 系 (Floating Controls, System Preferences, Documentation, Data Management)
 */
export const SETTINGS_CATALOG_ITEMS: CatalogNodeItem[] = [
  // ── Root Hub ──
  {
    id: 'hub',
    label: 'Settings Hub',
    shortLabel: 'Hub',
    titleKey: 'settings.title',
    glyph: '設定',
    route: '/settings',
    icon: 'i-solar:settings-bold-duotone',
    order: 0,
    parentId: null,
    kind: 'root',
  },

  // ══════════════════════════════════════════════
  // ══════════════════════════════════════════════
  // GROUP 1: CHARACTER & SCENE 姿
  // ══════════════════════════════════════════════
  {
    id: 'area-card',
    label: 'AIRI Card Editor',
    shortLabel: 'Cards',
    titleKey: 'settings.pages.card.title',
    descriptionKey: 'settings.pages.card.description',
    description: 'Create, edit, and manage character cards, import custom presets, or discover new ones online.',
    glyph: '姿',
    clusterGroup: 'CHARACTER & SCENE 姿',
    route: '/settings/airi-card',
    icon: 'i-solar:emoji-funny-square-bold-duotone',
    order: 1,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-models',
    label: 'Companion Avatars',
    shortLabel: 'Avatars',
    titleKey: 'settings.pages.models.title',
    descriptionKey: 'settings.pages.models.description',
    description: 'Manage physical assets, animations, and motion mappings for Live2D, VRM, Spine, and MMD.',
    glyph: '体',
    clusterGroup: 'CHARACTER & SCENE 姿',
    route: '/settings/models',
    icon: 'i-solar:people-nearby-bold-duotone',
    order: 2,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-scene',
    label: 'Stage Backgrounds',
    shortLabel: 'Backgrounds',
    titleKey: 'settings.pages.scene.title',
    descriptionKey: 'settings.pages.scene.description',
    description: 'Customize virtual backdrops and stage wallpaper images for your characters.',
    glyph: '景',
    clusterGroup: 'CHARACTER & SCENE 姿',
    route: '/settings/scene',
    icon: 'i-solar:gallery-bold-duotone',
    order: 3,
    parentId: 'hub',
    kind: 'area',
  },

  // ══════════════════════════════════════════════
  // GROUP 2: INTELLIGENCE 知
  // ══════════════════════════════════════════════
  {
    id: 'area-memory',
    label: 'Memory Systems',
    shortLabel: 'Memory',
    titleKey: 'settings.pages.memory.title',
    descriptionKey: 'settings.pages.memory.description',
    description: 'Review short-term summaries, text journals, lifetime archives, and echo chips.',
    glyph: '憶',
    clusterGroup: 'INTELLIGENCE 知',
    route: '/settings/memory',
    icon: 'i-solar:leaf-bold-duotone',
    order: 4,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-modules',
    label: 'Companion Connectors',
    shortLabel: 'Connectors',
    titleKey: 'settings.pages.modules.title',
    descriptionKey: 'settings.pages.modules.description',
    description: 'Configure perception sensors, speech, hearing, consciousness, and integrations.',
    glyph: '部',
    clusterGroup: 'INTELLIGENCE 知',
    route: '/settings/modules',
    icon: 'i-solar:layers-bold-duotone',
    order: 5,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-providers',
    label: 'Inference Providers',
    shortLabel: 'Providers',
    titleKey: 'settings.pages.providers.title',
    descriptionKey: 'settings.pages.providers.description',
    description: 'Set up LLM brains, speech synthesis engines, and transcription providers.',
    glyph: '供',
    clusterGroup: 'INTELLIGENCE 知',
    route: '/settings/providers',
    icon: 'i-solar:box-minimalistic-bold-duotone',
    order: 6,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-data',
    label: 'Data Management',
    shortLabel: 'Data',
    titleKey: 'settings.pages.data.title',
    descriptionKey: 'settings.pages.data.description',
    description: 'Backup, restore, and clear cached assets or IndexedDB persistence stores.',
    glyph: '庫',
    clusterGroup: 'INTELLIGENCE 知',
    route: '/settings/data',
    icon: 'i-solar:database-bold-duotone',
    order: 7,
    parentId: 'hub',
    kind: 'area',
  },

  // ══════════════════════════════════════════════
  // GROUP 3: SYSTEM 系
  // ══════════════════════════════════════════════
  {
    id: 'area-system',
    label: 'System Preferences',
    shortLabel: 'System',
    titleKey: 'settings.pages.system.title',
    descriptionKey: 'settings.pages.system.description',
    description: 'Customize app language, 24-color theme palette, vibrancy, and user identity.',
    glyph: '系',
    clusterGroup: 'SYSTEM 系',
    route: '/settings/system',
    icon: 'i-solar:filters-bold-duotone',
    order: 8,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-stage',
    label: 'Floating Controls',
    shortLabel: 'Controls',
    titleKey: 'settings.pages.stage.title',
    descriptionKey: 'settings.pages.stage.description',
    description: 'Customize floating action strip slots, docking edge, and quick triggers.',
    glyph: '盤',
    clusterGroup: 'SYSTEM 系',
    route: '/settings/stage',
    icon: 'i-solar:widget-2-bold-duotone',
    order: 9,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-docs',
    label: 'Documentation',
    shortLabel: 'Docs',
    titleKey: 'settings.pages.docs.title',
    descriptionKey: 'settings.pages.docs.description',
    description: 'Access tutorials, architectural overviews, API guides, and manual reference.',
    glyph: '書',
    clusterGroup: 'SYSTEM 系',
    route: '/settings/docs',
    icon: 'i-solar:book-bookmark-bold-duotone',
    order: 10,
    parentId: 'hub',
    kind: 'area',
  },
  {
    id: 'area-about',
    label: 'About AIRI',
    shortLabel: 'About',
    titleKey: 'settings.pages.about.title',
    descriptionKey: 'settings.pages.about.description',
    description: 'Application version, release changelog, open source credits, and community links.',
    glyph: '誌',
    clusterGroup: 'SYSTEM 系',
    route: '/settings/about',
    icon: 'i-solar:info-circle-bold-duotone',
    order: 11,
    parentId: 'hub',
    kind: 'area',
  },

  // ── Level 2: Modules Subpages (under area-modules) ──

  // Cluster: PERCEPTION & FACULTIES 感
  {
    id: 'mod-consciousness',
    label: 'Consciousness & Mind',
    shortLabel: 'Mind',
    titleKey: 'settings.pages.modules.consciousness.title',
    descriptionKey: 'settings.pages.modules.consciousness.description',
    description: 'Personality, system prompt reasoning, and desired model baseline',
    glyph: '識',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/consciousness',
    icon: 'i-solar:ghost-bold-duotone',
    order: 1,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-speech',
    label: 'Speech (TTS)',
    shortLabel: 'Speech',
    titleKey: 'settings.pages.modules.speech.title',
    descriptionKey: 'settings.pages.modules.speech.description',
    description: 'Text-to-speech voice synthesis and parametric transformers',
    glyph: '声',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/speech',
    icon: 'i-solar:user-speak-rounded-bold-duotone',
    order: 2,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-hearing',
    label: 'Hearing (STT)',
    shortLabel: 'Hearing',
    titleKey: 'settings.pages.modules.hearing.title',
    descriptionKey: 'settings.pages.modules.hearing.description',
    description: 'Microphone input, voice activity detection (VAD), and streaming transcription',
    glyph: '聴',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/hearing',
    icon: 'i-solar:microphone-3-bold-duotone',
    order: 3,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-vision',
    label: 'Vision Perception (VLM)',
    shortLabel: 'Vision',
    titleKey: 'settings.pages.modules.vision.title',
    descriptionKey: 'settings.pages.modules.vision.description',
    description: 'Continuous background vision, OCR, and multimodal visual perception',
    glyph: '視',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/vision',
    icon: 'i-solar:eye-bold-duotone',
    order: 4,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-artistry',
    label: 'Artistry & Image Studio',
    shortLabel: 'Art',
    titleKey: 'settings.pages.modules.artistry.title',
    descriptionKey: 'settings.pages.modules.artistry.description',
    description: 'Autonomous image generation, ComfyUI studio, and memory illustrations',
    glyph: '画',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/artistry',
    icon: 'i-iconify-heroicons:photo',
    order: 5,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-text-to-motion',
    label: 'Text to Motion',
    shortLabel: 'Motion',
    titleKey: 'settings.pages.modules.text-to-motion.title',
    descriptionKey: 'settings.pages.modules.text-to-motion.description',
    description: 'Procedural LLM keyframes, FlowMDM 3D diffusion, and VRMA compilation',
    glyph: '動',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/text-to-motion',
    icon: 'i-solar:running-round-bold-duotone',
    order: 6,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-beat-sync',
    label: 'Beat Sync Live2D',
    shortLabel: 'Beat',
    titleKey: 'settings.pages.modules.beat_sync.title',
    descriptionKey: 'settings.pages.modules.beat_sync.description',
    description: 'Real-time audio rhythm detection and kinetic avatar dance synchronization',
    glyph: '律',
    clusterGroup: 'PERCEPTION & FACULTIES 感',
    route: '/settings/modules/beat-sync',
    icon: 'i-solar:music-notes-bold-duotone',
    order: 7,
    parentId: 'area-modules',
    kind: 'page',
  },

  // Cluster: BRIDGES & SYNC 網
  {
    id: 'mod-cloud-sync',
    label: 'Cloud Sync (BYOS)',
    shortLabel: 'Sync',
    titleKey: 'settings.pages.modules.cloud-sync.title',
    descriptionKey: 'settings.pages.modules.cloud-sync.description',
    description: 'Active state cloud sync, S3/R2 storage, and multi-device persistence outbox',
    glyph: '雲',
    clusterGroup: 'BRIDGES & SYNC 網',
    route: '/settings/modules/cloud-sync',
    icon: 'i-solar:cloud-bold-duotone',
    order: 8,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-cloudflare',
    label: 'Cloudflare',
    shortLabel: 'Cloudflare',
    titleKey: 'settings.pages.modules.cloudflare.title',
    descriptionKey: 'settings.pages.modules.cloudflare.description',
    description: 'Cloudflare account, workers edge subdomain, CORS proxy, and key vault',
    glyph: '網',
    clusterGroup: 'BRIDGES & SYNC 網',
    route: '/settings/modules/cloudflare',
    icon: 'i-solar:shield-network-bold-duotone',
    order: 8.5,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-mcp-server',
    label: 'MCP Server & Tools',
    shortLabel: 'MCP',
    titleKey: 'settings.pages.modules.mcp-server.title',
    descriptionKey: 'settings.pages.modules.mcp-server.description',
    description: 'Model Context Protocol servers, stdio integration, and custom tool suites',
    glyph: '器',
    clusterGroup: 'BRIDGES & SYNC 網',
    route: '/settings/modules/mcp',
    icon: 'i-solar:server-bold-duotone',
    order: 9,
    parentId: 'area-modules',
    kind: 'page',
  },

  // Cluster: PLATFORMS & MESSAGING 交
  {
    id: 'mod-messaging-discord',
    label: 'Discord Bot',
    shortLabel: 'Discord',
    titleKey: 'settings.pages.modules.messaging-discord.title',
    descriptionKey: 'settings.pages.modules.messaging-discord.description',
    description: 'Discord bot gateway, slash commands, text chat, and voice channel streaming',
    glyph: '交',
    clusterGroup: 'PLATFORMS & MESSAGING 交',
    route: '/settings/modules/messaging-discord',
    icon: 'i-simple-icons:discord',
    order: 10,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-x',
    label: 'X / Twitter',
    shortLabel: 'X',
    titleKey: 'settings.pages.modules.x.title',
    descriptionKey: 'settings.pages.modules.x.description',
    description: 'Autonomous social posting, timeline interactions, and companion updates',
    glyph: '鳥',
    clusterGroup: 'PLATFORMS & MESSAGING 交',
    route: '/settings/modules/x',
    icon: 'i-simple-icons:x',
    order: 11,
    parentId: 'area-modules',
    kind: 'page',
  },

  // Cluster: GAMING & WORLDS 遊
  {
    id: 'mod-gaming-minecraft',
    label: 'Minecraft Companion',
    shortLabel: 'MC',
    titleKey: 'settings.pages.modules.gaming-minecraft.title',
    descriptionKey: 'settings.pages.modules.gaming-minecraft.description',
    description: 'Play Minecraft cooperatively with autonomous mining, building, and dialogue',
    glyph: '方',
    clusterGroup: 'GAMING & WORLDS 遊',
    route: '/settings/modules/gaming-minecraft',
    icon: 'i-vscode-icons:file-type-minecraft',
    order: 12,
    parentId: 'area-modules',
    kind: 'page',
  },
  {
    id: 'mod-gaming-factorio',
    label: 'Factorio Companion',
    shortLabel: 'Factory',
    titleKey: 'settings.pages.modules.gaming-factorio.title',
    descriptionKey: 'settings.pages.modules.gaming-factorio.description',
    description: 'Monitor production, logistics networks, and automate factory operations',
    glyph: '工',
    clusterGroup: 'GAMING & WORLDS 遊',
    route: '/settings/modules/gaming-factorio',
    icon: 'i-solar:gamepad-bold-duotone',
    order: 13,
    parentId: 'area-modules',
    kind: 'page',
  },

  // ── Level 2: Providers Categories (under area-providers) ──
  {
    id: 'prov-cat-chat',
    label: 'Chat (LLM Providers)',
    shortLabel: 'Chat',
    glyph: '思',
    clusterGroup: 'INTELLIGENCE 知',
    route: '/settings/providers#chat',
    icon: 'i-solar:chat-square-like-bold-duotone',
    order: 1,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-cat-speech',
    label: 'Speech (TTS Voices)',
    shortLabel: 'Speech',
    glyph: '声',
    clusterGroup: 'VOICE 律',
    route: '/settings/providers#speech',
    icon: 'i-solar:volume-loud-bold-duotone',
    order: 2,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-cat-stt',
    label: 'Transcription (STT)',
    shortLabel: 'STT',
    glyph: '聴',
    clusterGroup: 'HEARING 聴',
    route: '/settings/providers#transcription',
    icon: 'i-solar:microphone-3-bold-duotone',
    order: 3,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-cat-vision',
    label: 'Vision (VLM Providers)',
    shortLabel: 'Vision',
    glyph: '視',
    clusterGroup: 'VISION 視',
    route: '/settings/providers#vision',
    icon: 'i-solar:eye-scan-bold-duotone',
    order: 4,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-blip-local',
    label: 'BLIP / WD (Local)',
    shortLabel: 'BLIP',
    glyph: '視',
    clusterGroup: 'LOCAL 端',
    route: '/settings/providers/chat/blip-local',
    icon: 'i-solar:eye-scan-bold-duotone',
    order: 1,
    parentId: 'prov-cat-vision',
    kind: 'page',
  },
  {
    id: 'prov-cat-artistry',
    label: 'Artistry (Image Models)',
    shortLabel: 'Artistry',
    glyph: '絵',
    clusterGroup: 'VISION 視',
    route: '/settings/providers#artistry',
    icon: 'i-solar:gallery-bold-duotone',
    order: 5,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-cat-motion',
    label: 'Motion (3D Generation)',
    shortLabel: 'Motion',
    glyph: '動',
    clusterGroup: 'KINETICS 動',
    route: '/settings/providers#motion',
    icon: 'i-solar:running-bold-duotone',
    order: 6,
    parentId: 'area-providers',
    kind: 'category',
  },
  {
    id: 'prov-cat-cloud',
    label: 'Cloud & Storage',
    shortLabel: 'Cloud',
    glyph: '雲',
    clusterGroup: 'STORAGE 庫',
    route: '/settings/providers#cloud',
    icon: 'i-solar:cloud-bold-duotone',
    order: 7,
    parentId: 'area-providers',
    kind: 'category',
  },

  // ── Level 2: System Subpages (under area-system) ──
  {
    id: 'sys-connection',
    label: 'Connection & Downloads',
    shortLabel: 'Network',
    titleKey: 'settings.pages.connection.title',
    descriptionKey: 'settings.pages.connection.description',
    description: 'Configure server endpoints, local channel gateway, and model download credentials (e.g. Hugging Face)',
    glyph: '網',
    clusterGroup: 'NETWORK 網',
    route: '/settings/system/connection',
    icon: 'i-solar:wi-fi-router-bold-duotone',
    order: 1,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-user-profile',
    label: 'User Profile & Identity',
    shortLabel: 'Profile',
    titleKey: 'settings.pages.system.user-profile.title',
    descriptionKey: 'settings.pages.system.user-profile.description',
    description: 'Manage your name, callsign, companion relationship, and personal voice clone sample',
    glyph: '名',
    clusterGroup: 'IDENTITY 身',
    route: '/settings/system/user-profile',
    icon: 'i-solar:user-bold-duotone',
    order: 2,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-general',
    label: 'General Preferences',
    shortLabel: 'General',
    titleKey: 'settings.pages.system.general.title',
    descriptionKey: 'settings.pages.system.general.description',
    description: 'Interface language, date formats, fallback localization, and application startup defaults',
    glyph: '通',
    clusterGroup: 'PREFERENCES 設',
    route: '/settings/system/general',
    icon: 'i-solar:tuning-square-2-bold-duotone',
    order: 3,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-color-scheme',
    label: 'Color Scheme & Themes',
    shortLabel: 'Theme',
    titleKey: 'settings.pages.system.color-scheme.title',
    descriptionKey: 'settings.pages.system.color-scheme.description',
    description: '24-color spectrum palette, vibrancy adjustments, light/dark styling, and window blur',
    glyph: '色',
    clusterGroup: 'APPEARANCE 容',
    route: '/settings/system/color-scheme',
    icon: 'i-solar:pallete-2-bold-duotone',
    order: 4,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-chat',
    label: 'Chat Settings & Input',
    shortLabel: 'Chat',
    titleKey: 'settings.pages.chat.title',
    descriptionKey: 'settings.pages.chat.description',
    description: 'Send key combinations, streaming response timeouts, and message bubble behavior',
    glyph: '話',
    clusterGroup: 'INTERFACE 境',
    route: '/settings/system/chat',
    icon: 'i-solar:chat-round-dots-bold-duotone',
    order: 5,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-dating-sim',
    label: 'Dating Sim Mode',
    shortLabel: 'Dating',
    titleKey: 'settings.pages.dating-sim.title',
    descriptionKey: 'settings.pages.dating-sim.description',
    description: 'Adjust interactive game modes, intimacy gating thresholds, and visual behavior rules.',
    glyph: '愛',
    clusterGroup: 'EXPERIENCE 境',
    route: '/settings/dating-sim',
    icon: 'i-solar:heart-bold-duotone',
    order: 6,
    parentId: 'area-system',
    kind: 'page',
  },
  {
    id: 'sys-window-shortcuts',
    label: 'Global Shortcuts',
    shortLabel: 'Hotkeys',
    titleKey: 'tamagotchi.settings.pages.system.window-shortcuts.title',
    descriptionKey: 'tamagotchi.settings.pages.system.window-shortcuts.description',
    description: 'System-wide keyboard shortcuts to summon chat, toggle stage visibility, and push-to-talk',
    glyph: '鍵',
    clusterGroup: 'SHORTCUTS 鍵',
    route: '/settings/system/window-shortcuts',
    icon: 'i-solar:keyboard-bold-duotone',
    order: 7,
    parentId: 'area-system',
    kind: 'page',
    desktopOnly: true,
  },
  {
    id: 'sys-developer',
    label: 'Developer Laboratory',
    shortLabel: 'DevTools',
    titleKey: 'settings.pages.system.developer.title',
    descriptionKey: 'settings.pages.system.developer.description',
    description: 'Diagnostic instruments, traffic inspector, orbital navigation playground, and benchmarks',
    glyph: '開',
    clusterGroup: 'LABORATORY 研',
    route: '/settings/system/developer',
    icon: 'i-solar:code-bold-duotone',
    order: 8,
    parentId: 'area-system',
    kind: 'page',
  },

  // ── Level 3: Developer Tools (under sys-developer) ──

  // Cluster: RUNTIME & NEURAL LABS 脳
  {
    id: 'dev-vision',
    label: 'Vision & Attention Ecology Inspector',
    shortLabel: 'Vision',
    description: 'Real-time 5-workload VLM ticker, 0-cost salience gate, and context publisher',
    glyph: '視',
    clusterGroup: 'RUNTIME & NEURAL LABS 脳',
    route: '/devtools/vision',
    icon: 'i-solar:eye-bold-duotone',
    order: 1,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },
  {
    id: 'dev-core-ai-lab',
    label: 'Core AI Lab (Apple Silicon / CoreML)',
    shortLabel: 'CoreML',
    description: 'Apple Silicon telemetry, CoreML model hub, ANE specialization & token streaming',
    glyph: '核',
    clusterGroup: 'RUNTIME & NEURAL LABS 脳',
    route: '/devtools/core-ai-lab',
    icon: 'i-solar:cpu-bold-duotone',
    order: 2,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-context-flow',
    label: 'Context Flow Inspector',
    shortLabel: 'Flow',
    description: 'Live prompt assembly, incoming context updates, and outgoing chat stream events',
    glyph: '脈',
    clusterGroup: 'RUNTIME & NEURAL LABS 脳',
    route: '/devtools/context-flow',
    icon: 'i-solar:branching-paths-up-bold-duotone',
    order: 3,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-beat-sync',
    label: 'Beat Sync Visualizer',
    shortLabel: 'BeatSync',
    description: 'Plot V-motion targets, trajectory spring physics, and real-time audio FFT',
    glyph: '律',
    clusterGroup: 'RUNTIME & NEURAL LABS 脳',
    route: '/devtools/beat-sync',
    icon: 'i-solar:music-notes-bold-duotone',
    order: 4,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-live2d',
    label: 'Live2D DSL Playground',
    shortLabel: 'Live2D',
    description: 'Isolated Live2D .zip runner with real-time VarFloats inspector & intimacy sandbox',
    glyph: '演',
    clusterGroup: 'RUNTIME & NEURAL LABS 脳',
    route: '/devtools/live2d',
    icon: 'i-solar:play-circle-bold-duotone',
    order: 5,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },

  // Cluster: DIAGNOSTICS & SYSTEM 診
  {
    id: 'dev-websocket-inspector',
    label: 'WebSocket Traffic Inspector',
    shortLabel: 'WS',
    description: 'Real-time WebSocket event ledger, packets & channel server traffic',
    glyph: '流',
    clusterGroup: 'DIAGNOSTICS & SYSTEM 診',
    route: '/devtools/websocket-inspector',
    icon: 'i-solar:radar-2-bold-duotone',
    order: 6,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-plugin-host',
    label: 'Plugin Host DevTools',
    shortLabel: 'Plugin',
    description: 'Inspect discovered/enabled plugins and control load/unload lifecycle',
    glyph: '挿',
    clusterGroup: 'DIAGNOSTICS & SYSTEM 診',
    route: '/devtools/plugin-host',
    icon: 'i-solar:bug-bold-duotone',
    order: 7,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-performance-visualizer',
    label: 'Performance & Lag Visualizer',
    shortLabel: 'Perf',
    description: 'Real-time FPS, render frame lag visualizer, and memory load metrics',
    glyph: '測',
    clusterGroup: 'DIAGNOSTICS & SYSTEM 診',
    route: '/devtools/performance-visualizer',
    icon: 'i-solar:chart-square-bold-duotone',
    order: 8,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-screen-capture',
    label: 'Screen & Audio Capture Diagnostics',
    shortLabel: 'Capture',
    description: 'Screen capture stream diagnostics, system audio capture, and window picker',
    glyph: '画',
    clusterGroup: 'DIAGNOSTICS & SYSTEM 診',
    route: '/devtools/screen-capture',
    icon: 'i-solar:screen-share-bold-duotone',
    order: 9,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },
  {
    id: 'dev-aliyun-transcriber',
    label: 'Aliyun Real-time Transcriber',
    shortLabel: 'Aliyun',
    description: 'Stream microphone audio to Aliyun NLS and inspect live transcripts',
    glyph: '音',
    clusterGroup: 'DIAGNOSTICS & SYSTEM 診',
    route: '/devtools/providers-transcription-realtime-aliyun-nls',
    icon: 'i-solar:microphone-3-bold-duotone',
    order: 10,
    parentId: 'sys-developer',
    kind: 'tool',
  },

  // Cluster: UI & WINDOW INSTRUMENTS 具
  {
    id: 'dev-orbital-navigation',
    label: 'Orbital Navigation Playground',
    shortLabel: 'Orbital',
    description: 'Data-driven settings topology renderer & motion playground (Eiki spec)',
    glyph: '軌',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/orbital-navigation',
    icon: 'i-solar:planet-bold-duotone',
    order: 11,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-widgets-calling',
    label: 'Widgets Calling Sandbox',
    shortLabel: 'Widgets',
    description: 'Spawn overlay widgets, inspect bounds, and test component props',
    glyph: '窓',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/widgets-calling',
    icon: 'i-solar:widget-add-bold-duotone',
    order: 12,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },
  {
    id: 'dev-all-displays',
    label: 'Displays & Cursor Telemetry',
    shortLabel: 'Displays',
    description: 'Multi-display coordinate mapper, screen bounds, and cursor position',
    glyph: '屏',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/use-electron-all-displays',
    icon: 'i-solar:monitor-bold-duotone',
    order: 13,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },
  {
    id: 'dev-relative-mouse',
    label: 'Relative Mouse Inspector',
    shortLabel: 'Mouse',
    description: 'Test cursor position relative to window bounds and hitboxes',
    glyph: '標',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/use-electron-relative-mouse',
    icon: 'i-solar:cursor-bold-duotone',
    order: 14,
    parentId: 'sys-developer',
    kind: 'tool',
    desktopOnly: true,
  },
  {
    id: 'dev-magic-keys',
    label: 'MagicKeys Shortcut Tester',
    shortLabel: 'Keys',
    description: 'Test active keyboard combinations and global hotkey listeners',
    glyph: '鍵',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/use-magic-keys',
    icon: 'i-solar:keyboard-bold-duotone',
    order: 15,
    parentId: 'sys-developer',
    kind: 'tool',
  },
  {
    id: 'dev-markdown-stress',
    label: 'Markdown Stress Testbed',
    shortLabel: 'MD',
    description: 'Render complex markdown, KaTeX math formulas, code blocks, and streaming chunks',
    glyph: '文',
    clusterGroup: 'UI & WINDOW INSTRUMENTS 具',
    route: '/devtools/markdown-stress',
    icon: 'i-solar:document-text-bold-duotone',
    order: 16,
    parentId: 'sys-developer',
    kind: 'tool',
  },
]

const CATEGORY_PARENT_MAP: Record<string, string> = {
  chat: 'prov-cat-chat',
  speech: 'prov-cat-speech',
  transcription: 'prov-cat-stt',
  hearing: 'prov-cat-stt',
  vision: 'prov-cat-vision',
  artistry: 'prov-cat-artistry',
  motion: 'prov-cat-motion',
  cloud: 'prov-cat-cloud',
  storage: 'prov-cat-cloud',
  embed: 'prov-cat-chat',
}

/**
 * Converts a raw ProviderDefinition or ProviderMetadata into a CatalogNodeItem.
 */
export function convertProviderToCatalogNodeItem(
  p: {
    id: string
    name: string
    category?: string
    description?: string
    icon?: string
    deployment?: 'local' | 'cloud'
    [key: string]: unknown
  },
  fallbackOrder = 50,
): CatalogNodeItem {
  const rawCategory = (p.category || 'chat').toLowerCase()
  const parentId = CATEGORY_PARENT_MAP[rawCategory] || 'prov-cat-chat'
  const routeCategory = p.id === 'blip-local'
    ? 'chat'
    : (rawCategory === 'transcription' || rawCategory === 'hearing' ? 'transcription' : rawCategory)
  const route = `/settings/providers/${routeCategory}/${p.id}`

  const isLocal = p.deployment === 'local' || p.id.includes('local') || p.id.includes('wasm') || p.id.includes('rwkv')

  return {
    id: `prov-${p.id}`,
    label: p.name,
    shortLabel: p.name.replace(/\(.*?\)/g, '').trim().split(' ')[0] || p.name.slice(0, 8),
    description: p.description || `${p.name} inference provider`,
    glyph: isLocal ? '端' : '雲',
    clusterGroup: isLocal ? 'LOCAL 端' : 'CLOUD 雲',
    route,
    icon: p.icon || (isLocal ? 'i-solar:cpu-bold-duotone' : 'i-solar:cloud-bold-duotone'),
    order: fallbackOrder,
    parentId,
    kind: 'page',
  }
}

/**
 * Returns all catalog items: curated items plus dynamic provider fallback nodes for any
 * registered providers not explicitly curated in SETTINGS_CATALOG_ITEMS.
 */
export function getAllCatalogItems(
  customProviders?: Array<any> | Record<string, any>,
): CatalogNodeItem[] {
  const items = [...SETTINGS_CATALOG_ITEMS]
  const existingIds = new Set(items.map(item => item.id))
  const existingRoutes = new Set(items.map(item => item.route).filter(Boolean))

  let providerList: Array<any> = []
  if (customProviders) {
    providerList = Array.isArray(customProviders) ? customProviders : Object.values(customProviders)
  }
  else if (typeof listProviders === 'function') {
    providerList = listProviders()
  }

  let index = 1
  for (const p of providerList) {
    if (!p || !p.id)
      continue

    const candidateId = `prov-${p.id}`
    const rawCategory = (p.category || 'chat').toLowerCase()
    const routeCategory = rawCategory === 'transcription' || rawCategory === 'hearing' ? 'transcription' : rawCategory
    const candidateRoute = `/settings/providers/${routeCategory}/${p.id}`

    if (!existingIds.has(candidateId) && !existingRoutes.has(candidateRoute)) {
      const dynamicNode = convertProviderToCatalogNodeItem(p, 50 + index)
      items.push(dynamicNode)
      existingIds.add(candidateId)
      existingRoutes.add(candidateRoute)
      index++
    }
  }

  return items
}

/**
 * Builds the canonical directed tree from the catalog items, dynamically hydrating any
 * missing providers from the Provider Registry.
 */
export function buildSettingsCatalogTopology(
  customProviders?: Array<any> | Record<string, any>,
): SettingsTopology {
  const allItems = getAllCatalogItems(customProviders)
  const nodesById: Record<string, SettingsTopologyNode> = {}

  for (const item of allItems) {
    nodesById[item.id] = {
      id: item.id,
      label: item.label,
      shortLabel: item.shortLabel || item.label.slice(0, 6),
      titleKey: item.titleKey,
      description: item.description,
      descriptionKey: item.descriptionKey,
      glyph: item.glyph,
      route: item.route,
      parentId: item.parentId,
      children: [],
      order: item.order,
      kind: item.kind || 'page',
      icon: item.icon,
      desktopOnly: item.desktopOnly,
      metadata: {
        clusterGroup: item.clusterGroup,
      },
    }
  }

  for (const [id, node] of Object.entries(nodesById)) {
    if (node.parentId && nodesById[node.parentId]) {
      const parent = nodesById[node.parentId]
      if (!parent.children.includes(id)) {
        parent.children.push(id)
      }
    }
  }

  return {
    rootId: 'hub',
    nodesById,
  }
}

/**
 * Resolves the unique root-to-node path of node IDs.
 */
export function resolvePath(topology: SettingsTopology, activeId: string): string[] {
  const { rootId, nodesById } = topology
  if (!nodesById[activeId]) {
    return rootId ? [rootId] : []
  }

  const path: string[] = []
  let currentId: string | null = activeId
  const visited = new Set<string>()

  while (currentId !== null) {
    if (visited.has(currentId)) {
      break
    }
    visited.add(currentId)
    path.unshift(currentId)
    const node: SettingsTopologyNode | undefined = nodesById[currentId]
    currentId = node ? node.parentId : null
  }

  if (path.length > 0 && path[0] !== rootId && nodesById[rootId]) {
    path.unshift(rootId)
  }

  return path
}

/**
 * Resolves the node ID and path that best corresponds to a given route URL path and optional hash.
 */
export function resolvePathFromRoute(
  topology: SettingsTopology,
  routePath: string,
  hash?: string,
): { nodeId: string, path: string[] } {
  const normalizedRoute = routePath.replace(/\/$/, '') || '/'
  const cleanHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : ''
  const fullRouteWithHash = `${normalizedRoute}${cleanHash}`
  const { rootId, nodesById } = topology

  // 1. Exact route + hash match (e.g. /settings/providers#speech)
  if (cleanHash) {
    for (const node of Object.values(nodesById)) {
      if (node.route && (node.route === fullRouteWithHash || node.route.replace(/\/$/, '') === fullRouteWithHash)) {
        return {
          nodeId: node.id,
          path: resolvePath(topology, node.id),
        }
      }
    }
  }

  // 2. Exact route match (ignoring hash on route if not matched)
  for (const node of Object.values(nodesById)) {
    if (node.route) {
      const nodeBase = node.route.split('#')[0].replace(/\/$/, '')
      if (node.route === normalizedRoute || nodeBase === normalizedRoute) {
        if (!node.route.includes('#')) {
          return {
            nodeId: node.id,
            path: resolvePath(topology, node.id),
          }
        }
      }
    }
  }

  // 3. Longest prefix match
  let bestMatch: SettingsTopologyNode | null = null
  let bestPrefixLen = 0

  for (const node of Object.values(nodesById)) {
    if (node.route) {
      const nodeRouteBase = node.route.split('#')[0].replace(/\/$/, '')
      if (nodeRouteBase && normalizedRoute.startsWith(nodeRouteBase) && nodeRouteBase.length > bestPrefixLen) {
        bestMatch = node
        bestPrefixLen = nodeRouteBase.length
      }
    }
  }

  if (bestMatch) {
    return {
      nodeId: bestMatch.id,
      path: resolvePath(topology, bestMatch.id),
    }
  }

  return {
    nodeId: rootId,
    path: [rootId],
  }
}

/**
 * Resolves the hierarchical parent route to navigate "Back" to.
 */
export function resolveSettingsBackRoute(
  routePath: string,
  options?: {
    isDesktop?: boolean
    topology?: SettingsTopology
  },
): string | null {
  const normalizedRoute = routePath.replace(/\/$/, '') || '/'

  // 1. Root of settings
  if (normalizedRoute === '/settings') {
    return options?.isDesktop ? null : '/'
  }

  // 2. Special case for providers category tabs
  if (normalizedRoute.startsWith('/settings/providers/')) {
    const segments = normalizedRoute.split('/').filter(Boolean)
    const category = segments[2]
    const hash = category && category !== 'chat' ? `#${category}` : '#chat'
    return `/settings/providers${hash}`
  }

  // 3. Topology lookup
  const topology = options?.topology || buildSettingsCatalogTopology()
  const { nodeId, path } = resolvePathFromRoute(topology, normalizedRoute)
  const matchedNode = topology.nodesById[nodeId]

  if (matchedNode?.route && matchedNode.route !== normalizedRoute && normalizedRoute.startsWith(matchedNode.route)) {
    return matchedNode.route
  }

  if (path.length > 1) {
    const parentNodeId = path[path.length - 2]
    const parentNode = topology.nodesById[parentNodeId]
    if (parentNode?.route) {
      return parentNode.route
    }
  }

  const segments = normalizedRoute.split('/').filter(Boolean)
  if (segments.length > 1) {
    return `/${segments.slice(0, -1).join('/')}`
  }

  return '/settings'
}
