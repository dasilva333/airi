# Web 语音输入设备刷新设计

## 目标

修复桌面 Web 聊天区语音输入面板在浏览器已允许麦克风权限后仍显示 `No options`，并导致用户无法正常启用语音转写的问题。修复保持现有听觉 Provider、转写回填和自动发送行为不变。

## 根因

- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` 不再在桌面听觉面板打开时调用 `askPermission()`。该监听由提交 `536868b48` 删除，而移动布局仍保留同等调用。
- `packages/stage-ui/src/stores/audio.ts` 使用 VueUse `useDevicesList()`。设备列表会在 store 创建时枚举一次，但用户随后通过 `getUserMedia()` 授权时，既有列表不会自动刷新。
- VueUse `ensurePermissions()` 在权限已经是 `granted` 时只更新权限状态，不保证再次执行 `enumerateDevices()`。因此仅恢复旧监听仍不足以覆盖“已授权但列表仍为空”的现象。
- 空的 `audioInputs` 被直接映射为 `FieldSelect` 的空选项，所以界面显示 `No options`。用户无法确认或选择设备，语音启用链路也缺少可靠的设备准备步骤。

## 已选择方案

采用两层、聚焦的修复：

1. 桌面 `ChatArea` 恢复面板打开监听，并通过同一个 `useSettingsAudioDevice()` store 实例调用 `askPermission()`。
2. 底层 `useAudioDevice().askPermission()` 在权限检查后显式重新调用 `navigator.mediaDevices.enumerateDevices()`，把最新设备写回 `useDevicesList()` 的响应式设备集合，再执行现有的首选麦克风选择逻辑。

不把 `useAudioDevice(true)` 用于全局 store，避免页面加载时主动弹出浏览器权限提示。也不直接移植上游大规模语音输入重构，以免改变私有分支现有的 iOS 音频解锁、麦克风阵列偏好和转写 Provider 行为。

## 数据流与错误处理

1. 用户点击桌面聊天框左下角听觉按钮。
2. `hearingPopoverOpen` 变为 `true`，调用 settings audio store 的 `askPermission()`。
3. 底层请求或确认麦克风权限，然后无论权限是刚授予还是此前已授予，都重新枚举媒体设备。
4. 响应式 `audioInputs` 更新；若当前选择为空，则沿用 `findBestDevice()` 选择可用麦克风。
5. 设备选择器获得选项。用户启用麦克风后，现有 stream watcher、VAD 和转写回填链路继续运行。

权限拒绝或设备枚举失败时不得产生未处理的 Promise rejection。桌面面板保持关闭麦克风状态并记录现有错误；本次不新增权限状态机或新的可见错误组件。

## 测试策略

按测试先行实施：

- 在 `packages/stage-ui` 新增音频设备测试，模拟“初始设备列表为空、权限已经允许、重新枚举后返回麦克风”，先确认当前实现失败，再验证 `askPermission()` 刷新列表并选中设备。
- 扩展现有 `ChatArea.test.ts` 源码契约测试，先证明桌面弹层没有权限刷新监听，再断言打开弹层会调用同一 settings audio store 的 `askPermission()`。
- 运行两个定向 Vitest 测试、`stage-ui` 与 `stage-layouts` 类型检查，以及 Stage Web 生产构建。
- 启动本地 Web，并使用真实浏览器或模拟麦克风验证桌面面板不再显示空设备列表，启用后 stream 和音量状态正常。若设备已就绪但转写文字仍不回填，再以新的失败测试定位转写启动时序，不预先扩大本设计范围。

## 非目标

- 不重写完整麦克风权限状态机。
- 不改变移动端听觉面板交互。
- 不修改转写 Provider、自动发送策略或语音识别语言设置。
- 不处理拔插设备、持久化设备失效等未在当前现象中确认的独立问题。
- 不进行生产部署，除非用户另行要求。

## 验收标准

- 桌面听觉面板在权限已允许但初始列表为空时能够重新发现麦克风。
- 设备选择器显示至少一个实际可用设备，而不是 `No options`。
- 用户启用麦克风后现有语音输入链路可以获得 MediaStream；浏览器可用的既有转写配置继续把识别文本写入聊天输入框。
- 权限拒绝或枚举失败不会产生未处理异常。
- 定向测试、相关类型检查和 Stage Web 生产构建通过。
