# 变位法典 (VerbCodex)

个人法语变位备忘录（Android / React Native，另有一个可安装的 Web/PWA 目标）。你亲手把学到的动词和它的六行现在时变位写进法典，之后随时翻看、遮盖自测。

原型参照 [demo](demo)（法式纸质笔记风的单页 HTML），本 App 是它的 React Native 重写：同样的纸色、衬线 + 等宽排版，但把"一张卡片"拆成了"一本可以记录、可以翻阅的法典"。

名词阴阳性练习（**辨性** / `Le Genre`）已进 App：首页「⋯」菜单 → `Le Genre`，内置 Lexique 4.1 的 top-1000 **词库**（每词附中文短注），一局 20 题，4 箱 Leitner **复习箱**（见 [ADR 0003](docs/adr/0003-noun-gender-drill-with-builtin-bank.md)）。单页原型 [demo-genre.html](demo-genre.html) 保留作设计参照与词库的第二份拷贝。

## 它是什么，不是什么

- **是**一本记录本：收录动词、逐行写下那个**整词**、另写一段自由**附注**，查看为主，**自测**与**默写**为辅。
- **不是**词典，也不是法语老师：法典不生成变位、不内置任何变位规则。唯一的例外是**词库**——一份内置的 top-1000 名词清单，只回答「这个名词配 le 还是 la」并附一条认词用的中文短注，既不参与变位，也不当词典用（[ADR 0003](docs/adr/0003-noun-gender-drill-with-builtin-bank.md)）。**自测**只能"遮盖 + 点击揭晓"；**默写**会判对错，但判的是"是否与你亲手写下的**记录值**一致"（`trim()` 后逐字一致，区分重音与大小写），不是"法语对不对"——标准是你的，不是它的（[ADR 0001](docs/adr/0001-manual-memo-no-engine.md)、[ADR 0002](docs/adr/0002-dictation-grades-against-recorded-values.md)）。
- 完整术语（动词条目 / 整词 / 分组 / 自测 / 默写 / 记录值 / 词库 / 辨性 / 复习箱）见 [CONTEXT.md](CONTEXT.md)。

## 交互

