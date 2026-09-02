import type { DefaultTheme } from 'vitepress'

import type { SharedSidebarItem } from '../shared-sidebar'

import { join, posix, resolve } from 'node:path'
import { env } from 'node:process'

import i18n from '@intlify/unplugin-vue-i18n/vite'
import anchor from 'markdown-it-anchor'
import unocss from 'unocss/vite'
import yaml from 'unplugin-yaml/vite'

import { footnote } from '@mdit/plugin-footnote'
import { tasklist } from '@mdit/plugin-tasklist'
import { defineConfig, postcssIsolateStyles } from 'vitepress'

import { version } from '../../package.json'
import { SHARED_SIDEBAR } from '../shared-sidebar'
import { teamMembers } from './contributors'
import {
  discord,
  github,
  ogImage,
  ogUrl,
  projectDescription,
  projectName,
  projectShortName,
  releases,
  x,
} from './meta'
import { frontmatterAssets } from './plugins/vite-frontmatter-assets'

function toVitepressItems(items: SharedSidebarItem[]): DefaultTheme.SidebarItem[] {
  return items.map(item => ({
    text: item.text,
    ...(item.link ? { link: withBase(`/en/docs/${item.link}`) } : {}),
    ...(item.items ? { items: toVitepressItems(item.items) } : {}),
  })) as DefaultTheme.SidebarItem[]
}

function withBase(url: string) {
  return env.BASE_URL
    ? env.BASE_URL.endsWith('/')
      ? posix.join(env.BASE_URL.replace(/\/$/, ''), url)
      : posix.join(env.BASE_URL, url)
    : url
}

