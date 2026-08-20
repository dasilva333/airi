/**
 * Canonical sidebar definition for Project AIRI documentation.
 * Both the VitePress standalone site and the in-app docs viewer consume this file.
 *
 * Each consumer transforms items for its own format:
 * - VitePress: wraps links with withBase('/en/docs/{link}')
 * - In-app docs: uses relative links as-is
 */

export interface SharedSidebarItem {
  text: string
  link?: string
  items?: SharedSidebarItem[]
}

export interface SharedSidebarSection {
  id: string
  text: string
  titleKey: string
  icon: string
  defaultPath: string
  items: SharedSidebarItem[]
}

export const SHARED_SIDEBAR: SharedSidebarSection[] = [
  {
    id: 'overview',
    text: 'Overview',
    titleKey: 'settings.pages.docs.sections.overview',
    icon: 'lucide:rocket',
    defaultPath: 'overview/',
    items: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: 'overview/' },
          { text: 'Versions & Downloads', link: 'overview/versions' },
          { text: 'About AI VTuber', link: 'overview/about-ai-vtuber' },
          { text: 'About Neuro-sama', link: 'overview/about-neuro-sama' },
          { text: 'Other Similar Projects', link: 'overview/other-similar-projects' },
        ],
      },
    ],
  },
  {
    id: 'showcase',
    text: 'Showcase',
    titleKey: 'settings.pages.docs.sections.showcase',
    icon: 'lucide:images',
    defaultPath: 'showcase/',
    items: [
      {
        text: 'Feature Showcase',
        items: [
          { text: 'Gallery', link: 'showcase/' },
          {
            text: 'Character System',
            items: [
              { text: 'AIRI Card System', link: 'showcase/01-card-system' },
              { text: 'AnimaDex Wizard', link: 'showcase/02-animadex-wizard' },
            ],
          },
          {
            text: 'Stage & Models',
            items: [
              { text: 'Model Selector', link: 'showcase/03-model-selector' },
              { text: 'Live2D System', link: 'showcase/04-live2d-system' },
            ],
          },
          {
            text: 'Chat & Desktop',
            items: [
              { text: 'Chatbox Redesign', link: 'showcase/05-chatbox-redesign' },
              { text: 'Desktop Control Strip', link: 'showcase/06-control-strip' },
            ],
          },
          {
            text: 'AI & Cognition',
            items: [
              { text: 'AI Producer', link: 'showcase/07-producer-subsystem' },
              { text: 'Situational Awareness', link: 'showcase/08-situational-awareness' },
            ],
          },
          {
            text: 'Creative & Platforms',
            items: [
              { text: 'Artistry', link: 'showcase/09-artistry' },
              { text: 'Discord Integration', link: 'showcase/10-discord-integration' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'manual',
    text: 'Manual',
    titleKey: 'settings.pages.docs.sections.manual',
    icon: 'lucide:book-open',
    defaultPath: 'manual/tamagotchi/',
    items: [
      {
        text: 'User Guides',
        items: [
          {
            text: 'Quick Start',
            items: [
              { text: 'Desktop Version', link: 'manual/tamagotchi/' },
              { text: 'Web Version', link: 'manual/web/' },
            ],
          },
          {
            text: 'Configuration',
            items: [
              { text: 'Settings Overview', link: 'manual/config/settings-overview' },
              { text: 'Character & Card', link: 'manual/config/character-card' },
              { text: 'Intelligence & Modules', link: 'manual/config/modules' },
              { text: 'System & Data', link: 'manual/config/system-data' },
              { text: 'Studio', link: 'manual/config/studio' },
              { text: 'Discord Commands', link: 'manual/config/discord-commands' },
              { text: 'Gateway Security', link: 'manual/config/gateway' },
            ],
          },
          {
            text: 'Feature Guides',
            items: [
              { text: 'Ways to Talk & Interact', link: 'manual/interacting' },
              { text: 'Proactivity & Behaviors', link: 'manual/proactivity' },
              { text: 'Vision & Screen Perception', link: 'manual/vision' },
              { text: 'Local Artistry (ComfyUI)', link: 'manual/comfyui' },
              { text: 'How Memory Works', link: 'manual/memory' },
              { text: 'Expanding with MCP & Tools', link: 'manual/mcp-tools' },
              { text: 'Custom 3D & 2D Avatars', link: 'manual/custom-models' },
              { text: 'Desktop Controls & Shortcuts', link: 'manual/desktop-controls' },
              { text: 'AnimaDex Character Creator', link: 'manual/animadex-creator' },
              { text: 'AI Producer & Roleplay', link: 'manual/ai-producer' },
              { text: 'Dating Sim & Scenarios', link: 'manual/dating-sim' },
              { text: 'Generative Motion & Gestures', link: 'manual/motion-and-gestures' },
              { text: 'V-HACK Avatar Modding', link: 'manual/vhack-avatar-modding' },
              { text: 'Captions & Subtitles', link: 'manual/captions-and-subtitles' },
              { text: 'Multi-Actor Staging & Outfits', link: 'manual/multi-actor-staging' },
            ],
          },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Environment Setup', link: 'contributing/' },
          { text: 'Desktop Development', link: 'contributing/tamagotchi' },
          { text: 'Web Development', link: 'contributing/webui' },
          { text: 'Docs Development', link: 'contributing/docs' },
        ],
      },
    ],
  },
  {
    id: 'chronicles',
    text: 'Chronicles',
    titleKey: 'settings.pages.docs.sections.chronicles',
    icon: 'lucide:calendar-days',
    defaultPath: 'chronicles/integration-checklist',
    items: [
      {
        text: 'Maintainer Status',
        items: [
          { text: 'Integration Checklist', link: 'chronicles/integration-checklist' },
        ],
      },
      {
        text: 'Project Evolution',
        items: [
          { text: 'Project Roadmap', link: 'chronicles/roadmap' },
          { text: 'Feature Report', link: 'chronicles/feature-report' },
        ],
      },
      {
        text: 'Version History',
        items: [
          { text: 'Initial Publish v0.1.0', link: 'chronicles/version-v0.1.0/' },
          { text: 'Before Story v0.0.1', link: 'chronicles/version-v0.0.1/' },
        ],
      },
    ],
  },
]
