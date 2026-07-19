# Web 用户界面中文化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让简体中文环境下主要 Web 用户路径不再回退或写死为英文，并建立静态翻译键完整性检查。

**Architecture:** 继续使用现有 Vue I18n 和 `packages/i18n` YAML 语言包。先用源码契约测试收集生产代码中的静态 `t()` 键并校验简体中文覆盖，再按用户可见程度迁移硬编码文案；品牌、模型、协议和精确配置键通过明确白名单保留原文。

**Tech Stack:** Vue 3、TypeScript、Vue I18n、YAML、Vitest、Vite、pnpm 10.32.1、Node.js 24.13.0

---

## 文件结构

- `packages/stage-layouts/src/localization/web-localization.test.ts`：跨 Web 生产源码检查静态 i18n 键、插值变量和已确认的硬编码英文。
- `packages/stage-layouts/package.json`：为上述测试声明 `yaml` 开发依赖。
- `packages/i18n/src/locales/en/settings.yaml`、`packages/i18n/src/locales/en/stage.yaml`：新增从组件迁出的英文源文案。
- `packages/i18n/src/locales/zh-Hans/settings.yaml`、`packages/i18n/src/locales/zh-Hans/stage.yaml`：补齐中文键并翻译用户可见内容。
- `packages/stage-pages/src/pages/settings/**`：迁移设置页、角色卡和向导中的硬编码文案。
- `packages/stage-ui/src/components/scenarios/settings/**`：迁移模型设置中的硬编码文案。
- `packages/stage-ui/src/components/scenarios/chat/**`、`packages/stage-ui/src/components/scenarios/dialogs/onboarding/**`：迁移聊天弹窗和首次引导文案。
- `packages/stage-layouts/src/components/**`：迁移桌面和移动聊天布局中的英文提示。
- `apps/stage-web/src/pages/auth/login.vue`、`apps/stage-web/src/pages/settings/characters/**`：处理仍可访问的登录和角色管理界面。
- `docs/superpowers/README.md`：维护计划链接、状态和最终实现依据。

## 统一命令前缀

以下命令均在 `D:\Tools\airi` 执行，并使用项目专用 Corepack：

```powershell
$corepack = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\corepack.cmd'
```

### Task 1: 建立 Web 中文键完整性保护并补齐现有缺键

**Files:**
- Create: `packages/stage-layouts/src/localization/web-localization.test.ts`
- Modify: `packages/stage-layouts/package.json`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/stage.yaml`

- [ ] **Step 1: 声明 YAML 测试依赖**

在 `packages/stage-layouts/package.json` 的 `devDependencies` 中加入：

```json
"yaml": "catalog:"
```

- [ ] **Step 2: 写入静态键覆盖失败测试**

创建 `packages/stage-layouts/src/localization/web-localization.test.ts`：

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workspaceRoot = resolve(import.meta.dirname, '../../../..')
const sourceRoots = [
  'apps/stage-web/src',
  'apps/ui-server-auth/src',
  'packages/stage-pages/src',
  'packages/stage-layouts/src',
  'packages/stage-ui/src',
]

const excludedPath = /[\\/]devtools[\\/]|[\\/]dist[\\/]|[\\/]stories[\\/]|\.test\.ts$|\.story\.vue$/

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (excludedPath.test(path))
      return []
    if (entry.isDirectory())
      return listSourceFiles(path)
    return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [path] : []
  })
}

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, output)
  }
  else {
    output[prefix] = value
  }
  return output
}

function loadWebMessages(locale: 'en' | 'zh-Hans') {
  const localeRoot = resolve(workspaceRoot, 'packages/i18n/src/locales', locale)
  return flatten({
    base: parse(readFileSync(resolve(localeRoot, 'base.yaml'), 'utf8')),
    settings: parse(readFileSync(resolve(localeRoot, 'settings.yaml'), 'utf8')),
    stage: parse(readFileSync(resolve(localeRoot, 'stage.yaml'), 'utf8')),
  })
}

function collectStaticTranslationKeys() {
  const keys = new Set<string>()
  for (const root of sourceRoots) {
    for (const file of listSourceFiles(resolve(workspaceRoot, root))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\b(?:t|\$t)\(\s*['"]([^'"]+)['"]/g))
        keys.add(match[1])
    }
  }
  return [...keys].sort()
}

function interpolationVariables(value: unknown) {
  if (typeof value !== 'string')
    return []
  return [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort()
}

describe('Simplified Chinese web localization', () => {
  const english = loadWebMessages('en')
  const chinese = loadWebMessages('zh-Hans')
  const referencedKeys = collectStaticTranslationKeys().filter(key => key in english)

  it('defines every statically referenced English key in Simplified Chinese', () => {
    expect(referencedKeys.filter(key => !(key in chinese))).toEqual([])
  })

  it('preserves interpolation variables from English messages', () => {
    const mismatches = referencedKeys
      .filter(key => key in chinese)
      .filter(key => interpolationVariables(english[key]).join('|') !== interpolationVariables(chinese[key]).join('|'))
    expect(mismatches).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试并确认当前缺口**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
```

