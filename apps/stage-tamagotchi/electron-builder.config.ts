/* eslint-disable no-template-curly-in-string */

import type { Configuration } from 'electron-builder'

import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { isMacOS } from 'std-env'

const here = path.dirname(fileURLToPath(import.meta.url))
const stageMateBinDir = path.resolve(here, '../stage-mate/bin')

const stageMateMacCandidates = [
  path.join(stageMateBinDir, 'StageMate.app'),
  path.join(stageMateBinDir, 'StageMate', 'StageMate.app'),
]
const stageMateMacSource = stageMateMacCandidates.find(appPath => fs.existsSync(appPath))
const hasStageMateMac = Boolean(stageMateMacSource)

const stageMateWinCandidates = [
  path.join(stageMateBinDir, 'Windows'),
  path.join(stageMateBinDir, 'StageMate'),
  stageMateBinDir,
]
const stageMateWinSource = stageMateWinCandidates.find(dir => fs.existsSync(path.join(dir, 'StageMate.exe')) || fs.existsSync(path.join(dir, 'MateEngineX.exe')))
const hasStageMateWin = Boolean(stageMateWinSource)

// Each target platform keeps only the matching `${arch}` native directory.
const nativeAddonFilePatterns = {
  darwin: [
    '!**/node_modules/uiohook-napi/prebuilds/!(darwin-${arch}){,/**}',
    '!**/node_modules/electron-click-drag-plugin/build/Release/!(darwin-${arch}){,/**}',
    '!**/node_modules/koffi/build/koffi/!(darwin_${arch}){,/**}',
  ],
  linux: [
    // uiohook-napi ships an x86-64 binary in its Linux ARM64 directory.
    '!**/node_modules/uiohook-napi/prebuilds/!(linux-${arch}){,/**}',
    '!**/node_modules/uiohook-napi/prebuilds/linux-arm64{,/**}',
    // Linux does not use electron-click-drag-plugin.
    '!**/node_modules/electron-click-drag-plugin{,/**}',
    '!**/node_modules/koffi/build/koffi/!(linux_${arch}){,/**}',
  ],
  win32: [
    '!**/node_modules/uiohook-napi/prebuilds/!(win32-${arch}){,/**}',
    '!**/node_modules/electron-click-drag-plugin/build/Release/!(win32-${arch}){,/**}',
    '!**/node_modules/koffi/build/koffi/!(win32_${arch}){,/**}',
  ],
} as const

console.info(`[electron-builder/config] Stage-Mate macOS App found: ${hasStageMateMac} (${stageMateMacSource})`)
console.info(`[electron-builder/config] Stage-Mate Windows binary found: ${hasStageMateWin} (${stageMateWinSource})`)

function hasXcode26OrAbove() {
  if (!isMacOS)
    return false
  try {
    const output = execSync('xcodebuild -version')
      .toString()
      .match(/Xcode (\d+)/)
    if (!output)
      return false
    return Number.parseInt(output[1], 10) >= 26
  }
  catch {
    return false
  }
}

/**
 * Determine whether to use the .icon format for the macOS app icon based on the
 * Xcode version while building.
 * This is friendly to developers whose macOS and/or Xcode versions are below 26.
 */
const useIconFormattedMacAppIcon = hasXcode26OrAbove()
if (!useIconFormattedMacAppIcon) {
  console.warn('[electron-builder/config] Warning: Xcode version is below 26. Using .icns format for macOS app icon.')
}
else {
  console.info('[electron-builder/config] Xcode version is 26 or above. Using .icon format for macOS app icon.')
}

const isReleaseSigning = Boolean(process.env.CSC_LINK || process.env.APPLE_DEVELOPER_TEAM_ID)

