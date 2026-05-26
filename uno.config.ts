import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { createExternalPackageIconLoader } from '@iconify/utils/lib/loader/external-pkg'
import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import { colorToString } from '@unocss/preset-mini/utils'
import type { WebFontMeta } from '@unocss/preset-web-fonts'
import type { Preset, PresetOrFactoryAwaitable } from 'unocss'
import {
  defineConfig,
  mergeConfigs,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { parseColor } from 'unocss/preset-mini'
import { presetScrollbar } from 'unocss-preset-scrollbar'

// On Netlify, building will result in when fetching metadata and fonts from @unocss/preset-web-fonts plugin:
//
// [cause]: AggregateError [ETIMEDOUT]:
//    at internalConnectMultiple (node:net:1134:18)
//  code: 'ETIMEDOUT',
//  [errors]: [
//    Error: connect ETIMEDOUT 146.75.77.229:443 ...
//    Error: connect ENETUNREACH 2a04:4e42:83::485:443 - Local (:::0) ...
//  ]
//
// This is same for either Google Fonts or Fontsource as provider. But GitHub Actions and local development works fine.
// My assumption is that the default timeout for auto-selecting family is too short (250ms)[^1] for the implementation
// of the Happy Eyeballs algorithm in Node.js, which is used by the `net` module to connect to the server, workflows
// illustrates like this:
//
// lookupAndConnect > autoSelectFamilyAttemptTimeout > lookupAndConnectMultiple > internalConnectMultiple > defaultTriggerAsyncIdScope
//
// Such mechanism will be used when the `net` module attempts to connect to a server using both IPv4 and IPv6 addresses,
// which is the case for Netlify builder.
//
// In order to fix this issue, we can increase the timeout to 1000ms (1 second) so that the algorithm has more time to
// attempt to connect to the server before timing out.
//
// [^1]: https://github.com/nodejs/node/pull/44731/files#diff-d76469e9e7f555294a7a5488c5c8fc4ef8ce5aea448cc26a1322d1ab693e09caR921
setDefaultAutoSelectFamilyAttemptTimeout(1000)

export function presetStoryMockHover(): PresetOrFactoryAwaitable {
  return {
    name: 'story-mock-hover',
    variants: [
      (matcher) => {
        if (!matcher.includes('hover')) {
          return matcher
        }

        return {
          matcher,
          selector: (s) => {
            return `${s}, ${s.replace(/:hover$/, '')}._hover`
          },
        }
      },
    ],
  }
}

export function safelistAllPrimaryBackgrounds(): string[] {
  return [undefined, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].flatMap((shade) => {
    const prefix = shade ? `bg-primary-${shade}` : `bg-primary`
    return [prefix, ...[5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((opacity) => `${prefix}/${opacity}`)]
  })
}

export function presetWebFontsFonts(
  provider: 'fontsource' | 'none',
): Record<string, string | WebFontMeta | (string | WebFontMeta)[]> {
  return {
    comfortaa: {
      name: provider === 'fontsource' ? 'Comfortaa' : 'Comfortaa Variable',
      provider,
    },
    cuteen: {
      name: 'Sniglet',
      provider,
    },
    cutejp: {
      name: 'Kiwi Maru',
      provider,
      subsets: ['latin', 'japanese'],
    },
    gugi: {
      name: 'Gugi',
      provider,
    },
    jura: {
      name: provider === 'fontsource' ? 'Jura' : 'Jura Variable',
      provider,
    },
    'm-plus-rounded': {
      name: 'M PLUS Rounded 1c',
      provider,
    },
    mono: {
      name: 'DM Mono',
      provider,
    },
    quanlai: {
      name: 'cjkfonts AllSeto',
      provider: 'none',
    },
    quicksand: {
      name: provider === 'fontsource' ? 'Quicksand' : 'Quicksand Variable',
      provider,
    },
    sans: {
      name: provider === 'fontsource' ? 'DM Sans' : 'DM Sans Variable',
      provider,
    },
    serif: {
      name: 'DM Serif Display',
      provider,
    },
    urbanist: {
      name: provider === 'fontsource' ? 'Urbanist' : 'Urbanist Variable',
      provider,
    },
    xiaolai: {
      name: 'Xiaolai SC',
      provider: 'none',
    },
  }
}

export function sharedUnoConfig() {
  return defineConfig({
    content: {
      pipeline: {
        exclude: [
          /\/node_modules\//, // DO NOT SCAN THE BLACK HOLE
        ],
        include: [
          // the default
          /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
          // include js/ts files
          '(components|src)/**/*.{js,ts,vue}', // THIS CAN INCLUDE node_modules
          'packages/**/*.{js,ts,vue}', // ADDED: include shared package pages and components
          '**/stage-ui/**/*.{vue,js,ts}', // THIS TOO
          '**/ui/**/*.{vue,js,ts}', // THIS TOO
        ],
      },
    },
    presets: [
      presetWind3(),
      presetAttributify(),
      presetTypography(),
      presetIcons({
        collections: {
          ...createExternalPackageIconLoader('@proj-airi/lobe-icons'),
          ...createExternalPackageIconLoader('@proj-airi/iconify-meteocons'),
          ...createExternalPackageIconLoader('@iconify-json/solar'),
          ...createExternalPackageIconLoader('@iconify-json/carbon'),
          ...createExternalPackageIconLoader('@iconify-json/lucide'),
          ...createExternalPackageIconLoader('@iconify-json/logos'),
          ...createExternalPackageIconLoader('@iconify-json/tabler'),
          ...createExternalPackageIconLoader('@iconify-json/ph'),
          ...createExternalPackageIconLoader('@iconify-json/simple-icons'),
          ...createExternalPackageIconLoader('@iconify-json/svg-spinners'),
          ...createExternalPackageIconLoader('@iconify-json/vscode-icons'),
          ...createExternalPackageIconLoader('@iconify-json/eos-icons'),
          ...createExternalPackageIconLoader('@iconify-json/mingcute'),
          ...createExternalPackageIconLoader('@iconify-json/twemoji'),
        },
        scale: 1.2,
      }),
      presetScrollbar(),
      presetChromatic({
        baseHue: 220.44,
        colors: {
          complementary: 180,
          primary: 0,
        },
      }) as Preset,
    ],
    rules: [
      [/^mask-\[(.*)\]$/, ([, suffix]) => ({ '-webkit-mask-image': suffix.replace(/_/g, ' ') })],
      [
        /^bg-dotted-\[(.*)\]$/,
        ([, color], { theme }) => {
          const parsedColor = parseColor(color, theme)
          // Util usage: https://github.com/unocss/unocss/blob/f57ef6ae50006a92f444738e50f3601c0d1121f2/packages-presets/preset-mini/src/_utils/utilities.ts#L186
          return {
            '--un-background-opacity': parsedColor?.cssColor?.alpha ?? parsedColor?.alpha ?? 1,
            'background-image': `radial-gradient(circle at 1px 1px, ${colorToString(parsedColor?.cssColor ?? parsedColor?.color ?? color, 'var(--un-background-opacity)')} 1px, transparent 0)`,
          }
        },
      ],
      [/drag-region/, () => ({ 'app-region': 'drag' })],
    ],
    safelist: [...'prose prose-sm m-auto text-left'.split(' '), ...safelistAllPrimaryBackgrounds()],
    // hyoban/unocss-preset-shadcn: Use shadcn ui with UnoCSS
    // https://github.com/hyoban/unocss-preset-shadcn
    //
    // Thanks to
    // https://github.com/unovue/shadcn-vue/issues/34#issuecomment-2467318118
    // https://github.com/hyoban-template/shadcn-vue-unocss-starter
    //
    // By default, `.ts` and `.js` files are NOT extracted.
    // If you want to extract them, use the following configuration.
    // It's necessary to add the following configuration if you use shadcn-vue or shadcn-svelte.
    shortcuts: [
      {
        'backface-hidden': '[backface-visibility:hidden]',
        'perspective-1000': '[perspective:1000px]',
        'preserve-3d': '[transform-style:preserve-3d]',
        'rotate-y-180': '[transform:rotateY(180deg)]',
      },
    ],
    theme: {
      /**
       * https://github.com/unocss/unocss/blob/1031312057a3bea1082b7d938eb2ad640f57613a/packages-presets/preset-wind4/src/theme/animate.ts
       * https://unocss.dev/presets/wind4#transformdirectives
       */
      animation: {
        durations: {
          cameraFlash: '400ms',
          contentHide: '150ms',
          contentShow: '150ms',
          fadeIn: '200ms',
          fadeOut: '200ms',
          overlayHide: '300ms',
          overlayShow: '300ms',
          slideDownAndFade: '400ms',
          slideLeftAndFade: '400ms',
          slideRightAndFade: '400ms',
          slideUpAndFade: '400ms',
        },
        keyframes: {
          cameraFlash:
            '{0%{opacity:0; background-color:white;}10%{opacity:1; background-color:white;}100%{opacity:0; background-color:white;}}',
          contentHide:
            '{from:{opacity:1;transform:translate(-50%,-50%) scale(1);}to:{opacity:0;transform:translate(-50%,-48%) scale(0.96);}}',
          contentShow:
            '{from:{opacity:0;transform:translate(-50%,-48%) scale(0.96);}to:{opacity:1;transform:translate(-50%,-50%) scale(1);}}',
          fadeIn: '{from{opacity:0;}to{opacity:1;}}',
          fadeOut: '{from{opacity:1;}to{opacity:0;}}',
          overlayHide: '{from{opacity:1;}to{opacity:0;}}',
          overlayShow: '{from{opacity:0;}to{opacity:1;}}',
          slideDownAndFade: '{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}',
          slideLeftAndFade: '{from{opacity:0;transform:translateX(2px)}to{opacity:1;transform:translateX(0)}}',
          slideRightAndFade: '{from{opacity:0;transform:translateX(-2px)}to{opacity:1;transform:translateX(0)}}',
          slideUpAndFade: '{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}',
        },
        timingFns: {
          cameraFlash: 'ease-out',
          contentHide: 'cubic-bezier(0.16, 1, 0.3, 1)',
          contentShow: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fadeIn: 'ease-in-out',
          fadeOut: 'ease-in-out',
          overlayHide: 'cubic-bezier(0.16, 1, 0.3, 1)',
          overlayShow: 'cubic-bezier(0.16, 1, 0.3, 1)',
          slideDownAndFade: 'cubic-bezier(0.16, 1, 0.3, 1)',
          slideLeftAndFade: 'cubic-bezier(0.16, 1, 0.3, 1)',
          slideRightAndFade: 'cubic-bezier(0.16, 1, 0.3, 1)',
          slideUpAndFade: 'cubic-bezier(0.16, 1, 0.3, 1)',
        },
      },
      fontFamily: {
        cute: `"Sniglet", "Kiwi Maru", "Comfortaa Variable", "Comfortaa", "xiaolai", "DM Sans Variant", "DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";`,
        cuteen: `"Sniglet", "Kiwi Maru", "Comfortaa Variable", "Comfortaa", "xiaolai", "DM Sans Variant", "DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";`,
        cutejp: `"Sniglet", "Kiwi Maru", "Comfortaa Variable", "Comfortaa", "xiaolai", "DM Sans Variant", "DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";`,
        sans: `"DM Sans Variant", "DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";`,
        'sans-rounded': `"Comfortaa Variable", "Comfortaa", "DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";`,
      },
    },
    transformers: [
      transformerDirectives({
        applyVariable: ['--at-apply'],
      }),
      transformerVariantGroup(),
    ],
  })
}

export function histoireUnoConfig() {
  return defineConfig({
    presets: [presetStoryMockHover()],
  })
}

export default mergeConfigs([sharedUnoConfig(), histoireUnoConfig()])