Expected: FAIL；第一项测试列出 84 个中文缺失键，主要位于 `settings.pages.modules`、`settings.dialogs.onboarding`、`settings.pages.data`、`settings.chat` 和 `settings.pages.chat`。

- [ ] **Step 4: 补齐所有静态引用缺键**

按英文文件的相同层级向简体中文 YAML 加入键。以下核心翻译必须使用这些文字，其余同组键保持相同术语：

```yaml
chat:
  send-mode:
    title: 发送按键
    description: 选择聊天输入框发送消息的按键方式。
    options:
      enter: 按 Enter 发送
      ctrl-enter: 按 Ctrl+Enter 发送
      double-enter: 连按两次 Enter 发送
  stream-idle-timeout:
    title: 流式响应空闲超时
    description: 模型流式响应长时间没有新事件时自动取消本次响应。
    options:
      10s: 10 秒
      15s: 15 秒
      30s: 30 秒
      45s: 45 秒
      60s: 60 秒
      120s: 2 分钟
```

同时补齐并翻译这些完整键组：

- `dialogs.onboarding.modeSelection`：如何开始、简易设置、高级设置及两种模式说明。
- `dialogs.onboarding.senseSetup`：感知入口、意识、语音与听觉、OpenRouter/Deepgram 获取入口及说明。
- `pages.chat`：聊天设置标题、说明和三种发送模式。
- `pages.connection.hf-token`：Hugging Face 令牌标签、用途说明和 `hf_...` 示例。
- `pages.data.sections.characters|memory|backgrounds`：角色、记忆与日记、背景及导入导出操作。
- `pages.modules.hearing.sections.section.hotkey`：麦克风切换快捷键和 Scroll/Caps/Num Lock 选项。
- `pages.modules.messaging-discord`：连接状态、控制、模拟消息和开发控制台；保留 Discord、VLM 名称。
- `pages.providers.provider.amazon-bedrock.config`：AWS 凭据说明；保留 AWS、IAM、STS 名称。
- `vrm.scale-and-position`：鼠标跟随、跟随速度及说明。
- `stage.chat.reasoning_only`：模型只生成推理内容时的用户提示。

- [ ] **Step 5: 重新运行测试并提交**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
git diff --check
git add packages/stage-layouts/package.json packages/stage-layouts/src/localization/web-localization.test.ts packages/i18n/src/locales/zh-Hans/settings.yaml packages/i18n/src/locales/zh-Hans/stage.yaml
git commit -m "test(i18n): require Chinese web message coverage"
```

Expected: 2 tests PASS；提交只包含测试、依赖和补齐的中文键。

### Task 2: 清理中文语言包内仍为英文的可见文案

**Files:**
- Modify: `packages/stage-layouts/src/localization/web-localization.test.ts`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/stage.yaml`

- [ ] **Step 1: 增加“普通英文不得原样回退”失败测试**

在测试文件加入：

```ts
const allowedIdenticalEnglishKeys = new Set([
  'settings.pages.flux.title',
  'settings.pages.modules.messaging-discord.title',
  'settings.pages.modules.x.title',
  'settings.pages.admin.officialGateway.providers.openrouter',
  'stage.chat.message.character-name.airi',
])

function canRemainEnglish(key: string) {
  return allowedIdenticalEnglishKeys.has(key)
    || /^settings\.pages\.providers\.provider\.[^.]+\.title$/.test(key)
    || /\.(?:apiKey|baseURL|flux)$/.test(key)
}
```

并在 `describe` 中加入：

```ts
it('does not leave referenced user-facing sentences identical to English', () => {
  const untranslated = referencedKeys.filter(key => (
    typeof english[key] === 'string'
    && english[key] === chinese[key]
    && /[A-Z]{3}/i.test(english[key] as string)
    && !canRemainEnglish(key)
  ))
  expect(untranslated).toEqual([])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
```