| 动作                    | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列表页「Salut, \_\_\_」 | 写下你的名字，法典就用它称呼你。名字是**法典**级的一个**记录值**（见 [CONTEXT.md](CONTEXT.md) 的**主人**），随整本法典一起导出、导入。名字与问候语用同一支笔：法典自己的斜体（汉字没有斜体字形，由合成倾斜补上同一角度——Android 的 `Typeface.create(family, style)` 同样会合成）。格子的宽度是固定的，名字在格子里横向滚动——再长的名字也不会把右上角的完成度挤出屏幕                                                                                                                                              |
| 列表页三条分组标签      | 按 `1er (-er)` / `2e (-ir)` / `3e (Irrégulier)` 筛选（新增页里显示完整的 `1er Groupe (-er)`）；标签只是你给的分类，法典不据此推断变位                                                                                                                                                                                                                                                                                                                                                                             |
| 列表页搜索框            | 位置在分组标签与卡片之间——紧挨着它所过滤的那一列。在当前**分组**内即时过滤：匹配**不定式**与六行**整词**，忽略大小写与重音（`etre` 命中 `être`、`coeur` 命中 `cœur`）。命中整词时行下显示那个词（`nous aimons`），否则你不知道这条为什么在屏幕上；不搜**附注**。过滤期间**次序**重排与拖动提示一并停用——拖动落点的索引与行距属于分组，不属于子集。切分组标签不清空检索词，✕ 清空                                                                                                                                  |
| 列表行左端的记号        | 六个**变位行**都写下了**整词**就是完整（画一个 ✓），否则未完整（画一个 ○）。这是从业已写下的**变位行**读出来的事实，不另存字段；记号是画出来的（字体里没有这两个字形），读数走无障碍标签（`6 lignes sur 6`）。记号用比 accent 浅一档的棕，并与行尾的 › 同心：它是一条记录，不是一个按钮                                                                                                                                                                                                                           |
| 点击某行                | 进入该**动词条目**的查看界面（不定式与六行变位就地可改）。详情页左上角的返回标签写的是**身后的列表所站的那个分组**（`‹ 1er`）——打开时随路由一起带过来，所以条目后来被改换分组，这个标签也不会跟着改口。不再是一个总称——法典里也收助动词，`Verbes` 名不副实                                                                                                                                                                                                                                                        |
| 详情页顶部「Supprimer」 | 删除该**动词条目**，两次点击确认，不弹对话框：第一次点按只是提问——那两个字换成下划线正体的 `Vraiment ?`，3 秒无人回答就自己收回；第二次点按才真的删掉并返回列表。问题写在条目所在的那张纸上，不盖在它上面。破坏性操作放在这里，是为了让列表行只剩“点按打开 / 长按拖动”两个手势，不必用计时器或位移阈值去消解歧义                                                                                                                                                                                                  |
| 详情页顶部「Déplacer」  | 改换该**动词条目**的**分组**：点开后在这一行的正下方就地列出三个**分组**（清单页那三个标签的原话，当前分组带一条 terracotta 下划线），点另一个即改换并收起。条目落到新**分组**次序之末——与**收录**时的落点一致——不留在旧分组里的那个位置；左上角的返回标签仍指向身后的列表                                                                                                                                                                                                                                        |
| 详情页「Notes」         | 卡片下方的多行自由文本框：记发音、用法、任何想留下的东西；自测与默写时都隐藏（提示与答案是同一张纸的两面）                                                                                                                                                                                                                                                                                                                                                                                                        |
| 长按某行后拖动          | 在**分组**内重排**次序**，松手即落盘。Android：按住 400ms 拿起（**同一个手势**负责拿起与跟手；按住期间手指走过系统触摸阈值（touch slop，约 8dp）即失败，所以滑动列表不会误拿起）。桌面浏览器：按住 400ms 后拖动；触摸浏览器不提供（HTML5 拖放不响应手指），理由见 [docs/spike-web.md](docs/spike-web.md)                                                                                                                                                                                                          |
| 标题行右侧的「⋯」       | 点开一个小菜单（两项）：`Sauvegarde` 导出 / 导入整本法典（JSON）；`Le Genre` 进入**辨性**（见「辨性」一节）。导入是替换并先确认（见「备份与恢复」一节）                                                                                                                                                                                                                                                                                                                          |
| 「⋯」里的 `Le Genre`    | 进入**辨性**门厅：`Commencer` 开一局 20 题（法语词 + 中文短注，答 `le` 还是 `la`）；`La Révision (N)` 只抽到期的词，答对升箱（1→4，间隔 0 / 1 / 3 / 7 天）、第 4 箱答对**毕业**，答错回第 1 箱；`Vider la Boîte (N)` 两次点击才清空。箱落盘，但不随备份导出 / 导入移动                                                                                                                                                                                                                                                                    |
| 「+ Nouveau」           | 输入不定式、选分组 → 直接落到新条目上填写（六行初始为空，每行显示 `…`）                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 「S'entraîner」         | 进入自测：**整词**全部遮为 `…`，点哪一行揭晓哪一行；「Tout révéler」退出。返回键先退练习（自测 / 默写），再退页面（Android 的硬件返回键；web 上没有这个键）                                                                                                                                                                                                                                                                                                                                                       |
| 「Écrire」              | 进入**默写**：六个**变位行**清空，你逐行重写**整词**（人称代词仍留在眼前），写完按「Vérifier」**整卷批改**。判定拿你此刻写的去比你亲手写下的**记录值**（`trim()` 后逐字一致，区分重音与大小写，不做逐字符 diff）。错的行整词划线并抖一下、仍可编辑，改一个字划线即退场、下一轮重新判；对的行以墨绿落定并锁定。六行全对后：首判全对盖 `✦ Sans faute ✦`，订正后全对盖次级的 `Bien corrigé`，然后「Encore」再来一张或「Continuer」回查看。六行没填满（列表上是 ○）时这个键置灰；**退出即焚**——默写不打分、不存次数、不留历史 |

首次启动会写入三条示例条目（aimer / finir / aller，即 demo 卡片上的那三个），可随意修改或删除（删除在详情页顶部）；删空之后不会再次写入。

代词第一行按该行记下的**整词**首字母显示 `j'` 或 `je`（元音及 h 前省音，`ai` 这种两个字母的整词同样算）——这是排版便利，不是语法判断。

## 开发

