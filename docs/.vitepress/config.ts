import { join, posix, resolve } from 'node:path'
import { env } from 'node:process'
import i18n from '@intlify/unplugin-vue-i18n/vite'
import { footnote } from '@mdit/plugin-footnote'
import { tasklist } from '@mdit/plugin-tasklist'
import anchor from 'markdown-it-anchor'
import unocss from 'unocss/vite'
import yaml from 'unplugin-yaml/vite'
import type { DefaultTheme } from 'vitepress'
import { defineConfig, postcssIsolateStyles } from 'vitepress'

import { version } from '../../package.json'
import { teamMembers } from './contributors'
import { discord, github, ogImage, ogUrl, projectDescription, projectName, projectShortName, releases, x } from './meta'
import { frontmatterAssets } from './plugins/vite-frontmatter-assets'

function withBase(url: string) {
  return env.BASE_URL
    ? env.BASE_URL.endsWith('/')
      ? posix.join(env.BASE_URL.replace(/\/$/, ''), url)
      : posix.join(env.BASE_URL, url)
    : url
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  appearance: 'dark',
  base: env.BASE_URL || '/',
  cleanUrls: true,
  description: projectDescription,
  head: [
    ['meta', { content: '#0b0d0f', name: 'theme-color' }],
    ['link', { href: '/favicon.svg', rel: 'icon', sizes: 'any', type: 'image/svg+xml' }],
    ['link', { href: '/apple-touch-icon.png', rel: 'apple-touch-icon', sizes: '180x180' }],
    ['meta', { content: projectName, name: 'apple-mobile-web-app-title' }],
    ['meta', { content: 'yes', name: 'apple-mobile-web-app-capable' }],
    [
      'meta',
      { content: `${teamMembers.map((c) => c.name).join(', ')} and ${projectName} contributors`, name: 'author' },
    ],
    ['meta', { content: '', name: 'keywords' }],
    ['meta', { content: projectName, property: 'og:title' }],
    ['meta', { content: projectName, property: 'og:site_name' }],
    ['meta', { content: ogImage, property: 'og:image' }],
    ['meta', { content: projectDescription, property: 'og:description' }],
    ['meta', { content: ogUrl, property: 'og:url' }],
    ['meta', { content: projectName, name: 'twitter:title' }],
    ['meta', { content: projectDescription, name: 'twitter:description' }],
    ['meta', { content: ogImage, name: 'twitter:image' }],
    ['meta', { content: 'summary_large_image', name: 'twitter:card' }],
    ['link', { color: '#ffffff', href: '/logo.svg', rel: 'mask-icon' }],
    // Proxying Plausible through Netlify | Plausible docs
    // https://plausible.io/docs/proxy/guides/netlify
    ['script', { async: '', src: 'https://plausible.io/js/pa-HI8-_JIBI6d_2IgIr2Tai.js' }],
    [
      'script',
      {},
      `
      window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
      plausible.init()
    `,
    ],
    [
      'script',
      {},
      `
      ;(function () {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const setting = localStorage.getItem('vueuse-color-scheme') || 'auto'
        if (setting === 'light' || (prefersDark && setting !== 'dark')) {
          document.querySelector('#themeColor')?.setAttribute('content', 'rgb(255,255,255)')
        }
      })()
    `,
    ],
  ],
  ignoreDeadLinks: true,
  lastUpdated: true,
  locales: {
    ja: {
      label: '日本語',
      lang: 'ja',
      themeConfig: {
        darkModeSwitchLabel: '外観モード',
        docFooter: {
          next: '次のページ',
          prev: '前のページ',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: 'GitHub でこのページを編集',
        },
        langMenuLabel: '言語を変更',
        lastUpdated: {
          text: '最終更新',
        },
        logo: withBase('/favicon.svg'),
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { link: withBase('/ja/docs/overview/'), text: 'ドキュメント' },
          { link: withBase('/ja/blog/'), text: 'ブログ' },
          {
            items: [{ link: releases, text: 'リリースノート' }],
            text: `v${version}`,
          },
          {
            items: [
              { link: withBase('/ja/about/privacy'), text: 'プライバシーポリシー' },
              { link: withBase('/ja/about/terms'), text: '利用規約' },
            ],
            text: '概要',
          },
        ],
        outline: {
          label: 'このページの内容',
          level: 'deep',
        },
        returnToTopLabel: 'トップに戻る',

        sidebar: [
          {
            icon: 'lucide:rocket',
            items: [
              { link: withBase('/ja/docs/overview/'), text: 'はじめに' },
              { link: withBase('/ja/docs/overview/versions'), text: 'バージョンとダウンロード' },
              { link: withBase('/ja/docs/overview/about-ai-vtuber'), text: 'AI VTuberについて' },
              { link: withBase('/ja/docs/overview/about-neuro-sama'), text: 'Neuro-samaについて' },
              { link: withBase('/ja/docs/overview/other-similar-projects'), text: 'その他の類似プロジェクト' },
            ],
            text: '概要',
          },
          {
            icon: 'lucide:book-open',
            items: [
              {
                items: [
                  { link: withBase('/ja/docs/manual/tamagotchi/'), text: 'デスクトップ版' },
                  { link: withBase('/ja/docs/manual/web/'), text: 'Web版' },
                ],
                text: 'クイックスタート',
              },
              {
                items: [{ link: withBase('/ja/docs/manual/config/'), text: '設定ガイド' }],
                text: '設定',
              },
              {
                items: [
                  {
                    link: withBase('/ja/docs/contributing/architecture/arch-chat-stt-proactivity-pipelines'),
                    text: 'インタラクションパイプライン',
                  },
                  {
                    link: withBase('/ja/docs/contributing/architecture/arch-comfyui-native-api-engine'),
                    text: 'ComfyUI ネイティブエンジン',
                  },
                  {
                    link: withBase('/ja/docs/contributing/architecture/arch-gateway-security-hardening'),
                    text: 'ゲートウェイのセキュリティ',
                  },
                  {
                    link: withBase('/ja/docs/contributing/architecture/arch-memory-system-overview'),
                    text: 'メモリシステム',
                  },
                  {
                    link: withBase('/ja/docs/contributing/architecture/arch-live2d-wasm-optimization'),
                    text: 'Live2D の最適化',
                  },
                ],
                text: 'アーキテクチャとデザイン',
              },
            ],
            text: 'マニュアル',
          },
          {
            icon: 'lucide:users',
            items: [
              {
                items: [
                  { link: withBase('/ja/docs/contributing/'), text: '環境構築と事前準備' },
                  { link: withBase('/ja/docs/contributing/tamagotchi'), text: 'デスクトップアプリ' },
                  { link: withBase('/ja/docs/contributing/webui'), text: 'Web UI' },
                  { link: withBase('/ja/docs/contributing/docs'), text: 'ドキュメントサイト' },
                ],
                text: '基本設定と開発',
              },
              {
                items: [
                  { link: withBase('/ja/docs/contributing/services/minecraft'), text: 'Minecraft' },
                  { link: withBase('/ja/docs/contributing/services/satori'), text: 'Satori Bot' },
                  { link: withBase('/ja/docs/contributing/services/telegram'), text: 'Telegram Bot' },
                  { link: withBase('/ja/docs/contributing/services/discord'), text: 'Discord Bot' },
                ],
                text: 'ゲーム＆ソーシャルプラットフォーム',
              },
              {
                items: [
                  { link: withBase('/ja/docs/contributing/design-guidelines/'), text: 'はじめに' },
                  {
                    link: withBase('/ja/docs/contributing/design-guidelines/resources'),
                    text: 'アーティストと開発者 (参考リソース)',
                  },
                  { link: withBase('/ja/docs/contributing/design-guidelines/tools'), text: 'ツール' },
                ],
                text: 'デザインガイドライン',
              },
            ],
            text: 'コントリビューション',
          },
          {
            icon: 'lucide:calendar-days',
            items: [
              {
                items: [{ link: withBase('/ja/docs/chronicles/integration-checklist'), text: '統合チェックリスト' }],
                text: '統合ステータス',
              },
              {
                items: [
                  { link: withBase('/ja/docs/chronicles/roadmap'), text: 'プロジェクトロードマップ' },
                  { link: withBase('/ja/docs/chronicles/feature-report'), text: '機能レポート' },
                ],
                text: 'プロジェクトの進化',
              },
              {
                items: [
                  { link: withBase('/ja/docs/chronicles/version-v0.1.0/'), text: '初公開 v0.1.0' },
                  { link: withBase('/ja/docs/chronicles/version-v0.0.1/'), text: '前日譚 v0.0.1' },
                ],
                text: 'バージョン履歴',
              },
            ],
            text: '年表',
          },
          {
            icon: 'lucide:scan-face',
            link: withBase('/ja/characters/'),
            text: 'キャラクター',
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
        sidebarMenuLabel: 'メニュー',
      },
    },
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        darkModeSwitchLabel: 'Appearance',
        docFooter: {
          next: 'Next page',
          prev: 'Previous page',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: 'Edit this page on GitHub',
        },
        langMenuLabel: 'Change language',
        lastUpdated: {
          text: 'Last updated',
        },
        logo: withBase('/favicon.svg'),
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { link: withBase('/en/docs/overview/'), text: 'Docs' },
          { link: withBase('/en/blog/'), text: 'Blog' },
          {
            items: [{ link: releases, text: 'Release Notes ' }],
            text: `v${version}`,
          },
          {
            items: [
              { link: withBase('/en/about/privacy'), text: 'Privacy Policy' },
              { link: withBase('/en/about/terms'), text: 'Terms of Use' },
            ],
            text: 'About',
          },
        ],
        outline: {
          label: 'On this page',
          level: 'deep',
        },
        returnToTopLabel: 'Return to top',

        sidebar: [
          {
            icon: 'lucide:rocket',
            items: [
              { link: withBase('/en/docs/overview/'), text: 'Introduction' },
              { link: withBase('/en/docs/overview/versions'), text: 'Versions & Downloads' },
              { link: withBase('/en/docs/overview/about-ai-vtuber'), text: 'About AI VTuber' },
              { link: withBase('/en/docs/overview/about-neuro-sama'), text: 'About Neuro-sama' },
              { link: withBase('/en/docs/overview/other-similar-projects'), text: 'Other Similar Projects' },
            ],
            text: 'Overview',
          },
          {
            icon: 'lucide:book-open',
            items: [
              {
                items: [
                  { link: withBase('/en/docs/manual/tamagotchi/'), text: 'Desktop Version' },
                  { link: withBase('/en/docs/manual/web/'), text: 'Web Version' },
                ],
                text: 'Quick Start',
              },
              {
                items: [{ link: withBase('/en/docs/manual/config/'), text: 'Configuration Guide' }],
                text: 'Configuration',
              },
              {
                items: [
                  {
                    link: withBase('/en/docs/contributing/architecture/arch-chat-stt-proactivity-pipelines'),
                    text: 'Interaction Pipelines',
                  },
                  {
                    link: withBase('/en/docs/contributing/architecture/arch-comfyui-native-api-engine'),
                    text: 'ComfyUI Native Engine',
                  },
                  {
                    link: withBase('/en/docs/contributing/architecture/arch-gateway-security-hardening'),
                    text: 'Gateway Security',
                  },
                  {
                    link: withBase('/en/docs/contributing/architecture/arch-memory-system-overview'),
                    text: 'Memory System',
                  },
                  {
                    link: withBase('/en/docs/contributing/architecture/arch-live2d-wasm-optimization'),
                    text: 'Live2D Optimization',
                  },
                ],
                text: 'Architecture & Design',
              },
            ],
            text: 'Manual',
          },
          {
            icon: 'lucide:users',
            items: [
              {
                items: [
                  { link: withBase('/en/docs/contributing/'), text: 'Environment Setup & Prerequisites' },
                  { link: withBase('/en/docs/contributing/tamagotchi'), text: 'Desktop App' },
                  { link: withBase('/en/docs/contributing/webui'), text: 'Web UI' },
                  { link: withBase('/en/docs/contributing/docs'), text: 'Documentation Site' },
                ],
                text: 'Basic Setup',
              },
              {
                items: [
                  { link: withBase('/en/docs/contributing/services/minecraft'), text: 'Minecraft' },
                  { link: withBase('/en/docs/contributing/services/satori'), text: 'Satori Bot' },
                  { link: withBase('/en/docs/contributing/services/telegram'), text: 'Telegram Bot' },
                  { link: withBase('/en/docs/contributing/services/discord'), text: 'Discord Bot' },
                ],
                text: 'Games & Social Platforms',
              },
              {
                items: [
                  { link: withBase('/en/docs/contributing/design-guidelines/'), text: 'Introduction' },
                  {
                    link: withBase('/en/docs/contributing/design-guidelines/resources'),
                    text: 'Artists & Developers (Resources)',
                  },
                  { link: withBase('/en/docs/contributing/design-guidelines/tools'), text: 'Tools' },
                ],
                text: 'Design Guidelines',
              },
            ],
            text: 'Contributing',
          },
          {
            icon: 'lucide:calendar-days',
            items: [
              {
                items: [{ link: withBase('/en/docs/chronicles/integration-checklist'), text: 'Integration Checklist' }],
                text: 'Maintainer Status',
              },
              {
                items: [
                  { link: withBase('/en/docs/chronicles/roadmap'), text: 'Project Roadmap' },
                  { link: withBase('/en/docs/chronicles/feature-report'), text: 'Feature Report' },
                ],
                text: 'Project Evolution',
              },
              {
                items: [
                  { link: withBase('/en/docs/chronicles/version-v0.1.0/'), text: 'Initial Publish v0.1.0' },
                  { link: withBase('/en/docs/chronicles/version-v0.0.1/'), text: 'Before Story v0.0.1' },
                ],
                text: 'Version History',
              },
            ],
            text: 'Chronicles',
          },
          {
            icon: 'lucide:scan-face',
            link: withBase('/en/characters/'),
            text: 'Characters',
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
        sidebarMenuLabel: 'Menu',
      },
    },
    'zh-Hans': {
      label: '简体中文',
      lang: 'zh-Hans',
      themeConfig: {
        darkModeSwitchLabel: '外观模式',
        docFooter: {
          next: '下一页',
          prev: '上一页',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: '在 GitHub 编辑此页',
        },
        langMenuLabel: '切换语言',
        lastUpdated: {
          text: '最后更新',
        },
        logo: withBase('/favicon.svg'),
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { link: withBase('/zh-Hans/docs/overview/'), text: '文档' },
          { link: withBase('/zh-Hans/blog/'), text: '博客 / 开发日志' },
          {
            items: [{ link: releases, text: '发布说明 ' }],
            text: `v${version}`,
          },
          {
            items: [
              { link: withBase('/zh-Hans/about/privacy'), text: '隐私政策' },
              { link: withBase('/zh-Hans/about/terms'), text: '使用条款' },
            ],
            text: '关于',
          },
        ],
        outline: {
          label: '本页内容',
          level: 'deep',
        },
        returnToTopLabel: '返回顶部',

        sidebar: [
          {
            icon: 'lucide:rocket',
            items: [
              { link: withBase('/zh-Hans/docs/overview/'), text: '这是什么项目？' },
              { link: withBase('/zh-Hans/docs/overview/versions'), text: '版本与下载' },
              { link: withBase('/zh-Hans/docs/overview/about-ai-vtuber'), text: '有关 AI VTuber' },
              { link: withBase('/zh-Hans/docs/overview/about-neuro-sama'), text: '有关 Neuro-sama' },
              { link: withBase('/zh-Hans/docs/overview/other-similar-projects'), text: '其他类似项目' },
            ],
            text: '概览',
          },
          {
            icon: 'lucide:book-open',
            items: [
              {
                items: [
                  { link: withBase('/zh-Hans/docs/manual/tamagotchi/'), text: '桌面版' },
                  { link: withBase('/zh-Hans/docs/manual/web/'), text: '网页版' },
                ],
                text: '快速开始',
              },
              {
                items: [{ link: withBase('/zh-Hans/docs/manual/config/'), text: '配置指南' }],
                text: '配置',
              },
              {
                items: [
                  {
                    link: withBase('/zh-Hans/docs/contributing/architecture/arch-chat-stt-proactivity-pipelines'),
                    text: '交互流水线',
                  },
                  {
                    link: withBase('/zh-Hans/docs/contributing/architecture/arch-comfyui-native-api-engine'),
                    text: 'ComfyUI 原生引擎',
                  },
                  {
                    link: withBase('/zh-Hans/docs/contributing/architecture/arch-gateway-security-hardening'),
                    text: '网关安全性',
                  },
                  {
                    link: withBase('/zh-Hans/docs/contributing/architecture/arch-memory-system-overview'),
                    text: '内存系统',
                  },
                  {
                    link: withBase('/zh-Hans/docs/contributing/architecture/arch-live2d-wasm-optimization'),
                    text: 'Live2D 优化',
                  },
                ],
                text: '架构与设计',
              },
            ],
            text: '用户手册',
          },
          {
            icon: 'lucide:users',
            items: [
              {
                items: [
                  { link: withBase('/zh-Hans/docs/contributing/'), text: '环境配置与基础准备' },
                  { link: withBase('/zh-Hans/docs/contributing/tamagotchi'), text: '桌面端' },
                  { link: withBase('/zh-Hans/docs/contributing/webui'), text: '网页端' },
                  { link: withBase('/zh-Hans/docs/contributing/docs'), text: '文档站' },
                ],
                text: '基础配置与开发',
              },
              {
                items: [
                  { link: withBase('/zh-Hans/docs/contributing/services/minecraft'), text: 'Minecraft' },
                  { link: withBase('/zh-Hans/docs/contributing/services/satori'), text: 'Satori Bot' },
                  { link: withBase('/zh-Hans/docs/contributing/services/telegram'), text: 'Telegram Bot' },
                  { link: withBase('/zh-Hans/docs/contributing/services/discord'), text: 'Discord Bot' },
                ],
                text: '游戏与社交平台',
              },
              {
                items: [
                  { link: withBase('/zh-Hans/docs/contributing/design-guidelines/'), text: '介绍' },
                  {
                    link: withBase('/zh-Hans/docs/contributing/design-guidelines/resources'),
                    text: '艺术家与开发者 (参考资源)',
                  },
                  { link: withBase('/zh-Hans/docs/contributing/design-guidelines/tools'), text: '工具' },
                ],
                text: '设计指南',
              },
            ],
            text: '贡献指南',
          },
          {
            icon: 'lucide:calendar-days',
            items: [
              {
                items: [{ link: withBase('/zh-Hans/docs/chronicles/integration-checklist'), text: '集成清单' }],
                text: '集成状态',
              },
              {
                items: [
                  { link: withBase('/zh-Hans/docs/chronicles/roadmap'), text: '项目路线图' },
                  { link: withBase('/zh-Hans/docs/chronicles/feature-report'), text: '功能报告' },
                ],
                text: '项目演进',
              },
              {
                items: [
                  { link: withBase('/zh-Hans/docs/chronicles/version-v0.1.0/'), text: '首次公开 v0.1.0' },
                  { link: withBase('/zh-Hans/docs/chronicles/version-v0.0.1/'), text: '先前的故事 v0.0.1' },
                ],
                text: '版本历史',
              },
            ],
            text: '编年史',
          },
          {
            icon: 'lucide:scan-face',
            link: withBase('/zh-Hans/characters/'),
            text: '角色',
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
        sidebarMenuLabel: '菜单',
      },
    },
  },
  markdown: {
    anchor: {
      callback(token) {
        // set tw `group` modifier to heading element
        token.attrSet('class', 'group relative border-none mb-4 lg:-ml-2 lg:pl-2 lg:pr-2')
      },
      permalink: anchor.permalink.linkInsideHeader({
        class: 'header-anchor [&_span]:focus:opacity-100 [&_span_>_span]:focus:outline',
        renderAttrs: (slug, state) => {
          // From: https://github.com/vuejs/vitepress/blob/256d742b733bfb62d54c78168b0e867b8eb829c9/src/node/markdown/markdown.ts#L263
          // Find `heading_open` with the id identical to slug
          const idx = state.tokens.findIndex((token) => {
            const attrs = token.attrs
            const id = attrs?.find((attr) => attr[0] === 'id')
            return id && slug === id[1]
          })
          // Get the actual heading content
          const title = state.tokens[idx + 1]!.content
          return {
            'aria-label': `Permalink to "${title}"`,
          }
        },
        symbol: `<span class="absolute top-0 -ml-8 hidden items-center border-0 opacity-0 group-hover:opacity-100 focus:opacity-100 lg:flex" style="transition: all 0.2s ease-in-out;">&ZeroWidthSpace;<span class="flex h-6 w-6 items-center justify-center rounded-md outline-2 outline-primary text-green-400 shadow-sm  hover:text-green-700 hover:shadow dark:bg-primary/20 dark:text-primary/80 dark:shadow-none dark:hover:bg-primary/40 dark:hover:text-primary"><svg width="12" height="12" fill="none" aria-hidden="true"><path d="M3.75 1v10M8.25 1v10M1 3.75h10M1 8.25h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></span></span>`,
      }),
    },
    config(md) {
      md.use(tasklist)
      md.use(footnote)
    },
    headers: {
      level: [2, 3, 4, 5, 6],
    },
    theme: {
      dark: 'catppuccin-mocha',
      light: 'catppuccin-latte',
    },
  },
  sitemap: {
    hostname: ogUrl,
  },
  srcDir: 'content',
  themeConfig: {
    editLink: {
      pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
    },

    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'x', link: x },
      { icon: 'discord', link: discord },
      { icon: 'github', link: github },
    ],
  },
  title: projectName,
  titleTemplate: projectShortName,
  transformPageData(pageData) {
    if (pageData.frontmatter.sidebar != null) return

    // hide sidebar on showcase page
    pageData.frontmatter.sidebar = pageData.frontmatter.layout !== 'showcase'
  },
  vite: {
    css: {
      postcss: {
        plugins: [postcssIsolateStyles({ includeFiles: [/vp-doc\.css/] })],
      },
    },
    plugins: [
      // Thanks https://github.com/intlify/vue-i18n/issues/1205#issuecomment-2707075660
      i18n({ compositionOnly: true, fullInstall: true, runtimeOnly: true, ssr: true }),
      unocss(),
      yaml(),
      frontmatterAssets(),
    ],
    resolve: {
      alias: {
        '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
        '@proj-airi/stage-ui/components': resolve(
          join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'components'),
        ),
      },
    },
  },
})
