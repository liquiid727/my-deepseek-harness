# Med Research 人工验收步骤

本文用于在本地按当前仓库状态检查插件是否正确安装、加载和运行。它不把尚未裁决的功能当作已完成；待决事项见 `.todo/0909-implement`。

## 1. 安装与静态检查

在 Med Research 仓库执行：

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run verify:client
pnpm run install:profile --profile med-research --force
```

当前基线应为：

- `pnpm run typecheck` 成功。
- `pnpm run test`：45 files / 253 passed + 1 skipped；跳过项是 macOS 内存强制断言。
- `pnpm run verify:client` 输出 `client bundle ok`。
- profile 安装完成且没有 workspace 依赖解析错误。

不要给安装脚本传 `--help`；脚本只接受 `--profile <name>`、`--force` 和 `--print-only`。

## 2. 启动本地 DSH

本仓库不包含 DSH Core。使用已验证的 DSH checkout（通常是相邻目录）：

```sh
cd ../my-deepseek-harness
pnpm dsh --profile med-research --dump-config
pnpm dsh --profile med-research --port 3099
```

`--dump-config` 应显示 med-research 的 bundle、9 个 Med 插件、SQLite storage 和客户端插件。启动命令会输出带认证 token 的本地 URL，用浏览器打开该 URL。

如果看到 `EADDRINUSE`，说明该端口已经有 DSH 进程；换一个端口，例如 `--port 3100`，不要重复启动第二个实例。

## 3. 浏览器检查点

打开 URL 后按顺序检查：

1. 会话头部能看到并切换 `Research`、`Papers`、`Evidence`、`Statistics` 四个 Med 视图。
2. 设置页能看到 Med Research 配置分节，页面无未捕获异常。
3. 在 Statistics 视图用一个已存在的 dataset focus 打开数据概览；应显示文件名、行数和真实的缺失值图表，不应出现伪造分析结果。
4. 在 Research 视图切换后回到 Chat，输入框仍可用。
5. 从 Evidence 的“打开原文”动作进入 Papers focus；有段落数据时，引用片段应高亮并滚动定位。
6. 清空或关闭会话后确认会话作用域业务视图不渲染，浏览器 Console 没有异常。

当前实现是 focus-driven：没有项目论文、数据集、分析运行的列表 Remote 时，空态或缺少 focus 属于已知限制，不是数据加载成功。

## 4. Research 链手工检查

需要 DSH 已配置可用的模型和 PubMed 网络访问。对模型提出一个明确的中文研究问题，观察工具调用顺序应接近：

```text
project_create
→ literature_plan_query
→ 用户确认
→ literature_search_pubmed
→ paper_get_document / paper_resolve_fulltext
→ evidence_retrieve
→ evidence_save
→ evidence_verify
```

检查结果：PMID/DOI 来自 PubMed 返回；Evidence 显示 locator/support 两种状态和三项 provenance；无法定位的引文不能变成 VERIFIED；最终引用点击能回到 Papers 的原文段落。

## 5. Statistics 链手工检查

准备一个不含敏感数据的 CSV，并确认 profile 的 runner 环境有 PRD §34 的包（`pandas`、`numpy`、`scipy`、`statsmodels`、`matplotlib`、`openpyxl`）。观察工具调用顺序：

```text
dataset_profile
→ statistics_plan
→ statistics_generate_code
→ 用户批准一次 statistics_execute
→ statistics_execute
```

检查结果：

- 执行前有一次性审批，不批准时不会运行代码。
- 成功结果包含聚合 `resultJson`、runtime、package versions、dataset hash、code hash。
- 生成的 CSV/SVG artifact 可下载，并带 `analysisRunId` provenance。
- 失败时保留 code/stderr，状态为 FAILED，不显示伪造统计结论。
- Runner 产生的 SVG 即使带 XML declaration/DOCTYPE 也能注册；损坏 SVG 不会留下部分 durable 文件。

## 6. 已知不能据此宣称完成的项目

- P0 四类图表的分析结果 Remote/UI 接线尚未完成；当前只验证模板、profile 图表和 figure artifact 链。
- 列表驱动的论文、证据、数据集、分析运行视图尚未完成。
- 右栏 Paper Reader/Evidence tab 依赖的上游 DSH 包尚未发布。
- Agent Mode 动态允许列表尚未有切换入口契约。
- 生产级 Linux 容器/bwrap provider 和 Gold Set 人工评估尚未完成。