```sh
npm install
npm start              # Metro
npm run android        # 构建并安装到已连接的设备/模拟器
npm test               # jest：263 个用例，覆盖领域逻辑（含备份信封、主人名、旧数据迁移、默写判定、辨性的 4 箱 Leitner 与抽题、一局的锁定与结算纸、拖动自动滚动的算式与搜索的折叠/匹配）、
                       #        存储（含主人名与复习箱）、组件（变位行、默写行、列表行、搜索框、⋯ 菜单、辨性题卡）、列表页、详情页（含自测与默写）、
                       #        辨性两屏（门厅 / 一局）与 App 装配
npm run typecheck      # tsc --noEmit
npm run lint
```

### 目录

```
App.tsx                     导航装配（native-stack）+ 启动时载入法典、切后台时落盘
src/types.ts                领域类型、六行代词、分组标签、代词省音
src/domain/verbs.ts         纯逻辑：建条目、改行、进度、容错读盘（可单测，无原生依赖）
src/domain/search.ts        纯逻辑：折叠（忽略大小写与重音）、匹配、命中提示、过滤（可单测，无原生依赖）
src/domain/backup.ts        备份信封：序列化、文件名、容错解析（纯逻辑，可单测）
src/domain/dictation.ts     纯逻辑：默写判定（trim 后逐字比对、逐行判、首判全对）（可单测，无原生依赖）
src/domain/genre.ts         纯逻辑：辨性的抽题（√词频、无放回）与 4 箱 Leitner、复习箱的容错读盘（可单测，无原生依赖）
src/domain/sitting.ts       纯逻辑：**一局**的值与规则——抽题（词库 / 到期）、作答锁定、逐题推进、结算纸；箱的算术仍归 genre.ts，时钟与随机流走参数（可单测，无原生依赖）
src/storage/verbStore.ts    AsyncStorage 存储 + 订阅（存储接口可注入，测试无需原生 mock）
src/storage/asyncStorageAdapter{,.web}.ts  原生走 AsyncStorage，web 走 localStorage
src/storage/ownerStore.ts   **主人**名字的存储：一个键、立即落盘、不防抖（名字不是一个字一个字值得等的输入）
src/storage/genreStore.ts   **复习箱**的存储：只收**一局**算好的账（`apply`）、一题一次立即落盘；不随备份移动
src/platform/               平台分包：导入替换的确认（Alert / window.confirm）、备份落地（Android 分享面板 / web 文件）、能否用鼠标拖动重排（`reorderByDrag`）、收起输入法时是否收起焦点（`blurOnKeyboardHide`）
src/data/seed.ts            首启的三条示例条目
src/data/nouns.ts           内置**词库**：top-1000 名词 + 中文短注（`tools/make-nouns.py` 生成，勿手改）
src/screens/                列表 / 详情（含自测与默写态）/ 新增 / 辨性的门厅与一局
src/components/             Screen、分组标签、搜索框、变位行、默写行、印章、列表行、⋯ 菜单、辨性题卡、按钮；VerbList(.web) 是拖动列表及其 web 双胞胎
docs/adr/                   决策记录：0001 不含变位引擎（判定没有外部标准）；0002 默写以**记录值**为唯一比对标准
web/main.tsx                web 入口（AppRegistry.runApplication）
index.html                  web 挂载点（#root 必须是 flex 容器，原因见 spike 文档）
vite.config.mts             web 构建配置（精确 alias / 扩展名顺序 / optimizeDeps 排除）
assets/fonts/               字体源文件（构建时同步进 android/app/src/main/assets/fonts）
```

### 备份与恢复

列表页标题行右侧的「⋯」菜单里有 `Sauvegarde`，进入导出 / 导入。导出文件是一个带格式版本的信封，缩进过、可读也可 diff：

```json
{ "app": "verbcodex", "format": 2, "exportedAt": "2026-10-15T12:34:56.789Z", "owner": "…", "verbs": [ … ] }
```

- **名字随信封走**：信封里多一个可选的 `owner`（没记名字就不写这个键）。格式版本**没有**跟着动，`2` 仍是最新的——旧版本读到它只是不看这个字段、条目照常恢复；本版本读到没有该字段的文件，就当这本法典从没记过名字。导入时**备份里有名字才覆盖**本机的名字，没有就不动它：一个空字段不该抹掉你已经写下的名字。
- **导入是替换，不是合并**：确认对话框会写明"当前 N 条会被替换"。合并看起来更友好，但它必须先回答"同一条各改了一半听谁的"，而法典的立场是记录由你负责；不可预测的自动合并比明确的替换更糟。
- **读盘一律容错**：坏条目被丢弃、缺字段补默认值（复用存储层同一套 coercion）；格式 1 的旧备份（一行分**词干**与**词尾**两段）照样导入，两段在读取时拼回**整词**；但**格式版本比你新时明确拒绝**，而不是静默导入成空法典——那会让你以为数据还在。
- **平台差异**：Web 是真文件（下载 / `<input type="file">`）；Android 是分享面板 + 粘贴，因为文件选择器要再加一个原生依赖、再一次四 ABI 编译，这个功能不值当。这条缝在 `src/platform/backupFile{,.web}.ts`。
- 导出**不会**上传任何东西：这个应用没有后端。