Expected: FAIL；列出 Provider 分类说明、连接说明、模型设置、账户危险操作等仍为英文的可见键。

- [ ] **Step 3: 翻译普通文案并保留专有词**

翻译测试列出的全部普通句子。采用以下术语：

```text
Speech -> 语音合成
Transcription -> 语音转写
Vision -> 视觉
Gaming -> 游戏
Messaging -> 消息平台
Maximum FPS -> 最大帧率
Render Scale -> 渲染比例
Unlimited -> 不限
Confirm new password -> 确认新密码
Danger Zone -> 危险操作
```

Provider 名称、模型名、OpenAI、OpenRouter、AWS、WebSocket、API、URL、Flux、Live2D、VRM 保持原文，但其前后说明翻译成中文。开发工具命名和 `Markdown Stress` 不纳入此测试。

- [ ] **Step 4: 验证并提交**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
git diff --check
git add packages/stage-layouts/src/localization/web-localization.test.ts packages/i18n/src/locales/zh-Hans/settings.yaml packages/i18n/src/locales/zh-Hans/stage.yaml
git commit -m "fix(i18n): translate referenced Chinese web messages"
```

Expected: 3 tests PASS。

### Task 3: 迁移系统、数据和模块设置页的硬编码英文

**Files:**
- Modify: `packages/stage-layouts/src/localization/web-localization.test.ts`
- Modify: `packages/i18n/src/locales/en/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/stage-pages/src/pages/settings/modules/speech.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/vision.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/hearing.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/beat-sync.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/memory-short-term.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/memory-long-term.vue`
- Modify: `packages/stage-pages/src/pages/settings/modules/memory-signals.vue`
- Modify: `packages/stage-pages/src/pages/settings/data/index.vue`
- Modify: `packages/stage-pages/src/pages/v2/settings/providers.vue`

- [ ] **Step 1: 为当前可见英文加入源码契约失败测试**

在测试文件加入：

```ts
const forbiddenEnglishByFile: Record<string, string[]> = {
  'packages/stage-pages/src/pages/settings/modules/speech.vue': [
    'Add Provider',
    'No Speech Providers Configured',
    'Customize how your AI assistant speaks',
  ],
  'packages/stage-pages/src/pages/settings/modules/vision.vue': [
    'Not Configured',
    'No Vision Providers Configured',
    'Search models...',
    'Direct Response',
    'Forward to LLM',
  ],
  'packages/stage-pages/src/pages/settings/modules/hearing.vue': [
    'No Providers Configured',
    'Click here to set up your Transcription providers',
    'Voice Activity',
    'Last 2 seconds',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-short-term.vue': [
    'Active Character',
    'Window Size',
    'Rebuild From History',
    'Context Strategy',
    'Dream State Synthesis',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-long-term.vue': [
    'Character Filter',
    'Search Archive',
    'Archive Purpose',
    'Operational Rules',
    'Identity Anchors',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-signals.vue': [
    'The Dream State',
    'Enable Dream State',
    'Journaling Threshold',
    'Strict AFK Gating',
  ],
  'packages/stage-pages/src/pages/settings/data/index.vue': [
    'Backup Provider:',
    'Last Backup:',
    'Nuke Selected',
    'Restore Selected',
    'Confirm Restore',
  ],
  'packages/stage-pages/src/pages/v2/settings/providers.vue': [
    'Search configured...',
    'Customize options',
    'Search supported providers...',
    'No providers',
  ],
}

it('does not reintroduce audited English literals in production settings', () => {
  const violations = Object.entries(forbiddenEnglishByFile).flatMap(([file, phrases]) => {
    const source = readFileSync(resolve(workspaceRoot, file), 'utf8')
    return phrases.filter(phrase => source.includes(phrase)).map(phrase => `${file}: ${phrase}`)
  })
  expect(violations).toEqual([])
})
```

- [ ] **Step 2: 运行测试确认源码契约失败**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
```

Expected: FAIL；报告上述文件和英文短语。

- [ ] **Step 3: 将文案迁移到 i18n**

每个没有 `useI18n()` 的组件加入：

```ts
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
```

模板统一改为动态属性或插值，例如：

```vue
<FieldInput
  :label="t('settings.pages.modules.memory-short-term.fields.window-size.label')"
  :description="t('settings.pages.modules.memory-short-term.fields.window-size.description')"
/>

<span>
{{ t('settings.pages.modules.speech.actions.add-provider') }}
</span>
```

