# 变位法典 (VerbCodex)

个人法语变位备忘录（Android / React Native）。你亲手把学到的动词和它的六行现在时变位写进法典，之后随时翻看、遮盖自测。

原型参照 [demo](demo)（法式纸质笔记风的单页 HTML），本 App 是它的 React Native 重写：同样的纸色、赤陶色词尾、衬线 + 等宽排版，但把"一张卡片"拆成了"一本可以记录、可以翻阅的法典"。

## 它是什么，不是什么

- **是**一本记录本：收录动词、逐格手填**词干**与**词尾**、另写一段自由**附注**，查看为主、自测为辅。
- **不是**词典或判分器：法典不懂法语，不生成变位、不校验对错、不评分。自测只能"遮盖 + 点击揭晓"，比对对象是你自己写下的记录（见 [ADR 0001](docs/adr/0001-manual-memo-no-engine.md)）。
- 完整术语（动词条目 / 词干 / 词尾 / 分组 / 自测 / 记录值）见 [CONTEXT.md](CONTEXT.md)。

## 交互

| 动作                    | 结果                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 列表页三条分组标签      | 按 `1er (-er)` / `2e (-ir)` / `3e (Irrégulier)` 筛选（新增页里显示完整的 `1er Groupe (-er)`）；标签只是你给的分类，法典不据此推断变位   |
| 点击某行                | 进入该**动词条目**的查看界面（不定式与六行变位就地可改）                                                                                |
| 详情页顶部「Supprimer」 | 删除该**动词条目**（确认后生效）。破坏性操作放在这里，是为了让列表行只剩“点按打开 / 长按拖动”两个手势，不必用计时器或位移阈值去消解歧义 |
| 详情页「Notes」         | 卡片下方的多行自由文本框：记发音、用法、任何想留下的东西；自测时隐藏（提示与答案是同一张纸的两面）                                      |
| 长按某行                | 拿起该行并拖动，在**分组**内重排**次序**                                                                                                |
| 「+ Nouveau」           | 输入不定式、选分组 → 直接落到新条目上填写（六行初始为空，词尾位显示 `…`）                                                               |
| 「S'entraîner」         | 进入自测：词尾全部遮为 `…`，点哪一行揭晓哪一行；「Tout révéler」退出。返回键先退自测，再退页面                                          |

首次启动会写入三条示例条目（aimer / finir / aller，即 demo 卡片上的那三个），可随意修改或长按删除；删空之后不会再次写入。

代词第一行按词干首字母显示 `j'` 或 `je`（元音及 h 前省音）——这是排版便利，不是语法判断。

## 开发

```sh
npm install
npm start              # Metro
npm run android        # 构建并安装到已连接的设备/模拟器
npm test               # jest：47 个用例，覆盖领域逻辑、存储、行组件、列表页与 App 装配
npm run typecheck      # tsc --noEmit
npm run lint
```

### 目录

```
App.tsx                     导航装配（native-stack）+ 启动时载入法典、切后台时落盘
src/types.ts                领域类型、六行代词、分组标签、代词省音
src/domain/verbs.ts         纯逻辑：建条目、改行、进度、容错读盘（可单测，无原生依赖）
src/storage/verbStore.ts    AsyncStorage 存储 + 订阅（存储接口可注入，测试无需原生 mock）
src/data/seed.ts            首启的三条示例条目
src/screens/                列表 / 详情（含自测态）/ 新增
src/components/             Screen、分组标签、变位行、列表行、按钮
assets/fonts/               字体源文件（构建时同步进 android/app/src/main/assets/fonts）
```

### 字体

Newsreader 与 JetBrains Mono 以**静态实例** TTF 打包（`assets/fonts`），构建产物读的是 `android/app/src/main/assets/fonts`。Android 以**文件名**作为字体家族名，所以每个字重都是独立家族，样式里不设 `fontWeight`，避免被合成加粗：

```
NewsreaderRegular / NewsreaderMedium / NewsreaderItalic
JetBrainsMonoRegular / JetBrainsMonoMedium
```

