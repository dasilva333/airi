export interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
  icon?: string
}

export const DOCS_SECTIONS = [
  {
    defaultPath: 'overview/',
    icon: 'i-lucide:rocket',
    id: 'overview',
    titleKey: 'settings.pages.docs.sections.overview',
  },
  {
    defaultPath: 'manual/tamagotchi/',
    icon: 'i-lucide:book-open',
    id: 'manual',
    titleKey: 'settings.pages.docs.sections.manual',
  },
  {
    defaultPath: 'chronicles/integration-checklist',
    icon: 'i-lucide:calendar-days',
    id: 'chronicles',
    titleKey: 'settings.pages.docs.sections.chronicles',
  },
]

export const DOCS_SIDEBAR: Record<string, SidebarItem[]> = {
  chronicles: [
    {
      items: [{ link: 'chronicles/integration-checklist', text: 'Integration Checklist' }],
      text: 'Maintainer Status',
    },
    {
      items: [
        { link: 'chronicles/roadmap', text: 'Project Roadmap' },
        { link: 'chronicles/feature-report', text: 'Feature Report' },
      ],
      text: 'Project Evolution',
    },
    {
      items: [
        { link: 'chronicles/version-v0.1.0/', text: 'Initial Publish v0.1.0' },
        { link: 'chronicles/version-v0.0.1/', text: 'Before Story v0.0.1' },
      ],
      text: 'Version History',
    },
  ],
  manual: [
    {
      items: [
        {
          items: [
            { link: 'manual/tamagotchi/', text: 'Desktop Version' },
            { link: 'manual/web/', text: 'Web Version' },
          ],
          text: 'Quick Start',
        },
        {
          items: [
            { link: 'manual/config/settings-overview', text: 'Settings Overview' },
            { link: 'manual/config/character-card', text: 'Character & Card' },
            { link: 'manual/config/modules', text: 'Intelligence & Modules' },
            { link: 'manual/config/system-data', text: 'System & Data' },
          ],
          text: 'Configuration',
        },
      ],
      text: 'User Guides',
    },
    {
      items: [
        { link: 'advanced/', text: 'Architecture Overview' },
        {
          items: [
            { link: 'advanced/architecture/arch-chat-stt-proactivity-pipelines', text: 'Interaction Pipelines' },
            { link: 'advanced/architecture/arch-comfyui-native-api-engine', text: 'ComfyUI Native Engine' },
            { link: 'advanced/architecture/arch-gateway-security-hardening', text: 'Gateway Security' },
            { link: 'advanced/architecture/arch-memory-system-overview', text: 'Memory System' },
            { link: 'advanced/architecture/arch-live2d-wasm-optimization', text: 'Live2D Optimization' },
            { link: 'advanced/architecture/arch-long-term-memory-journal', text: 'Long-term Memory Journal' },
            { link: 'advanced/architecture/arch-mcp-integration', text: 'MCP Integration' },
            { link: 'advanced/architecture/arch-provider-store-current-structure', text: 'Provider Store Structure' },
            { link: 'advanced/architecture/arch-short-term-memory-summaries', text: 'Short-term Memory Summaries' },
          ],
          text: 'Pipelines & Workflows',
        },
        {
          items: [
            { link: 'advanced/architecture/design-minecraft', text: 'Minecraft Integration' },
            { link: 'advanced/architecture/design-discord-bot-integration', text: 'Discord Bot Integration' },
            { link: 'advanced/architecture/design-satori', text: 'Satori Protocol' },
            { link: 'advanced/architecture/design-telegram', text: 'Telegram Bot' },
          ],
          text: 'System Components',
        },
      ],
      text: 'Deep Architecture',
    },
    {
      items: [
        { link: 'contributing/', text: 'Environment Setup' },
        { link: 'contributing/tamagotchi', text: 'Desktop Development' },
        { link: 'contributing/webui', text: 'Web Development' },
        { link: 'contributing/docs', text: 'Docs Development' },
      ],
      text: 'Development',
    },
  ],
  overview: [
    {
      items: [
        { link: 'overview/', text: 'Introduction' },
        { link: 'overview/versions', text: 'Versions & Downloads' },
        { link: 'overview/about-ai-vtuber', text: 'About AI VTuber' },
        { link: 'overview/about-neuro-sama', text: 'About Neuro-sama' },
        { link: 'overview/other-similar-projects', text: 'Other Similar Projects' },
      ],
      text: 'Overview',
    },
  ],
}