### 辨性（Le Genre）

首页「⋯」菜单的第二项。它是法典唯一自带法语知识的地方，而那份知识只有一位：**词库**条目里写着的阴阳性（[ADR 0003](docs/adr/0003-noun-gender-drill-with-builtin-bank.md)）。

- **一局 20 题**：从**词库**按词频加权（权重取 `√f`）无放回抽取，局内不重复。题卡上法语与**中文短注**一起出现——认词不是考点——你只答 `le` 还是 `la`。
- **答错进入复习箱第 1 箱**（当场到期）；练习中答对不入箱。复习只抽到期的词，答对升一箱（间隔 0 / 1 / 3 / 7 天），第 4 箱答对即**毕业**并移出；答错一律退回第 1 箱，无论它原来在几箱。
- **箱里只记词形、性别与箱号**，不存短注的副本：复习卡按词形回**词库**取那一行中文。词库日后若删掉某个词，题照出、短注留空——箱里的账是用户的，不因词库改版而丢。
- **落盘**：键 `verbcodex.genre.v1`（Android 走 AsyncStorage，web 走 localStorage），一题一次立即写、不防抖，切后台再 flush。它**不随导出 / 导入移动**：备份只含**动词条目**与**主人**名，与**词库**一样留在本机。
- **一局是一条纯逻辑**（`src/domain/sitting.ts`）：抽题（练习局看词频、复习局看到期）、作答后锁定、逐题推进与结算纸都在那里，时钟 `now` 与随机流 `rand` 是参数；`genreStore` 只收**一局**算好的账（`apply`）并落盘，不判对错、不读表。所以「一局的规则」可以对着一个值断言，不必按过二十张题卡。
- **不存分数**：结算只是纸面——练习纸写对错与错词清单，复习纸写升箱 / 毕业 / 退回的条数。退出即散，法典不记次数与历史；`Vider la Boîte (N)` 是两次点击确认，清空它不损失任何**记录值**。
- **词库再生**（只在改词库时跑，产物已提交）：
  ```sh
  python tools/make-nouns.py --glosses tools/nouns-glosses.json --ts --out src/data/nouns.ts
  ```
  产物是生成物，已列进 `.prettierignore` / `.eslintignore`；`demo-genre.html` 里那份内联词库由同一脚本的 `--js` 产出，两处逐项相同。词库来自 Lexique 4.1（CC BY-SA 4.0），筛选、正字与 STOPWORDS 规则见脚本 docstring。

### 字体

Newsreader 与 JetBrains Mono 以**静态实例** TTF 打包（`assets/fonts`），构建产物读的是 `android/app/src/main/assets/fonts`。Android 以**文件名**作为字体家族名，所以每个字重都是独立家族，样式里不设 `fontWeight`，避免被合成加粗：

```
NewsreaderRegular / NewsreaderMedium / NewsreaderItalic
JetBrainsMonoRegular / JetBrainsMonoMedium
```

