# Codex RPC 历史与跨端视频预览实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 修复 Codex app-server RPC 历史命令的异步结果链路，并让 MP4/H.264 文件在 Web、Android、iOS 的 Flutter 预览页内可靠播放。

**架构：** Connector 继续以 app-server RPC 为主、JSONL 为回退，并把所有异步结果收敛到既有 `slash_command_result(_chunk) -> turn_end` 契约。NestJS 只用匹配的 `requestId/streamId` 消费预览响应，校验并上传 MP4 后返回 ready URL；Flutter 使用官方 `video_player` 直接播放 OSS URL，不新增本地流媒体代理。

**技术栈：** Node.js 20+ 内置 test runner、Codex app-server JSON-RPC、NestJS 11/TypeScript/Jest、Flutter 3.41/Dart、`video_player`

---

## 文件结构

- `linco-bridge-connect/src/agent/codex/sessions.js`：RPC thread/turn 归一化、分页与 cursor。
- `linco-bridge-connect/src/agent/codex/index.js`：RPC 调用、回退规则和 provider API。
- `linco-bridge-connect/src/command/history/handlers.js`：将 Codex 历史命令接入异步 provider API。
- `linco-bridge-connect/src/command/lifecycle.js`：保证 history reload 结果与 `turn_end` 时序。
- `linco-bridge-connect/test/agent/codex-sessions-rpc.test.js`：RPC 映射与分页单元测试。
- `linco-bridge-connect/test/command/codex-rpc-history-command.test.js`：fake app-server 命令级集成测试。
- `linco-bridge-connect/test/command/linco-local-command-turn-end.test.js`：原有命令回归适配异步完成时序。
- `aichat-service/src/modules/im/im.gateway.ts`：预览 pending request 严格关联和视频 ready payload。
- `aichat-service/src/modules/im/im.gateway.spec.ts`：串帧与视频结果回归测试。
- `aichat-service/src/modules/file/file-security.ts`：MP4 白名单与 `ftyp` 检测。
- `aichat-service/src/modules/file/file-security.spec.ts`：MP4/M4A 类型安全测试。
- `aichat/lib/chat/widgets/video_preview_player.dart`：跨端视频初始化、生命周期和控制条。
- `aichat/lib/chat/widgets/file_preview_dialog.dart`：视频分支选择。
- `aichat/test/chat/video_preview_player_test.dart`：播放器状态与交互测试。
- `aichat/test/chat/file_preview_dialog_test.dart`：视频分支回归测试。
- `aichat/pubspec.yaml`、`aichat/pubspec.lock`：`video_player` 依赖。
- `aichat/tasks/progress.md`、`aichat/tasks/lessons.md`：项目进度和经验记录。

### 任务 1：接通 Codex RPC 历史命令生命周期

**文件：**
- 修改：`linco-bridge-connect/src/agent/codex/sessions.js`
- 修改：`linco-bridge-connect/src/agent/codex/index.js`
- 修改：`linco-bridge-connect/src/command/history/handlers.js`
- 修改：`linco-bridge-connect/src/command/lifecycle.js`
- 创建：`linco-bridge-connect/test/command/codex-rpc-history-command.test.js`
- 修改：`linco-bridge-connect/test/command/linco-local-command-turn-end.test.js`

- [ ] **步骤 1：编写 fake app-server 命令级失败测试**

用可执行 Node fixture 读取 JSON-RPC 行并返回 `thread/list`、`thread/turns/list` 或 `thread/read`。测试等待 `turn_end`，并断言结果严格位于它之前：