之所以不用 Google Fonts 的变体字体（`Newsreader[opsz,wght].ttf`）：资产目录加载拿不到变体轴，`fontWeight: 500` 会静默退化成默认字重。静态实例来自上游 [productiontype/NewsReader](https://github.com/productiontype/NewsReader)（`fonts/static/ttf`，OFL）与 [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) v2.304（OFL）。

### 图标

应用图标由 [favicon.jpg](favicon.jpg)（1194²、鼠尾草绿底 `#ABBD95`）生成。换图后重新生成，别手工替换 `mipmap-*` 里的 PNG：

```sh
python tools/make-icons.py     # 需要 Pillow
```

脚本同时产出三套并写出 `screenshots/icon-preview.png` 供肉眼确认：

- **自适应图标**（API 26+，即绝大多数设备）：`mipmap-anydpi-v26/ic_launcher{,_round}.xml` = 纯色底 `@color/ic_launcher_background` + 透明前景层。前景缩放由**实测**的主体半径算出（实测 0.388 → 缩放 0.838），确保落在 72dp 安全圆内，圆形/方圆/水滴蒙版都不会切断主体。
- **传统方形/圆形**（minSdk 24，API 24/25 仍需要）：全出血，形状直接烘焙进 PNG。
- 抠背景用"从边框 flood fill"而不是全局色阈：插画领口那道绿边与底色接近但**不连通**，全局阈值会把它一起抹掉。

### 拖动与手势（3 个新增原生依赖）

长按拖动重排由 `react-native-draggable-flatlist` 完成，它依赖 `react-native-gesture-handler` 与 `react-native-reanimated`（后者在 4.x 又把 worklet 变换拆到了 `react-native-worklets`）。四处接线，缺一处就报错：

| 位置              | 内容                                                                                                       | 为什么                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `babel.config.js` | `react-native-worklets/plugin`（必须放最后一个插件）                                                       | reanimated 4 的 worklet 变换已搬到 worklets，`react-native-reanimated/plugin` 只是它的再导出                                           |
| `metro.config.js` | `wrapWithReanimatedMetroConfig`                                                                            | 对纯 Android 只有堆栈折叠生效，其余分支是 `.windows` 兜底                                                                              |
| `App.tsx`         | `GestureHandlerRootView` 包住全树                                                                          | gesture-handler 的检测器必须挂在这个根视图之下                                                                                         |
| `jest.setup.js`   | `react-native-gesture-handler/jestSetup` + 给 worklets 的 `getUIRuntimeHolder`/`getUISchedulerHolder` 打桩 | jest 下 worklets 会解析到 **web 变体**，那两个函数在 web 变体里**故意抛错**，而报错发生在 microtask 里、会以"测试失败"的形式出现在别处 |

两个代价，写在这里免得下次惊讶：

- **构建变慢**：reanimated/worklets/gesture-handler 都要为 4 个 ABI 编译原生代码，本地首次 `assembleRelease` 从 1 分半涨到 **11 分半**（增量构建仍快）；CI 上同理。
- **测试日志有噪音**：`draggable-flatlist` 内部给 reanimated 的 `useDerivedValue` 传了 deps 数组，reanimated 4 会重复警告 "Dependencies should only be used on the web"。这是该库写在 reanimated 4 之前的痕迹，不影响行为。

### Android 构建要点（Windows）

- Gradle wrapper 走腾讯镜像并带官方 `distributionSha256Sum`，`networkTimeout=120000`（`android/gradle/wrapper/gradle-wrapper.properties`）。
- React Native 0.87 的 Gradle 插件用 `jvmToolchain(17)`，JDK 21 不满足严格匹配；本机在 `~/.gradle/gradle.properties` 里声明 JDK 17 位置：
  `org.gradle.java.installations.paths=D:/Programs/Java/jdk-17.0.20.1+1`
- 模拟器若出现黑屏 + `adb devices` 显示 `offline`，多半是陈旧的 quickboot 快照：删 `~/.android/avd/<avd>.avd/snapshots/*` 后用 `-no-snapshot` 启动（`quickbootChoice.ini` 的 `saveOnExit=true` 会让它反复复发）。
- debug 与 release 是两条路径：debug APK 里没有 `assets/index.android.bundle`（JS 由 Metro 提供），生产管线要用 `./gradlew assembleRelease` 验证。

## CI（GitHub Actions）

`.github/workflows/ci.yml` 两个 job（push / pull_request / workflow_dispatch 触发，同分支的旧运行会被取消）：

| job       | 内容                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js`      | `npm ci` → `lint` → `typecheck` → `jest --ci`（36 个用例）                                                                                                                                                             |
| `android` | JDK **17**（RN 0.87 的 Gradle 插件严格要 17，JDK 21 不满足 toolchain 请求）→ 安装 NDK 27.1.12297006 / CMake 3.22.1 → `assembleRelease bundleRelease` → 校验 APK 内含 `assets/index.android.bundle` → 上传 APK/AAB 构件 |

CI 上会把 `gradle-wrapper.properties` 的 `distributionUrl` 临时改回 Gradle 官方地址（本地用腾讯镜像是为了速度），`distributionSha256Sum` 本来就是官方校验和，两边都能验证。

### 需要配置哪些 secret

- **JS 检查（lint / typecheck / test）：零 secret。**
- **release 构建：零 secret 也能跑。** 仓库里没有 keystore 时，release 走 debug 签名（`android/app/build.gradle` 里的条件签名），CI 照样产出可安装的 APK/AAB——只是**不能上架**，也无法作为正式更新包分发。
- **要正式签名/上架，才需要 4 个 repository secrets**（Settings → Secrets and variables → Actions）：

  | secret                      | 含义                                                      |
  | --------------------------- | --------------------------------------------------------- |
  | `ANDROID_KEYSTORE_BASE64`   | 你的 release keystore（`.jks`/`.keystore`）的 base64 文本 |
  | `ANDROID_KEYSTORE_PASSWORD` | keystore 口令（`storePassword`）                          |
  | `ANDROID_KEY_ALIAS`         | key 别名（`keyAlias`）                                    |
  | `ANDROID_KEY_PASSWORD`      | 该 key 的口令（`keyPassword`）                            |

  生成与编码：

  ```sh
  keytool -genkeypair -v -keystore release.keystore -alias verbcodex \
    -keyalg RSA -keysize 2048 -validity 10000
  # Windows PowerShell 里做 base64：
  # [Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
  ```

  这四个值同时支持本地使用：写进 `~/.gradle/gradle.properties`（键名同名，如 `VERBCODEX_STORE_FILE=D:/keys/release.keystore`）或设为环境变量，本地 release 构建即自动改用正式签名。**keystore 与口令都不要提交**——`.gitignore` 已经忽略 `*.keystore` / `*.jks`（只放行仓库自带的 `debug.keystore`），但别把安全押在忽略规则上：keystore 一旦丢失，已上架应用就再也无法更新（除非启用了 Play App Signing）。

- **其他**：本 App 无网络请求、无账号、字体已打包，所以不需要 `GOOGLE_SERVICES_JSON` / `MAPS_API_KEY` 之类。将来若要自动发版到 Play，才需要额外的 service account JSON secret。

> 注意：当前工作目录还不是 git 仓库，`git init` 并推到 GitHub 之后 CI 才会真正运行。