之所以不用 Google Fonts 的变体字体（`Newsreader[opsz,wght].ttf`）：资产目录加载拿不到变体轴，`fontWeight: 500` 会静默退化成默认字重。静态实例来自上游 [productiontype/NewsReader](https://github.com/productiontype/NewsReader)（`fonts/static/ttf`，OFL）与 [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) v2.304（OFL）。

汉字走的是同一张脸的中文替身。Newsreader 只有拉丁字形，**附注**里写汉字时浏览器/系统会退到随便一个衬线字体上，于是汉字由 [Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)（OFL）补上，两者**合并成一个文件**：

```sh
pip install fonttools
python tools/make-fonts.py     # 首次会从上游拉 ~24 MB 的变量字体
```

- **只取用得上的字**：字符集是 GB2312 全集（6763 汉字 + 682 符号），再补上这个标准没有的 10 个符号（`—` `–` `·` `¶` `†` `‡` `•` `€` `£` `¥`），共 7455 个码位（枚举 codec 得到 7445，余下 10 个是补的）。不这么做就是 Noto Serif SC 的完整字集（覆盖 GB18030），每个字重 10 MB 起步，而这里的汉字只会出现在**附注**里。
- **两条腿一样高**：Noto 的 em 是 1000、Newsreader 是 2000，直接塞进一个文件会让汉字比拉丁字**小一半**。脚本先把 Noto 实例化成静态字重、`scale_upem` 到 2000，再合并。
- **竖排的东西一并丢掉**：`vert`/`vrt2`/`vpal`/`valt`/`vkna`/`vrtr` 特性，以及只存在于 CJK 字体的 `vhea`/`vmtx`/`BASE`/`STAT`/`VORG`/`DSIG` 表。这个 App 不竖排，而这些正是合并器会断言失败的那部分——它们没有对应的拉丁表可以合并（`Expected all items to be equal: [NotImplemented, 0]`）。
- 家族名按**文件名**取（Android 的规矩），所以是 `NewsreaderHanRegular` / `NewsreaderHanMedium`，同样不设 `fontWeight`。样式表里两端写法不同：Android 只用合体字（字体文件里两种字形都有），web 用 `NewsreaderRegular, NewsreaderHanRegular` 的字体栈（`web/fonts.css` 给合体字写了 `unicode-range`，拉丁字母仍由 Newsreader 原文件渲染）。
- **拉丁字形没有被合并动过**：合并后 `a`/`é`/`œ`/`A`/`j` 的字宽与边界与上游文件逐字节相同，合字与 hinting 表（`cvt `/`fpgm`/`prep`）都还在；汉字的字宽是 2000，即满一个 em。

### 图标

应用图标由 [favicon.jpg](favicon.jpg)（1194²、鼠尾草绿底 `#ABBD95`）生成。换图后重新生成，别手工替换 `mipmap-*` 里的 PNG：

```sh
python tools/make-icons.py     # 需要 Pillow
```

脚本同时产出三套并写出 `screenshots/icon-preview.png` 供肉眼确认：

- **自适应图标**（API 26+，即绝大多数设备）：`mipmap-anydpi-v26/ic_launcher{,_round}.xml` = 纯色底 `@color/ic_launcher_background` + 透明前景层。前景缩放由**实测**的主体半径算出（实测 0.388 → 缩放 0.838），确保落在 72dp 安全圆内，圆形/方圆/水滴蒙版都不会切断主体。
- **传统方形/圆形**（minSdk 24，API 24/25 仍需要）：全出血，形状直接烘焙进 PNG。
- 抠背景用"从边框 flood fill"而不是全局色阈：插画领口那道绿边与底色接近但**不连通**，全局阈值会把它一起抹掉。

### 拖动与手势（3 个原生依赖）

长按拖动重排由 `src/components/VerbList.tsx` 自己实现，手动接上 `react-native-gesture-handler` 与 `react-native-reanimated`（后者在 4.x 又把 worklet 变换拆到了 `react-native-worklets`）。四处接线，缺一处就报错：

| 位置              | 内容                                                                                                       | 为什么                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `babel.config.js` | `react-native-worklets/plugin`（必须放最后一个插件）                                                       | reanimated 4 的 worklet 变换已搬到 worklets，`react-native-reanimated/plugin` 只是它的再导出                                           |
| `metro.config.js` | `wrapWithReanimatedMetroConfig`                                                                            | 对纯 Android 只有堆栈折叠生效，其余分支是 `.windows` 兜底                                                                              |
| `App.tsx`         | `GestureHandlerRootView` 包住全树                                                                          | gesture-handler 的检测器必须挂在这个根视图之下                                                                                         |
| `jest.setup.js`   | `react-native-gesture-handler/jestSetup` + 给 worklets 的 `getUIRuntimeHolder`/`getUISchedulerHolder` 打桩 | jest 下 worklets 会解析到 **web 变体**，那两个函数在 web 变体里**故意抛错**，而报错发生在 microtask 里、会以"测试失败"的形式出现在别处 |

**拿起与跟手是同一个手势**：`Gesture.Pan().activateAfterLongPress(400)`。它同时解决两件事，而这两件事曾经互为代价：

- **滑动不误拿起**：按住期间手指走过系统的触摸阈值（`scaledTouchSlop`，约 8dp）即失败，这个判定在**原生手势层**（`PanGestureHandler.shouldFail()`），与 JS 事件是否送达无关。RN 的 `Pressability` 做不到——它只在**收到 JS 触摸移动事件**时才取消长按计时器，而列表滚动时这些事件不保证送达，于是随手一次滑动可能在 400ms 后把行"拿起"、并关掉 `scrollEnabled`，列表就再也滚不动。
- **拿起后真的跟手**：跟踪手指、松手落位、`scrollEnabled` 的开关全在这一支手势手里。曾经的写法是"库内部的 pan + 行上再挂一个长按手势"：长按一激活就按默认仲裁**取消了那个尚未激活的 pan**（库不暴露内部手势引用，无法声明 simultaneous），于是手指不再被跟踪、`onTouchesUp` 也不再送达，`activeKey` 与 `scrollEnabled` 一起卡住——列表滚不动、拿起即跳、松手才交换、交换完再跳一下。单手势没有这个仲裁可输。

`Pressable` 的 `onLongPress` 仍留一个空函数：RN 在没有长按处理器时，长按后松手也会触发 `onPress`（拿起又原地放下会跳进详情页），空函数用来吞掉那一次。`onFinalize` 在手势结束时**必然**触发，所以没有任何路径能把 `scrollEnabled` 留在关闭状态。

两个代价，写在这里免得下次惊讶：

- **构建变慢**：reanimated/worklets/gesture-handler 都要为 4 个 ABI 编译原生代码，本地首次 `assembleRelease` 从 1 分半涨到 **11 分半**（增量构建仍快）；CI 上同理。
- **列表自己做，就得自己扛细节**：落点间距取**实测**的一行高度（法典六行卡片同高，行高即间距），字体缩放跟着变；行不再被裁剪（`removeClippedSubviews={false}`），换来的是行高可测、下方行能及时让位；拖到屏幕边缘时的自动滚动由 JS 定时器每 16ms 推一次，那份"离边缘多远推多快"的算式是纯函数（`src/components/verbListAutoScroll.ts`，有单测）。

### Android 构建要点（Windows）

- Gradle wrapper 走腾讯镜像并带官方 `distributionSha256Sum`，`networkTimeout=120000`（`android/gradle/wrapper/gradle-wrapper.properties`）。
- React Native 0.87 的 Gradle 插件用 `jvmToolchain(17)`，JDK 21 不满足严格匹配；本机在 `~/.gradle/gradle.properties` 里声明 JDK 17 位置：
  `org.gradle.java.installations.paths=D:/Programs/Java/jdk-17.0.20.1+1`
- 模拟器若出现黑屏 + `adb devices` 显示 `offline`，多半是陈旧的 quickboot 快照：删 `~/.android/avd/<avd>.avd/snapshots/*` 后用 `-no-snapshot` 启动（`quickbootChoice.ini` 的 `saveOnExit=true` 会让它反复复发）。
- debug 与 release 是两条路径：debug APK 里没有 `assets/index.android.bundle`（JS 由 Metro 提供），生产管线要用 `./gradlew assembleRelease` 验证。

## Web / PWA

`npm run web` 是 HMR 开发服务器，`npm run web:build` 产出可部署的 `dist/`。功能齐备（列表、分组筛选、详情、附注、新增、自测、**默写**、删除、持久化、搜索、导出/导入、**次序重排**），dev 与构建产物渲染逐像素一致。**次序**两端都能调，触发方式各随其平台：Android/iOS 长按拿起，桌面浏览器按住 400ms 后拖动（`VerbList.web.tsx`）——触摸浏览器仍不提供，因为 HTML5 拖放不响应手指，而把触摸拖拽做对（不伤滚动）是 RNGH 在原生侧才有的仲裁能力。

web 的重排不走原生那套：原生列表由 reanimated 驱动，而 reanimated 4 的 worklet 变换进不了 Vite 管线（见 spike 文档）。这里改用浏览器自己的 HTML5 拖放，**不加任何依赖**。有一条实测得出的必要设计：浏览器在指针移动 **2px** 后就判定拖放开始，并**吞掉那一次点击**——所以行不是天生可拖，而是**按住 400ms** 才拿到 `draggable`。否则"点开条目"会被一次手抖抢走（实测：2px 抖动即不再跳转），而 2px 的误拖还可能落进某个缝隙、造成非本意的重排。

它现在是一个**可安装、可离线**的 PWA（`vite-plugin-pwa` + workbox 7，见 `vite.config.mts`）：manifest 由插件生成，service worker 预缓存 22 项 / 约 2 MB（外壳 + 5 个字体 + 图标），**断网冷启动可用**（`screenshots/web/web-21`）。两个中文合体字（各约 3.4 MB）**不进预缓存**：它们会把预缓存翻四倍，还会撞上 workbox 单文件 2 MiB 的上限，所以改为一条 `CacheFirst` 运行时规则（`cacheName: 'verbcodex-hanzi'`）——你第一次写下汉字时才去取，取过就不再走网络。代价说清楚：**断网冷启动**时，如果这台设备还没取过汉字，**附注里的汉字会先落到系统衬线字体**（拉丁字与外壳照常离线可用）。

```sh
npm run web         # Vite dev server（HMR）
npm run web:build   # 产出 dist/
npx vite preview    # 预览构建产物：service worker 只在构建产物里存在
```

部署（Netlify）用仓库里的 [`netlify.toml`](netlify.toml)：`npm run web:build` → `dist`，Node 22。两条缓存规则是 PWA 的命门——`/sw.js` 与 manifest 必须 `must-revalidate`（否则新版本会被陈旧 worker 顶住，"下次关掉应用才更新"就永远不成立），而 `/assets/*` 是内容哈希的，可以 `immutable` 长缓存。

### 平台差异与一个诚实的提示

| 位置         | Android                                       | Web                                                                                                                 |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 存储         | AsyncStorage（Room/SQLite，永不被系统清）     | localStorage；启动时申请 `navigator.storage.persist()`                                                              |
| 删除确认     | `Alert.alert`                                 | `window.confirm`（RNW 的 `Alert.alert` 是空函数）                                                                   |
| 返回键       | `BackHandler` 先退练习（自测 / 默写）         | 无此键；RNW 的桩只会 `console.error`，故不注册                                                                      |
| 备份落地     | 系统分享面板导出 + 粘贴导入                   | 真文件下载 / `<input type="file">`                                                                                  |
| **次序**重排 | 按住 400ms 拿起后拖动（同一个手势判定与跟手） | 按住 400ms 后鼠标拖动（HTML5 拖放）；触摸浏览器不提这件事，提示词也不出现（`src/platform/reorderByDrag{,.web}.ts`） |

**关于持久化**：`persist()` 不是万能的。实测 Chromium 在 localhost 上直接返回 `false`（它按"安装状态 / 站点参与度"自行决定、不弹窗；Firefox 才会询问），**用户主动清理与 InPrivate 也从来挡不住**。所以当它返回 false 时，备份屏会明说一句"这个浏览器可能不留情面地清掉数据"——[screenshots/web/web-20](screenshots/web/web-20-backup-evictable-warning.png) 就是它出现的样子。这是提示，不是装饰。

完整结论、证据截图与"拖动在 web 上为何只能另起一套"见 **[docs/spike-web.md](docs/spike-web.md)**。

## CI（GitHub Actions）

`.github/workflows/ci.yml` 四个 job（push / pull_request / workflow_dispatch 触发，同分支的旧运行会被取消）：

| job       | 内容                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js`      | `npm ci` → `lint` → `typecheck`（原生与 web 两个 program）→ `jest --ci`（246 个用例）                                                                                                                                  |
| `android` | JDK **17**（RN 0.87 的 Gradle 插件严格要 17，JDK 21 不满足 toolchain 请求）→ 安装 NDK 27.1.12297006 / CMake 3.22.1 → `assembleRelease bundleRelease` → 校验 APK 内含 `assets/index.android.bundle` → 上传 APK/AAB 构件 |
| `web`     | `npm ci` → `npm run web:build` → 断言产物真的构成一个 PWA（manifest、sw.js、两种尺寸图标、7 个字体——含两个中文合体字——都在），并上传 `dist/` 作为构件                                                                  |
| `release` | 只在 `v*` tag 上运行，`needs: android`：取回该次运行的 APK/AAB 构件、改名为带版本号的文件，用 `gh release create --clobber` 挂到该 tag 的 GitHub Release 上                                                            |

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

> 打 tag 即发版：`git tag v0.1.0 && git push origin v0.1.0` 触发 `android` 构建，随后 `release` job 把 APK/AAB 挂到该 tag 的 Release 上——构件本身 14 天过期，**Release 资产不过期**，这才是可分发的产物。
