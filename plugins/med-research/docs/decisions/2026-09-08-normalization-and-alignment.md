# 决策：归一化与对齐的落地细节

- 状态：已实施（阶段 1）
- 日期：2026-09-08
- 依据：SPEC §22.3、§13.3；AGENTS.md §2.6

## 问题

SPEC §22.3 固定了归一化步骤顺序与「exact / aligned」两级对齐，但两处细节没有给出可直接编码的判定：

1. 「行末连字符 + 换行 → 合并」没有说明连字符与换行之间是否允许空格。
2. 「滑动窗口 + 编辑距离 / 长度 ≤ tolerance」没有定义窗口大小参数的含义，也没有给出编辑距离的分母。

## 决定

1. **行末连字符规则**：`/-[ \t]*\r?\n[ \t]*/` 整体删除，因此 `well-\nbeing`、`well- \n being` 都折叠为 `wellbeing`。
2. **`windowSize` 的含义**：候选窗口长度相对引文长度的最大字符偏差。对 `d ∈ [-windowSize, windowSize]`，窗口长度为 `quote.length + d`（下限 1），逐个起点比较。
3. **归一化距离的分母**：`max(windowLength, quoteLength)`，即 `distance / max(...) ≤ tolerance`；`similarity = 1 - distance / max(...)`。
4. **编辑距离实现**：Ukkonen 带内 DP + 行最小值剪枝，超过 `floor(tolerance × quoteLength)` 立即放弃。长段落上的滑动窗口因此保持在可接受开销内。
5. **空引文**：一律 `NOT_FOUND`（空串无法定位到具体位置）。
6. **配置校验**：`tolerance ∈ [0,1]`、`windowSize` 为非负整数，否则 `RangeError` fail-loud。领域层不提供默认值，两个参数必须由上层 `Config` 解析后传入（AGENTS.md §4「不写 `DEFAULT_*`」）。

## 放弃的方案

- **只做精确匹配 + 固定长度窗口**：`PARTIAL` 状态会几乎永不出现，而 SPEC §44 明确要求 UI 展示「已定位但非精确匹配」。
- **用归一化字符集/余弦相似度替代编辑距离**：SPEC §22.3 指定了编辑距离，换成别的度量会让 `tolerance` 阈值失去规格依据。
- **在领域层内置 tolerance 默认值**：违反「部署可变参数必须是可校验 Config」的约束，且会让 Gold Set 复核无法复现阈值。

## 需要的验证

- `normalize.spec.ts`：NFKC、软连字符、行末连字符、连字、引号/破折号、空白折叠、幂等性。
- `alignment.spec.ts`：FOUND / PARTIAL / NOT_FOUND、offset 基准、tolerance=0 边界、非法配置。
