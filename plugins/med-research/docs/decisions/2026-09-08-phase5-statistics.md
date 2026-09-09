# 决策：阶段 5 —— 隔离执行、统计链职责与已声明缺口

- 状态：已实施（阶段 5）
- 日期：2026-09-08
- 依据：SPEC §33–§37、§57、§65.1；PRD §34；AGENTS.md §2.5

## 1. 本机无容器：用受限子进程 provider，并标注隔离等级

SPEC §65.1 已预见：先支持 Linux 容器，macOS 用受限子进程并明确标注隔离等级。

**决定**：`medical-runner-container` 的 V1 provider 声明 `isolationLevel = 'restricted-process'`。执行时：数据集复制到临时目录并 `chmod 0444`；注入 `sitecustomize.py` 阻断 `socket`/`ssl`/`subprocess`/`ctypes` 等逃逸面并 patch `os.system`/`popen`/`fork`；curated 环境（无宿主密钥）；`result.json` 为唯一结果通道；stdout/stderr 按 `maxOutputBytes` 截断；wall-clock 超时 SIGKILL；Unix Python 进程设置 `RLIMIT_CPU`，内存用 Node 侧 RSS watchdog 轮询（macOS 拒绝 `RLIMIT_AS`，Python 侧 setrlimit 为 best-effort；没有 `RLIMIT_CPU` 的平台回退到墙钟限制）。

**未声称**：容器 provider 未实现、未验证。CI/Linux 上补 `bubblewrap`/容器 provider 前，不得宣称容器隔离。

## 2. 审批策略放在 `tools/pre-execute`

AGENTS.md §2.5 #17 要求审批在 `tools/pre-execute`，不写进 Tool 实现体。

**决定**：`plugin-statistics` 注册 `tools/pre-execute` 监听器，对 `statistics_execute` 返回 `{ kind: 'ask' }`，其余 `next()`。缺失审批答案方时 `ask` 变为拒绝（fail-closed）。

## 3. 统计链由模型产出 plan 与 code，插件只落库与执行

与阶段 2/4 同构：`statistics_plan` 接收模型给出的 `AnalysisPlan` 并落为 `planned`；`statistics_generate_code` 落 code + hash 并置 `approved`；`statistics_execute` 只执行已批准的 run。

## 4. 已声明缺口（不得当作已完成）

- **XLSX 已实现**：`plugin-dataset/src/xlsx.ts` 用 `fflate` 解压 + 共享字符串表读取第一个工作表；`upload` 按扩展名分派。测试用 `fflate` 现场构造工作簿。
- **容器 provider 未实现**（见 §1）。
- **CPU 限制已接线**：`cpuSeconds` 通过 `MED_CPU_SECONDS` 传入 launcher，并在支持的平台设置 `RLIMIT_CPU`；macOS/不支持该资源限制的平台仍由墙钟超时兜底。
- **资源限制验证边界**：macOS 上 `RLIMIT_AS` 不可用，受限执行环境也可能拒绝 Node 侧 `ps` RSS 采样；因此内存限制保持 launcher/RSS watchdog best-effort，Linux/CI 才能提供可强制断言的分配超限回归。
- **SPEC §57 三个回归 fixture 已建**：`plugin-statistics/tests/regression.spec.ts` 用真实 `python3` 执行纯标准库代码，对固定数据集断言：linear slope=2/intercept=1/r²=1、2×2 chi²=0.4、logistic OR=6（期望值由独立实现预先算出）。缺失数据、代码错误、超时、超预算、白名单外依赖由 `medical-runner-container` 的 11 个测试覆盖。
- `Dataset` 无文件路径字段（用户此前未采纳 `storageKey`），因此 `statistics_execute` 需调用方显式传 `datasetPath`。
