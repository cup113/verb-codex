# Changelog

本文件记录变位法典的显著变更。格式参照 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added

- **备份与恢复**：列表页标题行的 `Sauvegarde` 进入导出 / 导入。导出把整个法典写成一个带格式版本的 JSON 文件；导入是**整体替换**（先确认，绝不合并），并复用存储层那套容错读盘。
  - Android 用系统分享面板导出（Drive / Keep / 邮件给自己都行）、粘贴导入——不为此引入文件选择器依赖；Web 则是真正的文件下载与文件选择。
  - 这是"浏览器存储可被清理"与"换机 / 卸载丢数据"的唯一解药。

## [0.1.0] - 2026-10-15

首个可分发的版本：一本手填的法语变位备忘录（Android）。

### Added

- **动词条目**：列表 / 详情 / 新增三屏；按 `1er (-er)` / `2e (-ir)` / `3e (Irrégulier)` 分组筛选，逐格手填六行现在时的**词干**与**词尾**。
- **附注**：详情卡片下方的多行自由文本框（发音、用法等），自测时隐藏。
- **自测**：词尾全部遮为 `…`，点哪一行揭晓哪一行；`Tout révéler` 退出，Android 返回键先退自测再退页面。
- **长按拖动重排**：在**分组**内调整**次序**，松开即落盘，重启保留。
- **持久化**：AsyncStorage（Android 上即 Room / SQLite）；敲字 300ms 防抖落盘，结构改动立即写。
- **删除**：详情页顶部 `Supprimer`（确认后生效），列表行因此只剩"点按打开 / 长按拖动"两个手势。
- **内置字体**：Newsreader 与 JetBrains Mono 的静态实例（每个字重独立家族）；配色与排版对齐原型 demo。
- **应用图标**：自适应图标（API 26+）+ 传统方形 / 圆形，由 `tools/make-icons.py` 从 `favicon.jpg` 生成。
- **实验性 Web 目标**：`npm run web` / `npm run web:build`，浏览器里除重排外全部可用（见 [docs/spike-web.md](docs/spike-web.md)）。

### Changed

- 删除操作从"列表长按"迁到详情页，列表行只保留两个无歧义的手势。

### 已知限制

- web 上不提供长按拖动重排：reanimated 的 worklet 变换在 Vite 管线里无处挂载，故不做"按下去没反应"的交互。
- 没有导出 / 导入功能：浏览器存储可被清理，换机或卸载即丢数据。
- release APK 为 **debug 签名**（仓库无 keystore）：可安装、可分享，但不能上架，且将来改用正式签名时需先卸载。