```js
test('Codex RPC sessions and history finish after slash command result', async () => {
  handleSlashCommand('/sessions', sessionsWs, session, config);
  await waitForFrame(sessionsWs, frame => frame.type === 'turn_end');
  assert.deepEqual(sessionsWs.sent.map(frame => frame.type), [
    'slash_command_result',
    'turn_end',
  ]);

  handleSlashCommand('/history 3', historyWs, boundSession, config);
  await waitForFrame(historyWs, frame => frame.type === 'turn_end');
  assert.equal(historyWs.sent[0].command, 'history');
  assert.equal(historyWs.sent[0].data.rounds[0].user.text, 'RPC user');
  assert.equal(historyWs.sent.at(-1).type, 'turn_end');
});
```

同时覆盖 `/bind`、`thread/turns/list -> thread/read` 方法不支持回退、app-server 不可启动时 JSONL 回退，以及 `/history-reload` 只发送一次 `turn_end`。

- [ ] **步骤 2：运行测试确认 RED**

运行：

```powershell
node --test test/command/codex-rpc-history-command.test.js
node --test test/command/linco-local-command-turn-end.test.js
```

预期：新命令级测试因 app-server fixture/命令结果时序未完整接通而失败；原回归在 Codex `/sessions` 同步断言处失败。

- [ ] **步骤 3：完成最小 RPC 与命令实现**

provider handler 必须原样返回 Promise，公共完成器只在 Promise settle 后结束命令：

```js
function handleSessions(rawArg, ws, session, options = {}) {
  // 参数校验保持同步；Codex/DeepSeek 数据源返回 Promise。
  if (agentType === 'codex' || agentType === 'deepseek') {
    return sendProviderProjectSessions(ws, session, options.config, agentType, {
      workspace,
      projectId: parsed.projectId,
      limit: parsed.limit,
    });
  }
  // 其他 provider 保持现状。
}

function completeMaybeAsyncLocalCommand(result, ws, session) {
  if (result && typeof result.then === 'function') {
    void result.finally(() => completeLocalCommand(ws, session));
    return true;
  }
  return completeLocalCommand(ws, session);
}
```

RPC 回退仅捕获 transport、process exit 和 method-not-found/not-supported；RPC payload 损坏直接报错。`thread/read` 本地分页 cursor 找不到边界 turn 时返回 cursor invalid，不能悄悄回到最新页。

- [ ] **步骤 4：修正旧测试的异步等待**

将 Codex `/sessions`、`/bind` 和 `/history` 测试块改成 `test(..., async () => {})`，使用统一 helper 等待 `turn_end`：

```js
async function waitForFrame(ws, predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = ws.sent.find(predicate);
    if (frame) return frame;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Timed out waiting for frame');
}
```

- [ ] **步骤 5：运行 Connector 测试确认 GREEN**

```powershell
node --test test/agent/codex-sessions-rpc.test.js
node --test test/command/codex-rpc-history-command.test.js
node --test test/command/linco-local-command-turn-end.test.js
npm test
```

预期：全部退出码为 0，无未处理 Promise rejection。

- [ ] **步骤 6：提交 Connector 变更**

```powershell
git add -- linco-bridge-connect/src/agent/codex/index.js linco-bridge-connect/src/agent/codex/sessions.js linco-bridge-connect/src/command/history/handlers.js linco-bridge-connect/src/command/history/readers.js linco-bridge-connect/src/command/lifecycle.js linco-bridge-connect/test/agent/codex-sessions-rpc.test.js linco-bridge-connect/test/command/codex-rpc-history-command.test.js linco-bridge-connect/test/command/linco-local-command-turn-end.test.js
git commit -m "fix: complete codex rpc history commands"
```

### 任务 2：阻止文件预览并发串帧

**文件：**
- 修改：`aichat-service/src/modules/im/im.gateway.spec.ts`
- 修改：`aichat-service/src/modules/im/im.gateway.ts`

- [ ] **步骤 1：编写相同 sessionKey、不同 requestId 的失败测试**

