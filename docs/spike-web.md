# Web / PWA 可行性 spike

**问题**：法典能不能加一个 Web 目标，让它在浏览器里可用（进而可安装为 PWA）？

**结论**：可以，但有一条硬边界——**reanimated 那条长按拖动链路在 web 上不成立**。因此 web 定位为"查看与编辑"，次序只在 Android 上调整（`src/components/VerbList.web.tsx`）。除重排外，逐项都在浏览器里点过并通过。

> **后记（同日追加）**：这条边界后来被绕开了——不是修好 reanimated，而是用浏览器自己的 HTML5 拖放另做一套重排，见文末 [「追加：web 的次序重排」](#追加web-的次序重排上面那条不成立的边界被绕开了)。

## 怎么跑

```sh
npm run web         # Vite dev server（HMR）
npm run web:build   # 产出 dist/
npx vite preview    # 预览构建产物
```

## 实测结果

| 功能                           | web                                                         |
| ------------------------------ | ----------------------------------------------------------- |
| 列表 / 分组筛选 / 计数         | ✓                                                           |
| 详情页：不定式、六行变位、附注 | ✓                                                           |
| 新增条目 → 直接落到详情页      | ✓                                                           |
| 自测（遮盖 `…` / 点击揭晓）    | ✓                                                           |
| 删除（详情页）                 | ✓ 经 `window.confirm`                                       |
| 持久化                         | ✓ localStorage；三条示例条目、新建、删除都落盘              |
| 长按拖动重排**次序**（reanimated 链路） | ✗ 见下（已在 web 上移除该交互；后来改用 HTML5 拖放，见文末追加一节） |

产物：`dist/assets/index-*.js` 925.56 kB（gzip 275.44 kB）+ 5 个字体文件（Vite 打指纹）。dev server 与构建产物的渲染**逐像素一致**（同一张截图 sha256 相同，`screenshots/web/web-11`、`web-12`）。

证据截图都在 [screenshots/web](../screenshots/web)：`web-01` 是修复前（布局塌陷）、`web-02` 修复后、`web-07`/`web-08` 是拖动失效的仪表化证据。

## 三处必须的平台差异

1. **存储**：AsyncStorage v3 **没有 web 构建**（平台目录只有 `android/` `apple/` `windows/`），所以 `src/storage/asyncStorageAdapter.web.ts` 用 localStorage。存储端口是唯一的改动点（`verbStore` 一直依赖注入 `VerbStorage`）。
2. **删除确认**：react-native-web 的 `Alert.alert` 是 `static alert() {}`——**空函数**，会把删除变成静默失败。`src/platform/confirmDestructive.web.ts` 改用 `window.confirm`（选择取消时什么都不做，语义与原生一致）。
3. **返回键**：web 没有硬件返回键，RNW 的 `BackHandler` 桩会 `console.error`。详情页"返回键先退自测"的订阅只在原生注册。

## 拖动为什么在 web 上不成立（spike 的主要产出；**限定于 reanimated 这条链路**）

长按链路本身是**通的**：gesture-handler 在 web 上走 pointer events，`drag()` 被调用，行进入 active 态（`screenshots/web/web-07` 里那张卡片边框变成赤陶色，这是我自己的 JS 状态 `dragging={isActive}`）。但从这一刻起，位移与缩放全部由 reanimated 的 `useAnimatedStyle` 驱动，而 **reanimated 4 的动画必须经 worklet 的 Babel 插件编译**，这个插件在 Vite 管线里没有位置：

- `@vitejs/plugin-react@6` 已转向 oxc/Rolldown preset，**不再提供 `babel.plugins`**；
- Android 侧靠 `babel.config.js` 里的 `react-native-worklets/plugin` 生效——Metro 会用它处理 node_modules，`draggable-flatlist` 发布产物里的 worklet 正是靠这个编译的；Vite 没有对应环节。

实测证据（`web-07` → `web-08`，指针 y=170 → y=145）：两张截图 **sha256 完全相同**——既无位移，也没有 `ScaleDecorator` 的 1.05 缩放；松开后 localStorage 里的次序未变；控制台**没有任何报错**（静默失效，比报错更难发现）。

要让它在 web 上活，得自写一个 Vite 插件、用 `@babel/core` + `react-native-worklets/plugin` 处理 reanimated 相关文件（含 node_modules），等于再养一条变换管线。**当前决定：不做。** 与其提供一个按下去没反应的交互，不如在 web 上不提供——这也让 web 产物不再包含 reanimated / draggable-flatlist。

## Vite 配置里三个非显而易见的地方

1. **`resolve.alias` 必须精确匹配**（`/^react-native$/`）。写成 `{'react-native': 'react-native-web'}` 是**前缀**改写，`react-native/Libraries/...` 这类深路径会被送到不存在的 `react-native-web/Libraries/...`。
2. **`#root` 必须是 flex 容器**。RNW 的 `AppContainer` 是一个 `flex: 1` 的 View，挂载点若是 `display: block`，整棵树的 flex 高度塌成 0，内容全堆在顶部（对比 `web-01` / `web-02`）。
3. **dev server 需要 `optimizeDeps.exclude`**。safe-area-context / gesture-handler / screens 里有带 `react-native/Libraries/...` 的原生专用文件，生产构建根本不会请求它们，但 dev 的依赖预打包会整包扫，撞上 Flow 源码直接失败。排除这三个包后 `npm run web` 正常。

## 类型检查是两个 program

`tsconfig.json`（原生，不含 DOM）与 `tsconfig.web.json`（开 DOM、显式包含 `.web.*`）各跑一次，`npm run typecheck` 两个都跑。这样原生代码**碰不到** `window`/`document`，而 `.web.ts` 双胞胎能碰。

一个已知的不完美：react-native-web **不发类型**，所以 web program 只能对着 `react-native` 的类型检查（而非 RNW 自己的 API）。`web/main.tsx` 里 `RootTag` 那一次 `as unknown as` 就是这处缝隙，注释里写明了原因。

## 补齐之后（同日更新）

上面列的缺口都做完了，每一条都留了可复现的证据：

- **图标 / manifest / service worker**：`tools/make-icons.py` 现在同时产出 web 图标（`favicon.ico`、`favicon-32`、`apple-touch-icon`、192/512 的 `any` 与 `maskable`）——两次运行 22 个文件 SHA-256 完全一致，且 maskable 主体半径 0.325 < 安全区 0.4，圆形与方圆蒙版下都不切边。manifest 与 SW 由 `vite-plugin-pwa@2` + workbox 7 生成，采用 `registerType: 'prompt'`：**新版本等到应用被完全关闭才接管**，绝不把用户从一次击键下面抽走。
- **导出 / 导入**：见 [CHANGELOG](../CHANGELOG.md) 的 0.1.0。它同时是 Android 换机 / 卸载丢数据的解药。
- **CI 的 `web` job**：构建并断言产物真的构成一个 PWA（manifest / `sw.js` / 两种尺寸图标 / 5 个字体），再上传 `dist/` 作为构件。

浏览器实测（Chromium，`vite preview` 服务构建产物）：

| 检查                            | 结果                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `beforeinstallprompt` 是否触发  | ✓ 这是"可安装"的真实信号，不是照着清单勾选                                                              |
| manifest 取回并解析             | ✓ 200；`display: standalone`；四个图标（含 maskable）                                                   |
| 7 个图标 / favicon 是否可达     | ✓ 全部 200 且 content-type 正确（那条 `favicon.ico 404` 消失）                                          |
| SW 注册与接管                   | ✓ 首屏未被接管（prompt 模式不带 `clientsClaim`），第二次加载起 `controller = /sw.js`                    |
| 缓存条目数                      | 17 条：预缓存清单 22 条，其中 5 条是插件重复列出的 manifest 图标，workbox 按 URL 归并                   |
| 断网冷启动                      | ✓ 标题与整页文本都在（`screenshots/web/web-21`）                                                        |
| `navigator.storage.persisted()` | ✗ **false**——Chromium 在 localhost 上不批准，于是备份屏显示"这个浏览器可能不留情面地清掉数据"（web-20） |

最后一条值得单独记住：`persist()` 不是开关，是**申请**。它挡得住 LRU 与存储压力淘汰，挡不住用户主动清理与 InPrivate，Safari 还会在 7 天无交互后主动清理。所以"未获批准时明说风险"比"静默申请"诚实——而这也正是备份屏那句话的存在理由。

## 第四处平台差异：`<input>` 没有"内容宽度"

编辑态的词干字段曾把词尾推到一行之外——就是那张 `j' aim ····· e` 的空洞，实测 ≈209px。原因不在"一行分两段"的设计，而在平台：

- react-native-web 把 `TextInput` 渲染成裸 `<input>`，它的 `flex-basis: auto` 解析为**浏览器默认字段宽度**：实测 **209px**，与内容无关（内容是 27px 宽的 `aim`）。词尾是 `flexGrow: 1; flexBasis: 0`，只能从这个固定宽度之后开始。
- Android 上 RN 按文本测量 TextInput，所以词尾紧跟词干：[02-detail.png](../screenshots/02-detail.png) 里词干墨迹止于 x=178、词尾起于 181。
- `flex: 1` 的输入框（不定式、卡顶 `radical`）不受影响：`flex: 1` 自带 `flex-basis: 0`，宽度来自 flex 行而非固有宽度。
- 查看 / 自测态本来就没有这个问题：那一态渲染的是 `<Text>`，天然按内容收缩。

修法（`src/components/ConjugationRowView.tsx`，仅 web 分支）：先**以 `<Text>` 把词干排出来**——首帧就是对的，不会先闪一个宽框；`onLayout`（RNW 走 ResizeObserver）量到宽度后换成被钉住宽度的 `TextInput`，那份隐形副本此后继续跟随，字体后到还会再触发一次、宽度自动纠正，不需要写死字号度量。没有采用 `field-sizing: content`：它更省事，但 Chrome 123+/Firefox 152+/Safari 26.2+ 才支持（[caniuse](https://caniuse.com/mdn-css_properties_field-sizing)，全球约 87%），更老的 iOS Safari 会保持原样。

实测（无头 Chromium，1029×695，六个变位行逐一读 DOM）：

| | 词干字段宽 | 词尾文字起点 |
| --- | --- | --- |
| 修复后 | **29px**（量度文本 27 + 2px 给光标） | 紧贴词干 |
| 同一页面去掉 pin | 209px | 距词干首字母 209px |
| 卡顶 `radical` 行 | 831px（占满该行） | — |

编辑态的数字取自 DOM（`getComputedStyle` / `getBoundingClientRect`）：无头截图对这个状态只合成出 pin 生效前的一帧（与修复前的构建逐字节相同），故不引用；留下的截图是自测态那张 [web-22-selftest-radical-row-and-mask.png](../screenshots/web/web-22-selftest-radical-row-and-mask.png)——`radical` 行仍在，词尾为 `…` 且紧贴词干。同一次采样里，编辑态与自测态的六行 top 逐一相同（183.5 / 225.5 / 267.5 / 309.5 / 351.5 / 393.5），输入框 14 → 0，掩码 0 → 6。

## 还没做的

- **Netlify 上的真实部署**：`netlify.toml` 已就位（含 `/sw.js` 必须 `must-revalidate` 这条命门——陈旧 worker 会把新版本永远顶在后面），但域名绑定与仓库授权要在 Netlify 里点，而且 **HTTPS 域名下的 `persist()` 结论必须重新实测**：localhost 上的 false 不代表线上也是 false。
- **iOS Safari 的 PWA 行为**：存储策略、安装流程与后台回收都与 Chromium 不同，未实测。

## 追加：web 的**次序**重排（上面那条"不成立"的边界被绕开了）

上面那节的结论要限定范围：**"长按拖动重排在 web 上不成立"说的是 reanimated 那条链路**，不是"web 不能重排"。重排本身只需要两件事——一个能拿到指针位置的手势，和一个能提交 `onReorder(verbId, toIndex)` 的落点——而这两件都不依赖 reanimated。现在 `src/components/VerbList.web.tsx` 用**浏览器自己的 HTML5 拖放**做这件事，`npm run web:build` 产物里依旧没有 reanimated / worklets / draggable-flatlist。

实测（无头 Chromium，构建产物 `vite preview`，三个第一组条目）：

| 检查                                       | 结果                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 按住 400ms 后行获得 `draggable`            | ✓ 该行的 `draggable` 属性由 `false` 变 `true`（其余两行仍是 false）                          |
| 拖动中的视觉                               | ✓ 被拖行 `opacity: 0.35` + 抬起的赤陶描边；落点行上缘一条 `inset` 赤陶细线（`web-23`）        |
| 松手后次序与落盘                           | ✓ DOM 次序与 localStorage 双双改变（两个方向都试过：末尾→中间、末尾→开头）                  |
| 释放到列表之外（表头）                     | ✓ 次序不变（未落进任何行就不提交）                                                          |
| 前后各状态下 `draggable` / 标记是否残留    | ✓ 拖完三行全部回到 `draggable="false"`、无阴影、无残留状态                                   |
| **点击是否被拖放抢走**                     | ✓ 0 / 2 / 5px 抖动都仍然跳转；**这是必须显式解决的坑**，见下                                 |

**为什么行不是天生可拖**：浏览器在指针移动 **2px** 后就开始一次拖放，并**不再派发 `click`**。整行 `draggable` 的第一版实测下来，一次 2px 手抖的"点击"就变成拖放：`dragstart` → `dragend`，**不跳转**（`web-07`/`web-08` 时代那种"按下去没反应"的翻版，只是这次是点不动）。所以改成**按住 400ms 才把 `draggable` 置为 true**（`HOLD_MS`）——这同时使 web 与 Android 的触发方式一致（都是"长按/按住后拖"），也让 2px 的误拖不再可能落进两个行之间的缝隙。

同一条实测还确定了两件事：**离开所在行不算松手**（拖动必然要先离开它，`pointerleave` 一清 `draggable`，浏览器立刻中止拖放），因此"按下后在任何地方松手"由 document 上的 `pointerup` 收尾；而**拖放期间浏览器不再派发指针事件**，所以那段由 `dragend` 收尾。

触摸浏览器仍不提供重排（HTML5 拖放不响应手指），并且**不显示这条提示**：能否重排由 `src/platform/reorderByDrag{,.web}.ts` 判断（web 看 `(hover: hover) and (pointer: fine)`），免得对着一台手机承诺一个做不到的手势。真要在触摸 web 上做重排，得自己实现指针长按拖动并且压住浏览器的滚动——那是"再养一套手势仲裁"，与上面"不做"的理由同类，没做。