英文和中文 YAML 使用同一键结构。技术示例 `tts-1`、`whisper-1`、`gpt-4o-mini`、`hf_...` 和模型 ID 保持原样；按钮、状态、说明和可访问性标签全部翻译。

- [ ] **Step 4: 验证模块设置并提交**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
& $corepack pnpm --filter @proj-airi/stage-pages typecheck
git diff --check
git add packages/i18n/src/locales/en/settings.yaml packages/i18n/src/locales/zh-Hans/settings.yaml packages/stage-layouts/src/localization/web-localization.test.ts packages/stage-pages/src/pages/settings packages/stage-pages/src/pages/v2/settings/providers.vue
git commit -m "fix(settings): localize core web settings"
```

Expected: 本地化测试 PASS，`stage-pages` 类型检查退出码为 0。

### Task 4: 迁移角色卡向导和模型设置中的高频英文

**Files:**
- Modify: `packages/stage-layouts/src/localization/web-localization.test.ts`
- Modify: `packages/i18n/src/locales/en/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/guided.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/ConceptBuilderModal.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/VoiceCreatorModal.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabIdentity.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabGeneration.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabProactivity.vue`
- Modify: `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue`
- Modify: `packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue`
- Modify: `packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue`
- Modify: `packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue`
- Modify: `packages/stage-ui/src/components/scenarios/settings/model-settings/spine.vue`
- Modify: `packages/stage-ui/src/components/scenarios/settings/model-settings/components/ModelSceneSettings.vue`

- [ ] **Step 1: 扩展源码契约测试**

向 `forbiddenEnglishByFile` 增加这些条目：

```ts
'packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue': [
  'New Profile', 'Profile Name', 'Base Provider', 'Pitch Tuning', 'Custom Replacement Rules', 'Stop Playback',
],
'packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue': [
  'Character Customizations', 'Auto Blink', 'Force Auto Blink (fallback)', 'Reset value to default', 'Mouse Tracking',
],
'packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue': [
  'Character Customizations', 'Enable Physics', 'Enable IK Solvers', 'Gravity Strength',
],
'packages/stage-pages/src/pages/settings/airi-card/guided.vue': [
  'Confirm & Create', 'Roster Settings', 'Model Preview', 'Auto-Assign Voices',
],
```

Run the focused test and expect FAIL with these phrases.

- [ ] **Step 2: 迁移用户可见标签、按钮、说明和 tooltip**

角色卡文案放在 `settings.pages.card` 现有层级下；模型设置放在 `settings.model-settings.common`、`settings.live2d`、`settings.vrm`、`settings.spine` 下。保留角色字段名、模型参数名、文件扩展名、正则示例和 AI 生成提示词原文；仅迁移渲染给用户的文案。

动态三元文案改为翻译键，例如：

```vue
:title="isHidden(morph)
  ? t('settings.model-settings.common.actions.show')
  : t('settings.model-settings.common.actions.hide')"
```

值格式化改为：

```ts
function formatPan(value: number) {
  if (value === 0)
    return t('settings.model-settings.audio-studio.pan.center')
  return value < 0
    ? t('settings.model-settings.audio-studio.pan.left', { value: Math.abs(value) })
    : t('settings.model-settings.audio-studio.pan.right', { value })
}
```

- [ ] **Step 3: 验证并提交角色与模型设置**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
& $corepack pnpm --filter @proj-airi/stage-pages typecheck
& $corepack pnpm --filter @proj-airi/stage-ui typecheck
git diff --check
git add packages/i18n/src/locales/en/settings.yaml packages/i18n/src/locales/zh-Hans/settings.yaml packages/stage-layouts/src/localization/web-localization.test.ts packages/stage-pages/src/pages/settings/airi-card packages/stage-ui/src/components/scenarios/settings/model-settings
git commit -m "fix(settings): localize card and model editors"
```

Expected: 本地化测试以及两个类型检查均退出码为 0。

### Task 5: 迁移聊天、导航和首次引导中的明显英文