```ts
it('ignores a preview frame with an explicit unmatched request id', async () => {
  const pending = startBridgePreview(gateway, { sessionKey, filePath: 'demo.mp4' });
  emitBridgeFrame(bridgeFrames$, 'codex', 'alice', {
    type: 'outbound_message',
    requestId: 'history-warmup-request',
    streamId: 'history-warmup-stream',
    sessionKey,
    text: 'Codex Agent 进程已预启动。',
  });
  await flushBridgeFrames();
  expect(await isSettled(pending)).toBe(false);
  emitMatchingMp4Frame();
  await expect(pending).resolves.toMatchObject({ mime_type: 'video/mp4' });
});
```

另加无关联 ID 的旧 Connector 帧仍可按 `sessionKey` 匹配的测试。

- [ ] **步骤 2：运行测试确认 RED**

```powershell
npx jest src/modules/im/im.gateway.spec.ts --runInBand -t "preview frame with an explicit unmatched request id"
```

预期：Promise 被 warmup 文本错误地以 400 结束。

- [ ] **步骤 3：实现严格关联**

```ts
if (streamId) {
  return this.pendingBridgePreviewRequests.get(
    this.bridgeKey(frame.userId, streamId),
  ) ?? null;
}
if (requestId) {
  return this.pendingBridgePreviewRequests.get(
    this.bridgeKey(frame.userId, requestId),
  ) ?? null;
}
return sessionKey
  ? this.pendingBridgePreviewRequests.get(
      this.bridgeKey(frame.userId, sessionKey),
    ) ?? null
  : null;
```

带显式 ID 的帧未命中时立即返回 `null`，不再继续按 `sessionKey` 查找。

- [ ] **步骤 4：运行相关测试确认 GREEN**

```powershell
npx jest src/modules/im/im.gateway.spec.ts --runInBand -t "preview|routes bridge chat outbound frames"
```

预期：相关测试全部通过。

- [ ] **步骤 5：提交严格关联修复**

```powershell
git add -- src/modules/im/im.gateway.ts src/modules/im/im.gateway.spec.ts
git commit -m "fix: correlate bridge preview responses strictly"
```

### 任务 3：服务端识别并返回可播放 MP4

**文件：**
- 修改：`aichat-service/src/modules/file/file-security.spec.ts`
- 修改：`aichat-service/src/modules/file/file-security.ts`
- 修改：`aichat-service/src/modules/im/im.gateway.spec.ts`
- 修改：`aichat-service/src/modules/im/im.gateway.ts`

- [ ] **步骤 1：编写 MP4/M4A 类型失败测试**

```ts
const ftyp = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftypisom'),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from('isomiso2'),
]);

await expect(validateFileType(ftyp, 'clip.mp4', 'video/mp4')).resolves.toMatchObject({
  detectedMimeType: 'video/mp4',
});
await expect(validateFileType(ftyp, 'voice.m4a', 'audio/mp4')).resolves.toMatchObject({
  detectedMimeType: 'audio/mp4',
});
```

在 gateway spec 中断言 `video/mp4` 返回 `preview_status: 'ready'`，URL 缺失返回 `failed/PREVIEW_VIDEO_URL_MISSING`。

- [ ] **步骤 2：运行测试确认 RED**

```powershell
npx jest src/modules/file/file-security.spec.ts --runInBand
npx jest src/modules/im/im.gateway.spec.ts --runInBand -t "video preview"
```

预期：`.mp4` 报 `FILE_TYPE_UNSUPPORTED` 或被识别为 `audio/mp4`，视频结果仍为 `skipped`。

- [ ] **步骤 3：实现 MP4 校验和 ready payload**

```ts
const MIME_BY_EXTENSION: Record<string, string[]> = {
  // existing entries
  '.mp4': ['video/mp4'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'],
};

if (ascii.slice(4, 8) === 'ftyp') {
  return extension === '.mp4' ? 'video/mp4' : 'audio/mp4';
}
```

