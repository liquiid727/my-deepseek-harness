# 常见坑与排错（基于 weather-plugin / ecom-details-image-plugin 真实踩坑记录）

## 目录
- [环境与构建报错速查](#环境与构建报错速查)
- [运行时报错速查](#运行时报错速查)
- [设计上的常见坑](#设计上的常见坑)
- [调外部生成 API（图片/视频/长任务）的坑](#调外部生成-api图片视频长任务的坑)
- [调试技巧](#调试技巧)

## 环境与构建报错速查

| 报错/现象 | 原因 | 解决 |
| --- | --- | --- |
| dsh 启动即崩，报 `Promise.withResolvers` 不是函数 / `createZstdDecompress` / `stripTypeScriptTypes` 缺失 | **Node 版本太旧**（需 22+） | 升级 Node 22+；本机有多个 node 时用 22 的 node.exe 跑 dsh 与 build |
| `npm install` 后构建找不到 `@deepseek-ai/*` | junction 链接被 npm install 清掉 | link_deps 必须在 npm install **之后**再跑（build.ps1 已按此编排） |
| `Cannot find module 'dsh-tools'` 等 | 宿主依赖未链接 | 核对 `scripts/link_deps.py` 里的缓存路径是否指向你的 npx 缓存；手动跑一次 |
| `mklink /J` 需要管理员权限 | Windows 符号链接特权 | link_deps.py 用 `mklink /J`（junction），**不需要**管理员权限；别用 `New-Item -ItemType SymbolicLink` |
| tsdown 报 `Promise.withResolvers` | tsdown 0.22+ 也要 Node 22 | Node 20 环境用 `tsdown@^0.19.0` |
| npm 报 peerDependencies 冲突 | dsh 各包 peer 相互引用 | `npm install --legacy-peer-deps` |
| PowerShell 5.1 执行 build.ps1 中文乱码 | PS 5.1 默认编码 | 脚本输出用纯英文；或 `-ExecutionPolicy Bypass` 运行 |
| 产物里有 `import(` 或多 chunk | 浏览器端动态 import / 拆包 | 改静态 import；tsdown 配 `inlineDynamicImports: true`；确认没误引 Node 端源码 |
| 前端报 `__ModuleLoader__ is not a function` | `lib/client.js` 缺少 banner/footer 包装 | 按 tsdown.config.ts 配置 ModuleLoader banner/footer |

## 运行时报错速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 工具没出现 | 未注册 / profile 没装插件 | `dsh plugin --profile <名> add file:<绝对路径>` 自动加入 bundles；确认插件已构建出 `lib/index.js` |
| 改了代码但行为没变 | **file: 依赖是复制，pnpm 不感知更新** | 改代码后重构建，再 `python scripts/sync_profile.py` 同步产物到 profile |
| 模型从不调用工具 | description 没写"何时用" | 重写 description（做什么+何时用+注意）；考虑加系统提示引导 |
| 工具返回了但前端没渲染 | meta 缺失 / keyed toolview 未注册 | 确认 `presentationMeta` 有数据；确认 `ctx.slots.register` 的 `key` 与工具名一致 |
| 前端空白/报错 | 沙箱 CSP 拦截 / 客户端注入缺失 | 浏览器端必须单文件无动态 import；package.json 配 `dsh.client.inject` |
| 中文城市 geocode 查不到 | 第三方 API 语言问题，非代码 bug | 换英文名或换 API（weather-plugin 用 Open-Meteo，"纽约"中文无结果，北京/上海/London 正常） |
| 中文乱码 | 编码/终端 | 源码用 UTF-8；PowerShell 5.1 中文输出改英文 |

## 设计上的常见坑

1. **把大内容塞进 output** → 挤占模型上下文。改：output 只留一句话，结构化数据进 `presentationMeta`。
2. **浏览器端重跑 Node 逻辑** → 重复计算、可能泄露权限。改：Node 算好放进 meta，浏览器只渲染。
3. **技能正文全量常驻** → 上下文爆炸。改：候选清单常驻、正文按需 `get`。
4. **fetch 写死、不可注入** → 无法测试、难以替换。改：可注入 fetch。
5. **配置项硬编码在代码里** → 用户无法覆盖。改：全部进 `Config`（schemastery z.object），默认值 + 用户 patch 覆盖。
6. **业务失败直接 throw** → 模型误判"工具坏了"。改：外部服务失败返回结构化结果；参数错误才 throw。
7. **模板/日志里出现密钥** → 安全事故。改：凭据只从配置文件读取（如 `~/.dsh/.credentials.yaml`），绝不硬编码/回显。
8. **只测集成不测纯函数** → 大而慢的测试，回归难定位。改：优先纯函数契约测试（fragment）。

## 调外部生成 API（图片/视频/长任务）的坑

> 本节来自 ecom-details-image-plugin（apimart 图片 API）真实实测踩坑。凡是"调外部图片/视频/长作业 API"的插件都要注意。

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 直连第三方 API 超时/失败，但浏览器能访问 | 受限网络，需走本地代理 | 插件内用 undici `ProxyAgent` 逐请求注入代理（不是依赖进程全局代理） |
| undici v7 `new ProxyAgent('http://...')` 无效，仍直连超时 | **undici v7 的 ProxyAgent 必须传对象**，字符串形式不生效 | 改 `new ProxyAgent({ uri: 'http://...' })`；用"出口 IP 是否变化"验证代理真的生效 |
| 运行时改 `process.env.HTTPS_PROXY` 不生效 | fetch 在进程启动时已初始化 dispatcher，事后改 env 无效 | 代理/密钥必须在进程启动前注入（插件 Config 或启动时环境变量） |
| 工具**每次**调用都被运行时校验拒绝，报 `value.xxx 不在声明的属性中` | 工具 `output.schema` 配了 `additionalProperties:false`，但 `execute()` 返回值带了 schema 未声明的字段 | `execute()` 返回值字段必须与 schema 声明**完全一致**；漏一个就拒一次（headless 实测最典型的"工具被拒"原因） |
| 改码后 web 行为没变 / 插件加载失败 | `file:` 安装是复制，pnpm 不感知更新；且 `sync_profile.py` 若中途失败（如 copytree 报错）会**删掉 profile 里的 lib** | 改码 → 重构建 → `sync_profile.py`（确认成功）→ **重启 dsh**；同步后检查 profile 插件目录 `lib/index.js` 存在 |
| 轮询偶尔 `ECONNRESET` / TLS 重置后任务失败 | 代理链路对频繁/长连接不稳定 | 轮询 GET 加**有限重试**（3 次、递增间隔）；任务本身可能已成功，可先查任务状态再下结论 |
| 参考图是本地文件、没有公网 URL | 工具参数只能传字符串 URL，模型看不到本地路径 | **图生图 API 支持 base64 data URI 时，工具参数直接支持"本地文件路径"**：execute 里检测到 `image_url` 是本地路径（非 http/data: 开头）→ 用 `node:fs` 读文件 → 转 `data:<mime>;base64,...` → 传给 API（ecom 插件已实现，实测通过） |
| 聊天上传的附件图无法作为工具参考图 | dsh 聊天上传的图片是内部附件（blob/attachment），**没有公网 URL**；模型在 tool call 里拿不到附件，会退化成"用文字描述"做文生图（不是真图生图），甚至报 `tool call aborted` | **插件直接读 dsh 附件存储**（已实现，实测通过）：① 上传的附件落盘在 `<DSH_HOME>/attachments/v1/objects/<2hex>/<sha256>`（content-addressed、无扩展名，DSH_HOME 默认 `~/.dsh`）；② 工具 `image_url` 支持特殊值 `"attachments"`，插件扫描该目录、按文件头嗅探图片类型（PNG/JPEG/WebP/GIF magic bytes）、取 mtime 最新的图片转 base64 data URI 传给生图 API；③ 系统提示明确告诉模型"用户通过上传按钮上传了参考图 → image_url 填 `attachments`，不要问用户要路径"（实测模型会正确照做）。注意：附件去重（同图只存一次）导致 mtime 不随重传更新，多会话混用时"最近附件"可能不是刚传的图 |
| 生成长任务（图片/视频）前端白屏 | 工具跑动几十秒，无渲染反馈 | 浏览器端做一个**骨架屏/加载占位**（无 meta 时渲染"正在生成…"），完成后再挂画廊卡片 |

> 先独立验证外部 API 本身（脚本直调、走代理确认连通、确认 key 有效），再联调插件；把"API 可用性"和"插件代码正确性"分开排查。

## 调试技巧

- **最小复现**：先用一个最小 apply 插件跑通注册（headless 问一句），再逐步加功能。
- **headless 先行**：`dsh --profile headless "<问题>"` 能快速验证"模型识别意图 → 调用工具 → 技能播报"全链路，不必开浏览器。
- **看系统提示**：启动后 dump 组装好的系统提示，确认你的段落按预期 order 注入。
- **看工具结果**：独立脚本（如 Python）直接调外部 API，与插件返回比对，确认数据链路真实（weather-plugin 用 Open-Meteo 独立验证）。
- **浏览器端**：web 起在 `127.0.0.1:3080`，用 DevTools 看 iframe 报错；确认 `http://127.0.0.1:3080/plugins/<id>/client.js` 返回 200。
- **对照真实蓝本**：遇到"该怎么做"的疑问，翻 `assets/examples/weather-plugin/`（本 Skill 的实战案例）看它怎么写工具/技能/系统提示/浏览器端。
- **日志分层**：关键路径加 `console.log`，别把调试日志打进发布产物。