**Files:**
- Modify: `packages/stage-layouts/src/localization/web-localization.test.ts`
- Modify: `packages/i18n/src/locales/en/settings.yaml`
- Modify: `packages/i18n/src/locales/en/stage.yaml`
- Create: `packages/i18n/src/locales/en/server/index.ts`
- Create: `packages/i18n/src/locales/en/server/auth.yaml`
- Modify: `packages/i18n/src/locales/en/index.ts`
- Modify: `packages/i18n/src/locales/zh-Hans/settings.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/stage.yaml`
- Create: `packages/i18n/src/locales/zh-Hans/server/index.ts`
- Create: `packages/i18n/src/locales/zh-Hans/server/auth.yaml`
- Modify: `packages/i18n/src/locales/zh-Hans/index.ts`
- Modify: `packages/stage-layouts/src/components/Widgets/ChatArea.vue`
- Modify: `packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue`
- Modify: `packages/stage-layouts/src/components/Layouts/HeaderAvatar.vue`
- Modify: `packages/stage-layouts/src/components/Layouts/InteractiveArea/Actions/ViewControls.vue`
- Modify: `packages/stage-layouts/src/components/Layouts/InteractiveArea/Actions/About.vue`
- Modify: `packages/stage-ui/src/components/scenarios/chat/ProducerGuidanceModal.vue`
- Modify: `packages/stage-ui/src/components/scenarios/chat/ProducerChoiceBubble.vue`
- Modify: `packages/stage-ui/src/components/scenarios/chat/JournalMomentModal.vue`
- Modify: `packages/stage-ui/src/components/scenarios/chat/JournalPreviewModal.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-selection.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-resolver.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-selective-sync.vue`
- Modify: `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-sync-progress.vue`
- Modify: `apps/stage-web/src/pages/auth/login.vue`
- Modify: `apps/stage-web/src/pages/settings/characters/index.vue`
- Modify: `apps/stage-web/src/pages/settings/characters/components/CharacterDialog.vue`

- [ ] **Step 1: 恢复认证界面的源语言包**

当前认证语言 YAML 只残留在生成目录，源码索引没有导出 `server.auth`。将
`packages/i18n/dist/locales/locales/en/server/auth.yaml` 和
`packages/i18n/dist/locales/locales/zh-Hans/server/auth.yaml` 的现有内容原样恢复到对应 `src/locales` 路径，再修正其中仍为英文的简体中文普通文案。两个 `server/index.ts` 均使用：

```ts
import auth from './auth.yaml'

export default {
  auth,
}
```

在英文和简体中文 `index.ts` 中加入：

```ts
import server from './server'

export default {
  base,
  docs,
  server,
  settings,
  stage,
  tamagotchi,
}
```

同步扩展 `loadWebMessages()`，让测试读取认证语言包：

```ts
server: {
  auth: parse(readFileSync(resolve(localeRoot, 'server/auth.yaml'), 'utf8')),
},
```

运行本地化测试；若恢复的简体中文认证文件缺键或插值变量不一致，测试必须失败并在本步骤内补齐。

- [ ] **Step 2: 为共享界面添加失败契约**

向 `forbiddenEnglishByFile` 加入：

```ts
'packages/stage-layouts/src/components/Widgets/ChatArea.vue': [
  'Describe a scene to imagine...', 'Memory & Context for',
],
'packages/stage-layouts/src/components/Layouts/MobileInteractiveArea.vue': [
  'Hearing', 'Memory', 'Cleanup Messages',
],
'packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-selection.vue': [
  'Deployment', 'Pricing', 'No providers match your current filters.',
],
'packages/stage-ui/src/components/scenarios/chat/ProducerChoiceBubble.vue': [
  'PRODUCER DIRECTIVES', 'Regenerate choices', 'Retry', 'Dismiss suggestions',
],
'apps/stage-web/src/pages/auth/login.vue': [
  'By continuing, you agree to our', 'Terms', 'Privacy Policy',
],
'apps/stage-web/src/pages/settings/characters/index.vue': ['Search...'],
```

Run the focused test and expect FAIL.

- [ ] **Step 3: 迁移共享文案**

聊天和布局文案使用 `stage.chat` 或 `settings.chat-ui`；首次引导使用 `settings.dialogs.onboarding`；旧登录页使用 `settings.auth`；角色管理使用 `settings.pages.characters`。Google、GitHub、Provider 名称、模型 ID 和模板占位符名称保持原文。

含角色名或数值的文案必须使用插值：

```vue
:title="t('stage.chat.memory-and-context-for', { name: characterName })"
```

```yaml
memory-and-context-for: '{name} 的记忆与上下文'
```