```ts
const isVideo = mimeType.startsWith('video/') || ext === '.mp4';
if (isVideo) {
  return previewUrl
    ? readyBridgePreview(fileName, mimeType, previewUrl)
    : failedBridgePreview(fileName, mimeType, 'PREVIEW_VIDEO_URL_MISSING', '视频预览地址缺失');
}
```

保持现有响应字段名，不引入新的客户端契约。

- [ ] **步骤 4：运行服务端测试、lint 和构建确认 GREEN**

```powershell
npx jest src/modules/file/file-security.spec.ts --runInBand
npx jest src/modules/im/im.gateway.spec.ts --runInBand -t "preview|video"
npm run build
```

只对本次修改文件运行 ESLint 检查，避免 `npm run lint` 的 `--fix` 改写无关文件：

```powershell
npx eslint src/modules/file/file-security.ts src/modules/file/file-security.spec.ts src/modules/im/im.gateway.ts src/modules/im/im.gateway.spec.ts
```

预期：测试、lint、构建均退出 0。

- [ ] **步骤 5：提交服务端视频支持**

```powershell
git add -- src/modules/file/file-security.ts src/modules/file/file-security.spec.ts src/modules/im/im.gateway.ts src/modules/im/im.gateway.spec.ts
git commit -m "feat: support mp4 bridge previews"
```

### 任务 4：实现 Flutter 跨端视频预览

**文件：**
- 修改：`aichat/pubspec.yaml`
- 修改：`aichat/pubspec.lock`
- 创建：`aichat/lib/chat/widgets/video_preview_player.dart`
- 修改：`aichat/lib/chat/widgets/file_preview_dialog.dart`
- 创建：`aichat/test/chat/video_preview_player_test.dart`
- 修改：`aichat/test/chat/file_preview_dialog_test.dart`

- [ ] **步骤 1：增加依赖并编写视频分支失败测试**

```yaml
dependencies:
  video_player: ^2.10.0
```

```dart
testWidgets('mp4 file uses the dedicated video preview', (tester) async {
  await pumpFilePreview(
    tester,
    fileName: 'demo.mp4',
    mimeType: 'video/mp4',
    previewUrl: 'https://cdn.example.com/demo.mp4',
  );
  expect(find.byKey(const Key('chat-video-preview')), findsOneWidget);
  expect(find.byKey(const Key('chat-file-webview-preview')), findsNothing);
});
```

- [ ] **步骤 2：运行分支测试确认 RED**

```powershell
flutter pub get
flutter test test/chat/file_preview_dialog_test.dart --plain-name "mp4 file uses the dedicated video preview"
```

预期：找不到 `chat-video-preview`，当前代码进入 WebView/空内容回退。

- [ ] **步骤 3：实现最小视频组件和分支**

```dart
bool isVideoPreviewFile(String mimeType, String fileName) {
  return mimeType.toLowerCase().startsWith('video/') ||
      fileName.toLowerCase().endsWith('.mp4');
}

if (isVideoPreviewFile(widget.mimeType, widget.fileName)) {
  final url = _normalizedPreviewUrl;
  return url == null
      ? const _VideoPreviewUnavailablePane()
      : ChatVideoPreview(url: url);
}
```

`ChatVideoPreview` 在 `initState` 创建 `VideoPlayerController.networkUrl(Uri.parse(url))` 并初始化；`dispose` 中移除监听并释放。画面使用约束后的 `AspectRatio`，底部控制条包含播放/暂停、当前时间/总时长、`Slider`、静音和播放结束后的重播。

- [ ] **步骤 4：编写播放器交互失败测试**

使用 `video_player_platform_interface` fake platform 推送 initialized、playing、position 和 completed 事件，断言：

```dart
expect(find.byKey(const Key('chat-video-play-button')), findsOneWidget);
await tester.tap(find.byKey(const Key('chat-video-play-button')));
expect(fakePlatform.playCalls, 1);
await tester.drag(find.byKey(const Key('chat-video-progress')), const Offset(120, 0));
expect(fakePlatform.lastSeek, isNotNull);
await tester.tap(find.byKey(const Key('chat-video-mute-button')));
expect(fakePlatform.lastVolume, 0);
fakePlatform.emitCompleted();
await tester.pump();
expect(find.byKey(const Key('chat-video-replay-button')), findsOneWidget);
```

