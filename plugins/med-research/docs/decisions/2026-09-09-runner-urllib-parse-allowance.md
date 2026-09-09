# 决策：Runner 允许 `urllib.parse`（保留 `urllib.request` 封禁）

- 状态：已实施
- 日期：2026-09-09
- 依据：SPEC §36、FR-19；`docs/decisions/2026-09-08-phase5-statistics.md`

## 问题

隔离 Runner 的运行时 guard 按**根模块**封禁 `urllib` 整个包。Python 标准库的 `pathlib` 内部会 `import urllib.parse`（纯字符串解析），因此任何使用 `pathlib` 的生成代码都会以 `ImportError: module 'urllib' is blocked by the Med Research runner` 失败。`pathlib` 是惯用写法（`Path(outdir) / 'result.csv'`），真实回归测试里就出现了；静态 allowlist 也把 `urllib` 视为未允许的包，报 `package not in allowlist: urllib`。需要裁决：是要求生成代码改用 `os.path`，还是放开纯解析子模块。

## 决定

1. **运行时 guard 允许 `urllib.parse`，其余 `urllib` 子模块继续封禁**。`urllib.parse` 只做 URL/查询串的字符串解析，不打开 socket；`urllib.request`、`urllib.error` 等仍被拦。guard 新增 `_ALLOWED` 集合，判定改为「根在 `_BLOCKED` 且完整名不在 `_ALLOWED`」。
2. **静态 allowlist 同步**。`importedModules` 改为返回按源码书写的点分模块名，`disallowedImports` 用「根在 STDLIB、或完整名在允许子模块、或允许列表命中根/完整名」判定。这样 `from urllib.parse import urlparse` 通过预检，`import urllib.request` 在进程启动前就被拒，`import os.path` 仍因根 `os` 在 STDLIB 而通过。
3. **不放宽其它被封禁根**：`socket`、`ssl`、`subprocess`、`http`、`asyncio`、`requests` 等维持现状。

## 放弃的方案

- **只把测试改成 `os.path`**：能变绿，但把「生成代码用 `pathlib` 就失败」这个真实问题留在产品里。
- **放开整个 `urllib`**：`urllib.request` 是网络出口，与「Runner 无网络」的硬约束冲突。
- **只改运行时 guard、不改静态 allowlist**：两者不一致，模型会先被预检拒掉，根本走不到 guard；放开等于无效。
- **把 `urllib` 从封禁列表删除、改用更细的运行时钩子**：guard 是进程内防护而非安全边界，细粒度到 socket 层的改动超出本次范围。

## 需要的验证

- `medical-runner-container/tests/process-runner.spec.ts`：`import urllib.request` 被静态预检拒（`package not in allowlist: urllib.request`）；`__import__("urllib.request")` 绕过静态检查后仍被 guard 拒；`from pathlib import Path` + `from urllib.parse import urlparse` 成功执行；`disallowedImports` 对上述两种 import 的判定。
- 同文件既有 `classifies uppercase PNG and SVG extensions as figures` 由失败转为通过。
- `pnpm run typecheck` 与 `pnpm run test`。

## 已知限制

- guard 是进程内 import 钩子，不是安全边界；`importlib.import_module` 等不经过 `builtins.__import__` 的路径不在本记录的封禁保证内（既有边界，见阶段 5 决策记录）。
- 允许列表只加了 `urllib.parse`；其它「被禁根的安全子模块」需要逐项评估，不默认放开。
