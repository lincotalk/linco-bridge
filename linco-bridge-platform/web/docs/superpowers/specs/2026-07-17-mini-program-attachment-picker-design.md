# 小程序附件选择入口设计

## 背景

小程序聊天页点击附件按钮后，当前实现会先调用 `uni.chooseMessageFile()`。微信因此立即打开“选择一个聊天”页面；用户取消或没有选中文件后，应用才显示附件操作菜单，形成两次连续弹窗。

期望行为是点击附件按钮后直接显示应用操作菜单，不预先打开任何系统选择器。

## 交互设计

小程序附件菜单按以下顺序显示：

1. `拍摄`
2. `选择图片`
3. `选择文件`

选择后的行为：

- `拍摄` 调用 `uni.chooseImage()`，并将 `sourceType` 固定为 `['camera']`。
- `选择图片` 调用 `uni.chooseImage()`，并将 `sourceType` 固定为 `['album']`。
- `选择文件` 优先调用微信支持的 `uni.chooseMessageFile()`；仅当该 API 不存在时，回退到 `uni.chooseFile()`。
- 用户取消操作菜单或任一系统选择器时直接结束，不继续拉起其他选择器。

## 平台隔离

H5 继续使用现有的隐藏 `<input type="file">` 选择流程。平台分支仍以 `document` 是否存在为边界：

- 存在 `document`：执行 H5 `pickViaDocument()`，不显示 UniApp 操作菜单。
- 不存在 `document` 且存在 `uni`：执行小程序/UniApp 操作菜单。

本次不修改 H5 的文件读取、附件压缩、预览和发送逻辑。

## 代码边界

修改集中在 `src/composables/useAttachmentPicker.ts`：

- 让图片选择函数接收明确的 `camera` 或 `album` 来源。
- 将 `showActionSheet()` 调整为小程序附件流程的第一步。
- 将普通文件选择回退改为按 API 可用性决定，避免把“用户取消”误判为“不支持”。

不修改 Server，也不修改 `linco-bridge-connect` 插件。

## 错误与取消处理

- 操作菜单取消：返回空附件数组。
- 拍摄、相册或文件选择取消：返回空附件数组，不显示错误提示，不触发其他选择器。
- 文件读取失败：沿用现有 Toast 提示。
- 当前平台没有可用文件选择 API：返回空数组并显示“不支持选择文件”的提示。

## 测试设计

新增附件选择器单元测试，模拟 `uni` API，并验证：

- 小程序点击附件按钮后，第一个调用是 `showActionSheet()`，不会预先调用 `chooseMessageFile()` 或 `chooseFile()`。
- 点击 `拍摄` 时只使用 `sourceType: ['camera']`。
- 点击 `选择图片` 时只使用 `sourceType: ['album']`。
- 点击 `选择文件` 时调用 `chooseMessageFile()`。
- `chooseMessageFile()` 不存在时回退到 `chooseFile()`。
- 用户取消文件选择后不会继续调用其他选择器。
- 存在 `document` 时仍走 H5 文件输入流程，不调用 `showActionSheet()`。

## 验收标准

- 微信小程序点击附件按钮后直接显示 `拍摄 / 选择图片 / 选择文件`。
- 不选择“选择文件”时，不出现“选择一个聊天”页面。
- H5 附件选择行为保持不变。
- 相关单元测试、Web 测试和 H5 构建通过。