另测初始化异常显示错误而不抛出、默认不自动播放，以及 widget 销毁后调用 `dispose`。

- [ ] **步骤 5：运行播放器测试确认 RED，再完成控制逻辑**

```powershell
flutter test test/chat/video_preview_player_test.dart
```

预期：控制按钮或状态逻辑缺失导致失败。随后补齐最小控制逻辑，重复命令直到通过。

- [ ] **步骤 6：运行 Flutter 回归、分析与三端构建**

```powershell
flutter test test/chat/video_preview_player_test.dart test/chat/file_preview_dialog_test.dart
flutter analyze
flutter build web
flutter build apk --debug
```

iOS 构建只能在 macOS/Xcode 环境执行：

```bash
flutter build ios --no-codesign
```

当前 Windows 环境记录 iOS 构建未执行，但共享 Dart 代码和官方插件契约必须通过 analyze/widget tests；Android/Web 构建均应退出 0。

- [ ] **步骤 7：提交 Flutter 视频预览**

```powershell
git add -- pubspec.yaml pubspec.lock lib/chat/widgets/video_preview_player.dart lib/chat/widgets/file_preview_dialog.dart test/chat/video_preview_player_test.dart test/chat/file_preview_dialog_test.dart
git commit -m "feat: preview mp4 videos across flutter platforms"
```

### 任务 5：项目文档与全链路验证

**文件：**
- 修改：`aichat/tasks/progress.md`
- 修改：`aichat/tasks/lessons.md`
- 检查：`AIChat-Admin`（无预期代码改动）

- [ ] **步骤 1：更新 Flutter 项目记录**

在 `tasks/progress.md` 记录 MP4 跨端预览完成，在 `tasks/lessons.md` 添加：

```markdown
- [2026-08-18] Bridge 文件预览只按 sessionKey 关联会被同会话并发系统帧抢占 -> 有 requestId/streamId 时必须严格匹配，只有无 ID 的旧帧才能按 sessionKey 兼容。
- [2026-08-18] MP4 的 ftyp 容器签名也用于 M4A -> 检测时结合扩展名区分 video/mp4 与 audio/mp4，播放能力交给平台解码器。
```

- [ ] **步骤 2：运行最终验证矩阵**

Connector：

```powershell
cd D:\project\linco-bridge\linco-bridge-connect
npm test
```

服务端：

```powershell
cd D:\project\aichat-service
npx jest src/modules/file/file-security.spec.ts src/modules/im/im.gateway.spec.ts --runInBand
npm run build
```

Flutter：

```powershell
cd D:\project\aichat
flutter test test/chat/video_preview_player_test.dart test/chat/file_preview_dialog_test.dart
flutter analyze
flutter build web
flutter build apk --debug
```

管理后台没有共享代码改动，仅确认工作树未因本功能产生 diff：

```powershell
cd D:\project\AIChat-Admin
git status --short
```

- [ ] **步骤 3：检查 diff 和需求覆盖**

```powershell
git -C D:\project\linco-bridge status --short
git -C D:\project\aichat-service status --short
git -C D:\project\aichat status --short
git -C D:\project\AIChat-Admin status --short
```

逐项确认：RPC 主路径、JSONL 回退、结果早于单一 `turn_end`、严格预览关联、`.mp4/video/mp4`、ready URL、播放/暂停/seek/时间/静音/重播、默认不自动播放、Web/Android 构建，以及 iOS 的环境限制说明。

- [ ] **步骤 4：提交项目记录**

```powershell
git add -- tasks/progress.md tasks/lessons.md
git commit -m "docs: record cross-platform video preview support"
```