- [ ] **Step 4: 验证并提交共享界面**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
& $corepack pnpm --filter @proj-airi/i18n typecheck
& $corepack pnpm --filter @proj-airi/stage-layouts typecheck
& $corepack pnpm --filter @proj-airi/stage-ui typecheck
& $corepack pnpm --filter @proj-airi/stage-web typecheck
git diff --check
git add packages/i18n/src/locales packages/stage-layouts/src packages/stage-ui/src/components/scenarios/chat packages/stage-ui/src/components/scenarios/dialogs/onboarding apps/stage-web/src/pages/auth/login.vue apps/stage-web/src/pages/settings/characters
git commit -m "fix(web): localize shared user interface"
```

Expected: 本地化测试及四个类型检查均通过。

### Task 6: 全量复查、生产构建和项目状态收尾

**Files:**
- Modify: `docs/superpowers/README.md`
- Modify only if audit finds user-visible omissions: files already listed in Tasks 1-5

- [ ] **Step 1: 重新执行英文候选扫描**

Run:

```powershell
rg -n -g '*.vue' -g '*.ts' -g '!**/*.test.ts' -g '!**/*.story.vue' -g '!**/devtools/**' '(title|subtitle|label|description|placeholder|aria-label):?="[A-Za-z]|>[[:space:]]*[A-Za-z][^<{]*<' packages/stage-pages/src/pages/settings packages/stage-layouts/src packages/stage-ui/src/components apps/stage-web/src apps/ui-server-auth/src
```

逐项分类：用户可见普通文案继续迁移；品牌、模型、协议、精确配置字段、开发内部、日志、提示词和不可达页面记录为保留项，不为消除扫描结果而修改业务逻辑。

- [ ] **Step 2: 解析 YAML 并验证编码**

Run:

```powershell
& 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe' -e "const fs=require('fs'),YAML=require('yaml');for(const f of ['packages/i18n/src/locales/en/settings.yaml','packages/i18n/src/locales/en/stage.yaml','packages/i18n/src/locales/zh-Hans/settings.yaml','packages/i18n/src/locales/zh-Hans/stage.yaml'])YAML.parse(fs.readFileSync(f,'utf8'));console.log('YAML OK')"
$files = git diff --name-only fork/main -- '*.yaml' '*.vue' '*.ts' '*.md'
foreach ($file in $files) {
  $bytes = [IO.File]::ReadAllBytes((Resolve-Path $file))
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { throw "BOM detected: $file" }
  if ([Text.Encoding]::UTF8.GetString($bytes).Contains("`r`n")) { throw "CRLF detected: $file" }
}
```

Expected: 输出 `YAML OK`，没有 BOM 或 CRLF 异常。

- [ ] **Step 3: 运行完整定向验证**

Run:

```powershell
& $corepack pnpm --filter @proj-airi/stage-layouts exec vitest run src/localization/web-localization.test.ts
& $corepack pnpm --filter @proj-airi/i18n typecheck
& $corepack pnpm --filter @proj-airi/stage-pages typecheck
& $corepack pnpm --filter @proj-airi/stage-layouts typecheck
& $corepack pnpm --filter @proj-airi/stage-ui typecheck
& $corepack pnpm --filter @proj-airi/stage-web typecheck
& $corepack pnpm --filter @proj-airi/stage-web build
```

Expected: 所有命令退出码为 0，Stage Web 生产构建成功。

- [ ] **Step 4: 浏览器抽查简体中文界面**

在后台启动本地 Stage Web，在简体中文下检查：

```powershell
$web = Start-Process -FilePath $corepack -ArgumentList @('pnpm', '--filter', '@proj-airi/stage-web', 'dev', '--host', '127.0.0.1') -WindowStyle Hidden -PassThru
# 浏览器抽查完成后：
Stop-Process -Id $web.Id
```

检查 `/settings/`、系统/聊天/数据设置、听觉/语音/视觉/记忆模块、角色卡向导、模型设置、聊天弹窗、首次引导、旧登录页和角色管理。验收结果应为：普通按钮、标题、说明、空状态和 tooltip 显示中文；仅品牌、模型、协议和技术字段保留英文。

- [ ] **Step 5: 更新索引并提交收尾**

将 `docs/superpowers/README.md` 中本工作项状态改为 `done`，实施计划链接设为 `[Plan](plans/2026-07-13-web-interface-localization.md)`；运行 `git rev-parse HEAD` 获取最近实现提交 SHA，并写入实现依据。

Run:

```powershell
git diff --check
git status --short
git add docs/superpowers/README.md
git commit -m "docs: close web interface localization plan"
git status --short
```

Expected: 文档提交成功，最终工作区干净。随后将 `main` 推送到 `fork/main`；除非用户另行要求，不执行生产部署。
