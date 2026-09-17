# 首页唯一宿主 composer — 实现与验证

日期：2026-09-13。范围：SPEC-R001-S01-003 与 UI-HOME；TEST-R001-S01-004/008 的首页输入专项。Spec 2.1.1 SHA-256 `5facedd3c2b71c46ec8b8aec492c62159f195ddc56fb9ad2f764a92a4f7107a6`；Test Design 2.0.1 SHA-256 `250dbb144a5853c2e90296af6ddc57b4a7729c8aa6d4cbc396e27e57d1645cf7`。完整 S01 QA 仍 blocked。

## 实现

Hero 通过 `mountComposer` 挂载宿主真实编辑器，删除手工 textarea 与独立“开始研究”提交路径。宿主维护稳定 portal 容器、Session 注册与准入后回调；首页普通发送成功准入后打开当前 Session Chat。失败、过期注册、离开页面或切换 Session 不触发旧导航。待处理交互回到底部，结束后恢复首页位置。嵌套 React root 的事件隔离防止工具栏动作重复分发。

源码 revision：`a23ee9233b5bc8c6a44cce2c2d29a717f872b2d4` 加工作区改动。Node v25.6.0；pnpm 11.7.0；macOS arm64。行为源码 fingerprint：`54f5d56566993aeaaed73d8e3858776c11cb61703e1c6337e210c20397ec0f89`，算法为排序的相对路径、NUL、文件 SHA-256、LF 后整体 SHA-256；覆盖 ui-conversation 的 composer-outlets、contract/composer-outlet、contract/slots、apply、input/hub、skeleton/{ResidentComposer,ConversationRoot,ConversationSession,InputBar} TS/TSX 与两个 CSS，以及医学 home.tsx、views.css。

## 已执行检查

| 检查 | 结果与范围 |
|---|---|
| `pnpm exec vitest run packages/client/ui-conversation packages/client/ui-chat/tests/chat-view.client.spec.tsx packages/client/ui-tool/tests/chat-code-subcalls.client.spec.tsx packages/client/ui-trajectory/tests/views.client.spec.tsx` | 35 files / 515 passed；唯一编辑器、移动、默认输入路径、注册释放、失败恢复和旧回调隔离 |
| `pnpm exec vitest run packages/client/ui-conversation/tests/skeleton.client.spec.tsx` | 补充待处理交互停靠回归后，25 passed |
| `pnpm --dir plugins/med-research exec vitest run packages/plugin-medical-ui/tests/views.client.spec.tsx packages/plugin-medical-ui/tests/client-plugin.client.spec.tsx` | 2 files / 26 passed |
| `pnpm exec tsc -p packages/client/ui-conversation/tsconfig.json --noEmit`；`pnpm --dir plugins/med-research typecheck` | 两者通过；宿主与医学接口消费者编译 |
| `pnpm run build` | 通过；后续 composer 修正另执行包 bundle |
| `pnpm --filter @deepseek-ai/dsh-client-ui-conversation bundle`；`pnpm --dir plugins/med-research run verify:client` | 通过；宿主客户端与医学 loader 产物 |
| 四组修改文档的 `verify-translation-pairing`；`verify-client-catalog`；定向 oxlint；`git diff --check` | 通过；不代表全仓 lint/doc-sync 通过 |

## 真实浏览器

运行入口为 `pnpm dsh --profile med-research --port 3100` 的实际开发服务器，加载 checkout 构建的 Web 与医学客户端。1672×941、1440×900、390×844 检查首页；390px 时 composer 为 x=70、width=298，发送按钮 right=360，页面宽度为 390，无横向溢出。语言检查保留用户草稿并核对宿主控件。

首页普通消息准入后打开同一 Session 的 Chat；DOM 对象身份比较证明编辑器没有重建，返回首页仍只有一个编辑器。输入使用浏览器原生 Input.insertText 验证单次追加；灵感替换草稿但不发送。权限菜单与模型/推理等级菜单实际打开。截图：[中文桌面 1672](screenshots/home-composer-1672-zh.png)、[中文桌面 1440](screenshots/home-composer-1440-zh.png)、[中文窄屏 390](screenshots/home-composer-390-zh.png)、[English 1672](screenshots/home-composer-1672-en.png)、[English 1440](screenshots/home-composer-1440-en.png)、[English 390](screenshots/home-composer-390-en.png)。

初次并行启动 3101 与已有 profile 进程争用同一 Session 写句柄，发送失败并恢复草稿；已停止 3101，后续使用原 3100 进程。构建期间混用热更新产物曾使 composer slot 注入失败；完整重载后消失。嵌套渲染根导致菜单重复分发的问题已修正并增加独立根组件回归。

附件实测使用本轮创建的 69B 无患者数据文本 `med-composer-probe.txt`：上传从“上传中”变为“TXT 69B”，首页→研究→首页仍保留文件卡与同一编辑器，随后通过移除按钮清理该测试附件。未将附件发送给模型。见[附件截图](screenshots/home-composer-attachment.png)。

## 未通过或未覆盖

- 实际消息准入和 Chat 切换已执行；模型返回 `MISSING_CREDENTIAL`，未验证成功模型回复。附件上传、跨 View 保留与移除已实测，模型消费附件未实测。
- keyless Web replay 与 geometry e2e 已尝试，两个文件在初始化阶段因当前 checkout 缺少 `deepseek-llm-api-extensions/lib/index.js`、`session-log-deepseek/lib/index.js` 等宿主产物及旧导出不一致而失败，15 tests 未运行。已为 replay 场景增加单一 resident editor 与提交前后身份断言，不能声称此 lane 通过。
- 全仓 GUI 首轮 4648 passed / 3 failed；本次 inline 样式冲突已修正。定向复查剩余两个失败来自既有 TabList 的 1px 中性边框和 ui-theme elevated token 期望。
- 全仓 lint、test:docs、doc-sync 未通过，涉及既有 workbench README/翻译、piBridge service 分类、UiConversation 类 JSDoc、其他生成目录等。本次新增 JSDoc、定向 lint、翻译配对与 client catalog 已单独复查。
- 390px 英文页面的既有 Session 顶栏存在拥挤重叠；本次首页输入区和按钮均在可见范围，顶栏未在此局部修正中调整。
- 此证据不覆盖完整 Project/Mode/备份、真实审批请求、医学质量评估或 S02–S08，不构成 S01 或 R001 accepted。

## Fresh profile verification — 2026-09-16

Environment: running `med-research` profile at `http://127.0.0.1:3100/`, viewport 1476×732, ego-browser task space 42. The fresh page rendered the Research Home with the Project selector, mode selector, composer, model selector, and send control visible in one viewport. Screenshot: `./screenshots/fresh-profile-home-20260916.png`.

Observed limitation: the page still renders two `打开研究工作区` controls, and this run did not submit a model request because no credentialed model round was authorized by the environment. This evidence confirms the composer is visible and not covering the main home content; it does not close the broader S01 visual finding or establish model-chain acceptance.

Product decision (2026-09-17): retain both entry points with distinct semantics. The quick-access entry uses `home.quick.pubmed` (`PubMed 检索`), while capability cards use `home.card.open` (`进入`) to open the broader research workspace. No code change is required for this distinction.