function fallbackMediaPlugin() {
  return {
    name: 'vite-plugin-fallback-media',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (/\.(mp4|gif)$/i.test(id) || id.startsWith('/showcase/') || id.startsWith('/assets/tutorial-')) {
        return `\0virtual-media:${id}`
      }
      return null
    },
    load(id: string) {
      if (id.startsWith('\0virtual-media:')) {
        return `export default ""`
      }
      return null
    },
  }
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  cleanUrls: true,
  ignoreDeadLinks: true,
  title: projectName,
  description: projectDescription,
  titleTemplate: projectShortName,
  head: [
    ['meta', { name: 'theme-color', content: '#0b0d0f' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg', sizes: 'any' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: projectName }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'author', content: `${teamMembers.map(c => c.name).join(', ')} and ${projectName} contributors` }],
    ['meta', { name: 'keywords', content: '' }],
    ['meta', { property: 'og:title', content: projectName }],
    ['meta', { property: 'og:site_name', content: projectName }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:description', content: projectDescription }],
    ['meta', { property: 'og:url', content: ogUrl }],
    ['meta', { name: 'twitter:title', content: projectName }],
    ['meta', { name: 'twitter:description', content: projectDescription }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'mask-icon', href: '/logo.svg', color: '#ffffff' }],
    // Proxying Plausible through Netlify | Plausible docs
    // https://plausible.io/docs/proxy/guides/netlify
    ['script', { async: '', src: 'https://plausible.io/js/pa-HI8-_JIBI6d_2IgIr2Tai.js' }],
    ['script', {}, `
      window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
      plausible.init()
    `],
    ['script', {}, `
      ;(function () {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const setting = localStorage.getItem('vueuse-color-scheme') || 'auto'
        if (setting === 'light' || (prefersDark && setting !== 'dark')) {
          document.querySelector('#themeColor')?.setAttribute('content', 'rgb(255,255,255)')
        }
      })()
    `],
    // GitHub Pages SPA 404 fallback for stage-web
    ['script', {}, `
      ;(function () {
        var pathname = window.location.pathname;
        var stageIndex = pathname.indexOf('/web-stage');
        if (stageIndex !== -1) {
          var prefix = pathname.slice(0, stageIndex + '/web-stage'.length);
          var subPath = pathname.slice(stageIndex + '/web-stage'.length);
          if (!subPath || subPath === '') {
            window.location.replace(prefix + '/' + window.location.search + window.location.hash);
          } else if (subPath !== '/' && subPath !== '/index.html') {
            var target = prefix + '/?redirect=' + encodeURIComponent(subPath + window.location.search + window.location.hash);
            window.location.replace(target);
          }
        }
      })()
    `],
  ],
  base: env.BASE_URL || '/',
  vue: {
    template: {
      transformAssetUrls: {
        video: false,
        source: false,
        audio: false,
        ThemedVideo: false,
        ThemedImage: false,
      },
    },
  },
  lastUpdated: true,
  sitemap: {
    hostname: ogUrl,
  },
  locales: {
    'root': {
      label: 'English',
      lang: 'en',
      themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { text: 'Docs', link: withBase('/en/docs/overview/') },
          { text: 'Blog', link: withBase('/en/blog/') },
          {
            text: `v${version}`,
            items: [
              { text: 'Release Notes ', link: releases },
            ],
          },
          {
            text: 'About',
            items: [
              { text: 'Privacy Policy', link: withBase('/en/about/privacy') },
              { text: 'Terms of Use', link: withBase('/en/about/terms') },
            ],
          },
        ],
        outline: {
          level: 'deep',
          label: 'On this page',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: 'Edit this page on GitHub',
        },
        lastUpdated: {
          text: 'Last updated',
        },
        darkModeSwitchLabel: 'Appearance',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        logo: withBase('/favicon.svg'),

        sidebar: [
          ...SHARED_SIDEBAR.map(section => ({
            text: section.text,
            icon: section.icon,
            items: toVitepressItems(section.items),
          })),
          {
            text: 'Contributing',
            icon: 'lucide:users',
            items: [
              {
                text: 'Basic Setup',
                items: [
                  { text: 'Environment Setup & Prerequisites', link: withBase('/en/docs/contributing/') },
                  { text: 'Desktop App', link: withBase('/en/docs/contributing/tamagotchi') },
                  { text: 'Web UI', link: withBase('/en/docs/contributing/webui') },
                  { text: 'Documentation Site', link: withBase('/en/docs/contributing/docs') },
                ],
              },
              {
                text: 'Games & Social Platforms',
                items: [
                  { text: 'Minecraft', link: withBase('/en/docs/contributing/services/minecraft') },
                  { text: 'Satori Bot', link: withBase('/en/docs/contributing/services/satori') },
                  { text: 'Telegram Bot', link: withBase('/en/docs/contributing/services/telegram') },
                  { text: 'Discord Bot', link: withBase('/en/docs/contributing/services/discord') },
                ],
              },
              {
                text: 'Design Guidelines',
                items: [
                  { text: 'Introduction', link: withBase('/en/docs/contributing/design-guidelines/') },
                  { text: 'Artists & Developers (Resources)', link: withBase('/en/docs/contributing/design-guidelines/resources') },
                  { text: 'Tools', link: withBase('/en/docs/contributing/design-guidelines/tools') },
                ],
              },
            ],
          },
          {
            text: 'Characters',
            icon: 'lucide:scan-face',
            link: withBase('/en/characters/'),
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
      },
    },
    'zh-Hans': {
      label: '简体中文',
      lang: 'zh-Hans',
      themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { text: '文档', link: withBase('/zh-Hans/docs/overview/') },
          { text: '博客 / 开发日志', link: withBase('/zh-Hans/blog/') },
          {
            text: `v${version}`,
            items: [
              { text: '发布说明 ', link: releases },
            ],
          },
          {
            text: '关于',
            items: [
              { text: '隐私政策', link: withBase('/zh-Hans/about/privacy') },
              { text: '使用条款', link: withBase('/zh-Hans/about/terms') },
            ],
          },
        ],
        outline: {
          level: 'deep',
          label: '本页内容',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: '在 GitHub 编辑此页',
        },
        lastUpdated: {
          text: '最后更新',
        },
        darkModeSwitchLabel: '外观模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        logo: withBase('/favicon.svg'),

        sidebar: [
          {
            text: '概览',
            icon: 'lucide:rocket',
            items: [
              { text: '这是什么项目？', link: withBase('/zh-Hans/docs/overview/') },
              { text: '版本与下载', link: withBase('/zh-Hans/docs/overview/versions') },
              { text: '有关 AI VTuber', link: withBase('/zh-Hans/docs/overview/about-ai-vtuber') },
              { text: '有关 Neuro-sama', link: withBase('/zh-Hans/docs/overview/about-neuro-sama') },
              { text: '其他类似项目', link: withBase('/zh-Hans/docs/overview/other-similar-projects') },
            ],
          },
          {
            text: '用户手册',
            icon: 'lucide:book-open',
            items: [
              {
                text: '快速开始',
                items: [
                  { text: '桌面版', link: withBase('/zh-Hans/docs/manual/tamagotchi/') },
                  { text: '网页版', link: withBase('/zh-Hans/docs/manual/web/') },
                ],
              },
              {
                text: '配置',
                items: [
                  { text: '配置指南', link: withBase('/zh-Hans/docs/manual/config/') },
                ],
              },
              {
                text: '架构与设计',
                items: [
                  { text: '交互流水线', link: withBase('/zh-Hans/docs/contributing/architecture/arch-chat-stt-proactivity-pipelines') },
                  { text: 'ComfyUI 原生引擎', link: withBase('/zh-Hans/docs/contributing/architecture/arch-comfyui-native-api-engine') },
                  { text: '网关安全性', link: withBase('/zh-Hans/docs/contributing/architecture/arch-gateway-security-hardening') },
                  { text: '内存系统', link: withBase('/zh-Hans/docs/contributing/architecture/arch-memory-system-overview') },
                  { text: 'Live2D 优化', link: withBase('/zh-Hans/docs/contributing/architecture/arch-live2d-wasm-optimization') },
                ],
              },
            ],
          },
          {
            text: '贡献指南',
            icon: 'lucide:users',
            items: [
              {
                text: '基础配置与开发',
                items: [
                  { text: '环境配置与基础准备', link: withBase('/zh-Hans/docs/contributing/') },
                  { text: '桌面端', link: withBase('/zh-Hans/docs/contributing/tamagotchi') },
                  { text: '网页端', link: withBase('/zh-Hans/docs/contributing/webui') },
                  { text: '文档站', link: withBase('/zh-Hans/docs/contributing/docs') },
                ],
              },
              {
                text: '游戏与社交平台',
                items: [
                  { text: 'Minecraft', link: withBase('/zh-Hans/docs/contributing/services/minecraft') },
                  { text: 'Satori Bot', link: withBase('/zh-Hans/docs/contributing/services/satori') },
                  { text: 'Telegram Bot', link: withBase('/zh-Hans/docs/contributing/services/telegram') },
                  { text: 'Discord Bot', link: withBase('/zh-Hans/docs/contributing/services/discord') },
                ],
              },
              {
                text: '设计指南',
                items: [
                  { text: '介绍', link: withBase('/zh-Hans/docs/contributing/design-guidelines/') },
                  { text: '艺术家与开发者 (参考资源)', link: withBase('/zh-Hans/docs/contributing/design-guidelines/resources') },
                  { text: '工具', link: withBase('/zh-Hans/docs/contributing/design-guidelines/tools') },
                ],
              },
            ],
          },
          {
            text: '编年史',
            icon: 'lucide:calendar-days',
            items: [
              {
                text: '集成状态',
                items: [
                  { text: '集成清单', link: withBase('/zh-Hans/docs/chronicles/integration-checklist') },
                ],
              },
              {
                text: '项目演进',
                items: [
                  { text: '项目路线图', link: withBase('/zh-Hans/docs/chronicles/roadmap') },
                  { text: '功能报告', link: withBase('/zh-Hans/docs/chronicles/feature-report') },
                ],
              },
              {
                text: '版本历史',
                items: [
                  { text: '首次公开 v0.1.0', link: withBase('/zh-Hans/docs/chronicles/version-v0.1.0/') },
                  { text: '先前的故事 v0.0.1', link: withBase('/zh-Hans/docs/chronicles/version-v0.0.1/') },
                ],
              },
            ],
          },
          {
            text: '角色',
            icon: 'lucide:scan-face',
            link: withBase('/zh-Hans/characters/'),
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
      },
    },
    'ja': {
      label: '日本語',
      lang: 'ja',
      themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { text: 'ドキュメント', link: withBase('/ja/docs/overview/') },
          { text: 'ブログ', link: withBase('/ja/blog/') },
          {
            text: `v${version}`,
            items: [
              { text: 'リリースノート', link: releases },
            ],
          },
          {
            text: '概要',
            items: [
              { text: 'プライバシーポリシー', link: withBase('/ja/about/privacy') },
              { text: '利用規約', link: withBase('/ja/about/terms') },
            ],
          },
        ],
        outline: {
          level: 'deep',
          label: 'このページの内容',
        },
        docFooter: {
          prev: '前のページ',
          next: '次のページ',
        },
        editLink: {
          pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
          text: 'GitHub でこのページを編集',
        },
        lastUpdated: {
          text: '最終更新',
        },
        darkModeSwitchLabel: '外観モード',
        sidebarMenuLabel: 'メニュー',
        returnToTopLabel: 'トップに戻る',
        langMenuLabel: '言語を変更',
        logo: withBase('/favicon.svg'),

        sidebar: [
          {
            text: '概要',
            icon: 'lucide:rocket',
            items: [
              { text: 'はじめに', link: withBase('/ja/docs/overview/') },
              { text: 'バージョンとダウンロード', link: withBase('/ja/docs/overview/versions') },
              { text: 'AI VTuberについて', link: withBase('/ja/docs/overview/about-ai-vtuber') },
              { text: 'Neuro-samaについて', link: withBase('/ja/docs/overview/about-neuro-sama') },
              { text: 'その他の類似プロジェクト', link: withBase('/ja/docs/overview/other-similar-projects') },
            ],
          },
          {
            text: 'マニュアル',
            icon: 'lucide:book-open',
            items: [
              {
                text: 'クイックスタート',
                items: [
                  { text: 'デスクトップ版', link: withBase('/ja/docs/manual/tamagotchi/') },
                  { text: 'Web版', link: withBase('/ja/docs/manual/web/') },
                ],
              },
              {
                text: '設定',
                items: [
                  { text: '設定ガイド', link: withBase('/ja/docs/manual/config/') },
                ],
              },
              {
                text: 'アーキテクチャとデザイン',
                items: [
                  { text: 'インタラクションパイプライン', link: withBase('/ja/docs/contributing/architecture/arch-chat-stt-proactivity-pipelines') },
                  { text: 'ComfyUI ネイティブエンジン', link: withBase('/ja/docs/contributing/architecture/arch-comfyui-native-api-engine') },
                  { text: 'ゲートウェイのセキュリティ', link: withBase('/ja/docs/contributing/architecture/arch-gateway-security-hardening') },
                  { text: 'メモリシステム', link: withBase('/ja/docs/contributing/architecture/arch-memory-system-overview') },
                  { text: 'Live2D の最適化', link: withBase('/ja/docs/contributing/architecture/arch-live2d-wasm-optimization') },
                ],
              },
            ],
          },
          {
            text: 'コントリビューション',
            icon: 'lucide:users',
            items: [
              {
                text: '基本設定と開発',
                items: [
                  { text: '環境構築と事前準備', link: withBase('/ja/docs/contributing/') },
                  { text: 'デスクトップアプリ', link: withBase('/ja/docs/contributing/tamagotchi') },
                  { text: 'Web UI', link: withBase('/ja/docs/contributing/webui') },
                  { text: 'ドキュメントサイト', link: withBase('/ja/docs/contributing/docs') },
                ],
              },
              {
                text: 'ゲーム＆ソーシャルプラットフォーム',
                items: [
                  { text: 'Minecraft', link: withBase('/ja/docs/contributing/services/minecraft') },
                  { text: 'Satori Bot', link: withBase('/ja/docs/contributing/services/satori') },
                  { text: 'Telegram Bot', link: withBase('/ja/docs/contributing/services/telegram') },
                  { text: 'Discord Bot', link: withBase('/ja/docs/contributing/services/discord') },
                ],
              },
              {
                text: 'デザインガイドライン',
                items: [
                  { text: 'はじめに', link: withBase('/ja/docs/contributing/design-guidelines/') },
                  { text: 'アーティストと開発者 (参考リソース)', link: withBase('/ja/docs/contributing/design-guidelines/resources') },
                  { text: 'ツール', link: withBase('/ja/docs/contributing/design-guidelines/tools') },
                ],
              },
            ],
          },
          {
            text: '年表',
            icon: 'lucide:calendar-days',
            items: [
              {
                text: '統合ステータス',
                items: [
                  { text: '統合チェックリスト', link: withBase('/ja/docs/chronicles/integration-checklist') },
                ],
              },
              {
                text: 'プロジェクトの進化',
                items: [
                  { text: 'プロジェクトロードマップ', link: withBase('/ja/docs/chronicles/roadmap') },
                  { text: '機能レポート', link: withBase('/ja/docs/chronicles/feature-report') },
                ],
              },
              {
                text: 'バージョン履歴',
                items: [
                  { text: '初公開 v0.1.0', link: withBase('/ja/docs/chronicles/version-v0.1.0/') },
                  { text: '前日譚 v0.0.1', link: withBase('/ja/docs/chronicles/version-v0.0.1/') },
                ],
              },
            ],
          },
          {
            text: 'キャラクター',
            icon: 'lucide:scan-face',
            link: withBase('/ja/characters/'),
          },
        ] as (DefaultTheme.SidebarItem & { icon?: string })[],
      },
    },
  },
  themeConfig: {
    socialLinks: [
      { icon: 'x', link: x },
      { icon: 'discord', link: discord },
      { icon: 'github', link: github },
    ],

    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/moeru-ai/airi/edit/main/docs/content/:path',
    },
  },
  srcDir: 'content',
  appearance: 'dark',
  markdown: {
    theme: {
      light: 'catppuccin-latte',
      dark: 'catppuccin-mocha',
    },
    headers: {
      level: [2, 3, 4, 5, 6],
    },
    config(md) {
      md.use(tasklist)
      md.use(footnote)
    },
    anchor: {
      callback(token) {
        // set tw `group` modifier to heading element
        token.attrSet(
          'class',
          'group relative border-none mb-4 lg:-ml-2 lg:pl-2 lg:pr-2',
        )
      },
      permalink: anchor.permalink.linkInsideHeader({
        class:
          'header-anchor [&_span]:focus:opacity-100 [&_span_>_span]:focus:outline',
        symbol: `<span class="absolute top-0 -ml-8 hidden items-center border-0 opacity-0 group-hover:opacity-100 focus:opacity-100 lg:flex" style="transition: all 0.2s ease-in-out;">&ZeroWidthSpace;<span class="flex h-6 w-6 items-center justify-center rounded-md outline-2 outline-primary text-green-400 shadow-sm  hover:text-green-700 hover:shadow dark:bg-primary/20 dark:text-primary/80 dark:shadow-none dark:hover:bg-primary/40 dark:hover:text-primary"><svg width="12" height="12" fill="none" aria-hidden="true"><path d="M3.75 1v10M8.25 1v10M1 3.75h10M1 8.25h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></span></span>`,
        renderAttrs: (slug, state) => {
          // From: https://github.com/vuejs/vitepress/blob/256d742b733bfb62d54c78168b0e867b8eb829c9/src/node/markdown/markdown.ts#L263
          // Find `heading_open` with the id identical to slug
          const idx = state.tokens.findIndex((token) => {
            const attrs = token.attrs
            const id = attrs?.find(attr => attr[0] === 'id')
            return id && slug === id[1]
          })
          // Get the actual heading content
          const title = state.tokens[idx + 1]!.content
          return {
            'aria-label': `Permalink to "${title}"`,
          }
        },
      }),
    },
  },
  transformPageData(pageData) {
    if (pageData.frontmatter.sidebar != null)
      return

    // hide sidebar on showcase page
    pageData.frontmatter.sidebar = pageData.frontmatter.layout !== 'showcase'
  },
  vite: {
    resolve: {
      alias: {
        '@proj-airi/stage-ui/components': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'components')),
        '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
      },
    },
    plugins: [
      // Thanks https://github.com/intlify/vue-i18n/issues/1205#issuecomment-2707075660
      i18n({ runtimeOnly: true, compositionOnly: true, fullInstall: true, ssr: true }),
      unocss(),
      yaml(),
      fallbackMediaPlugin(),
      frontmatterAssets(),
    ],
    css: {
      postcss: {
        plugins: [
          postcssIsolateStyles({ includeFiles: [/vp-doc\.css/] }),
        ],
      },
    },
  },
})