const STAGE_MATE_RESOURCE_FILTERS = [
  '**/*',
  '!StageMate.app/**/*',
  '!*.app/**/*',
  '!__MACOSX/**/*',
  '!**/.DS_Store',
  '!Build/**/*',
  '!*.log',
  '!*.dmp',
  '!*.vrm',
  '!*.me',
  '!*.prefab',
  '!test_run.log',
  '!*_BurstDebugInformation_DoNotShip/**/*',
  '!**/CustomAvatars/**/*',
  '!**/CustomDances/**/*',
  '!**/Mods/**/*',
]

export default {
  appId: 'ai.moeru.airi.dasilva333',
  productName: 'AIRI (dasilva333)',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  afterPack: async (context) => {
    const { execSync } = require('node:child_process')
    const { existsSync } = require('node:fs')
    const { join } = require('node:path')
    console.log(`  • cleaning detritus for codesign: xattr -cr ${context.appOutDir}`)
    try {
      execSync(`xattr -cr "${context.appOutDir}"`)
      execSync(`find "${context.appOutDir}" -name ".DS_Store" -delete`)

      // Deep-sign nested StageMate helper apps and frameworks so electron-builder signs successfully
      const candidates = [
        join(context.appOutDir, 'airi.app/Contents/Resources/StageMate/StageMate.app'),
        join(context.appOutDir, 'AIRI.app/Contents/Resources/StageMate/StageMate.app'),
        join(context.appOutDir, 'AIRI (dasilva333).app/Contents/Resources/StageMate/StageMate.app'),
      ]
      for (const cand of candidates) {
        if (existsSync(cand)) {
          execSync(`rm -rf "${cand}/Build"`)
          execSync(`xattr -cr "${cand}"`)
          console.log(`  • deep signing nested StageMate bundle: ${cand}`)
          execSync(`codesign --sign - --force --deep "${cand}"`)
        }
      }
    }
    catch (e) {
      console.warn(`  • warning: metadata cleanup failed: ${e.message}`)
    }
  },
  // // For self-publishing, testing, and distribution after modified the code without access to
  // // an Apple Developer account, comment and uncomment the following lines.
  // // Later on when you obtained one, you can set up the necessary certificates and provisioning
  // // profiles to enable these security features.
  // //
  // // https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app
  // // https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
  // afterSign: async (context) => {
  //   const { electronPlatformName, appOutDir } = context
  //   if (electronPlatformName !== 'darwin')
  //     return
  //   if (env.CI !== 'true') {
  //     console.warn('Skipping notarizing step. Packaging is not running in CI')
  //     return
  //   }
  //
  //   const appName = context.packager.appInfo.productFilename
  //   await notarize({
  //     appPath: `${appOutDir}/${appName}.app`,
  //     teamId: env.APPLE_DEVELOPER_TEAM_ID!,
  //     appleId: env.APPLE_DEVELOPER_APPLE_ID!,
  //     appleIdPassword: env.APPLE_DEVELOPER_APPLE_APP_SPECIFIC_PASSWORD!,
  //   })
  // },
  files: [
    'out/**',
    'resources/**',
    'package.json',
    '!**/.vscode/*',
    '!src/**/*',
    '!**/node_modules/**/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/**/{.turbo,test,src,__tests__,tests,example,examples}',
    // The renderer uses the browser ONNX backend. The node package and its
    // platform binaries are not loaded by the packaged renderer.
    '!**/node_modules/onnxruntime-node{,/**}',
    // Vite bundles the browser runtime and its WASM assets into `out/renderer`.
    '!**/node_modules/onnxruntime-web{,/**}',
    // Workspace hoisting exposes build tools to electron-builder's file walk.
    // The packaged app has no runtime import of these tools.
    '!**/node_modules/@rolldown{,/**}',
    '!**/node_modules/rolldown{,/**}',
    '!**/node_modules/lightningcss{,/**}',
    '!**/node_modules/lightningcss-*{,/**}',
    '!**/node_modules/fsevents{,/**}',
    // Transformers runs inside browser workers in the desktop app. Sharp is its
    // Node-only image backend and has no packaged main-process consumer.
    '!**/node_modules/sharp{,/**}',
    '!**/node_modules/@img{,/**}',
    '!**/node_modules/node-liblzma{,/**}',
    '!**/node_modules/@mongodb-js{,/**}',
    // uiohook-napi loads the selected prebuild. Its bundled libuiohook C source is
    // only used to build that binary and does not participate in runtime loading.
    '!**/node_modules/uiohook-napi/libuiohook{,/**}',
    // `node_modules/electron/dist/Electron.app` makes electron-builder deep-sign it and
    // fails on non-code resources (for example `locale.pak`) with timestamp/signing errors.
    '!**/node_modules/electron{,/**}',
    // Vite bundles browser-only libraries into `out/renderer`. The main process has no runtime import.
    '!**/node_modules/@huggingface{,/**}',
    '!**/node_modules/three{,/**}',
    // Koffi C++ source tree and docs are compile/dev assets only.
    '!**/node_modules/koffi/src{,/**}',
    '!**/node_modules/koffi/doc{,/**}',
    '**/node_modules/**/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!vite.config.{js,ts,mjs,cjs}',
    '!uno.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.ts,.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!{tsconfig.json}',
  ],
  asar: true,
  asarUnpack: [
    '**/*.node',
  ],
  extraMetadata: {
    name: 'ai.moeru.airi.dasilva333',
    main: 'out/main/index.js',
    homepage: 'https://airi.moeru.ai/docs/',
    repository: 'https://github.com/dasilva333/airi',
    license: 'MIT',
  },
  win: {
    files: nativeAddonFilePatterns.win32,
    executableName: 'airi-dasilva333',
    target: [
      'nsis',
    ],
    extraResources: (hasStageMateWin && stageMateWinSource
      ? [
          {
            from: stageMateWinSource,
            to: 'StageMate',
            filter: STAGE_MATE_RESOURCE_FILTERS,
          },
        ]
      : []),
  },
  nsis: {
    artifactName: 'airi-dasilva333-${version}-windows-${arch}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
    deleteAppDataOnUninstall: false,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
    files: nativeAddonFilePatterns.darwin,
    artifactName: 'airi-dasilva333-${version}-${arch}-mac.${ext}',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: [
      {
        NSMicrophoneUsageDescription: 'AIRI requires microphone access for voice interaction',
      },
      {
        NSCameraUsageDescription: 'AIRI requires camera access for vision understanding',
      },
    ],
    // For self-publishing, testing, and distribution after modified the code without access to
    // an Apple Developer account, comment and uncomment the following 4 lines.
    // Later on when you obtained one, you can set up the necessary certificates and provisioning
    // profiles to enable these security features.
    hardenedRuntime: isReleaseSigning,
    notarize: isReleaseSigning,
    icon: useIconFormattedMacAppIcon ? 'icon.icon' : 'icon.icns',
    extraResources: (hasStageMateMac
      ? [
          {
            from: stageMateMacSource,
            to: 'StageMate/StageMate.app',
            filter: STAGE_MATE_RESOURCE_FILTERS,
          },
        ]
      : []),
  },
  dmg: {
    artifactName: 'airi-dasilva333-${version}-darwin-${arch}.${ext}',
  },
  linux: {
    files: nativeAddonFilePatterns.linux,
    target: [
      'deb',
      'rpm',
    ],
    category: 'Utility',
    synopsis: 'AIRI (dasilva333 fork) - AI VTuber/Waifu chatbot',
    description: 'AIRI (dasilva333 fork) is an AI VTuber/Waifu chatbot supporting Live2D/VRM avatars, featuring human-like interactions and modular stage-based rendering.',
    executableName: 'airi-dasilva333',
    artifactName: 'airi-dasilva333-${version}-linux-${arch}.${ext}',
    icon: 'build/icons/icon.png',
  },
  appImage: {
    artifactName: 'airi-dasilva333-${version}-linux-${arch}.${ext}',
  },
  npmRebuild: false,
  publish: {
    provider: 'github',
    owner: 'dasilva333',
    repo: 'airi',
  },
} satisfies Configuration
