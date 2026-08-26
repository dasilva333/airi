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
  appId: 'ai.moeru.airi',
  productName: 'AIRI',
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
    name: 'ai.moeru.airi',
    main: 'out/main/index.js',
    homepage: 'https://airi.moeru.ai/docs/',
    repository: 'https://github.com/moeru-ai/airi',
    license: 'MIT',
  },
  win: {
    executableName: 'airi',
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
    artifactName: '${productName}-${version}-windows-${arch}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
    deleteAppDataOnUninstall: true,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
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
    artifactName: '${productName}-${version}-darwin-${arch}.${ext}',
  },
  linux: {
    target: [
      'deb',
      'rpm',
    ],
    category: 'Utility',
    synopsis: 'AI VTuber/Waifu chatbot app inspired by Neuro-sama.',
    description: 'AIRI is an AI VTuber/Waifu chatbot supporting Live2D/VRM avatars, featuring human-like interactions and modular stage-based rendering.',
    executableName: 'airi',
    artifactName: '${productName}-${version}-linux-${arch}.${ext}',
    icon: 'build/icons/icon.png',
  },
  appImage: {
    artifactName: '${productName}-${version}-linux-${arch}.${ext}',
  },
  npmRebuild: true,
  publish: {
    provider: 'github',
    owner: 'moeru-ai',
    repo: 'airi',
  },
} satisfies Configuration
