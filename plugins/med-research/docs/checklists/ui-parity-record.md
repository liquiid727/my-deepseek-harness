# 原型 vs 实际：UI 对比记录（P2）

> 用途：按 R001 `ui-acceptance.md` §45，在**一个集成 run 内**产出原型与实际截图，并逐区域记录差异。
> 表格由脚本生成骨架，人工（或带截图的会话）填写判定列。**纯抗锯齿差异不阻塞**；其余缺失一律阻塞。

## 1. 准备

1. 从当前源码重建并安装 profile（顺序不能反）：
   ```sh
   pnpm run build:client            # tsdown 打 client bundle
   node scripts/install-local-profile.mjs --force
   ```
2. 启动 profile（记录端口，默认 `http://127.0.0.1:3100/`）。
3. 以可调试的方式启动 Chromium（需暴露 DevTools 端口，默认 `http://127.0.0.1:9222`）。
4. 在浏览器里**手工完成场景前置**（建项目、跑通 Research 链、上传 PDF、跑 Runner…）。脚本不模拟业务动作，也不接受静态 mock 替代成功链。

## 2. 采集

```sh
node scripts/capture-ui-parity.mjs \
  --url http://127.0.0.1:3100/ \
  --cdp http://127.0.0.1:9222 \
  --scene UI-HOME,UI-RESEARCH \
  --locale zh,en \
  --zoom 100,200 \
  --settle-ms 2000 \
  --data "project=住院时长队列" --data "run=<analysisRunId>" \
  --note "populated project, 2 evidence cards" \
  --out .parity/2026-09-17
```

- 三个锁定视口 1672×941 / 1440×900 / 390×844，DPR 1；`--zoom 200` 是**独立一轮**（视口折半 + pageScaleFactor 2）。
- `--dry-run` 不打截图，只生成 `run.json` 与 `parity.md` 骨架（用来先确认表格与参数）。
- 产物：`.parity/<run>/screenshots/*.png`、`run.json`（revision / dirty / profile config hash / 服务数据 / console）、`parity.md`（对比表）。

## 3. 填表

每个场景一张表，每行一个区域，逐项比较：

| 维度 | 记什么 |
|---|---|
| 位置/尺寸 | 区域边界与列宽；比例允许 ±5 个百分点，但不能为达标而截断主操作 |
| 字体 | 页面标题 24–32px、Hero 36–48px、正文 14–16px、辅助 ≥12px；Reader 英文正文 16–18px serif |
| 间距 | 4/8/12/16/24/32 阶梯，主要面板间距 12–24px |
| 颜色 | 医学蓝主操作；支持绿 / 反对红 / 不确定灰 / 冲突橙；每个状态另有文本或图标 |
| 密度 | 1672 首屏必须达到 `ui-acceptance.md` 的密度；1440 只可缩间距或滚动，信息顺序不变；390 不横溢 |
| 滚动 | 多列各自可滚动；sticky 标题/操作/composer 预留实际高度，最后一项能完整滚入且不被覆盖 |
| 焦点 | Tab/Enter/Space 可完成流程；Esc 关闭 drawer/popover 并恢复触发焦点 |
| 遮挡 | composer、浮层、抽屉不得遮挡主操作与字段 |

## 4. 判定

`ok` 或 `blocking`。以下任一为 blocking：

- 必需区域或操作缺失；
- 假状态（静态卡、假进度、占位列表、"后续完善"）；
- 跨 Project 数据出现在视图里；
- 未声明的宿主差异（宿主字体/控件布局允许，但必须写进备注）；
- 遮挡主操作或最后一项滚不进来；
- 触控目标 <44×44、对比度 <4.5:1（非文本 <3:1）、键盘不可达。

## 5. 归档

把 `.parity/<run>/` 的截图与 `parity.md` 复制到
`.requirements/requirements/R001-med-research-v1-1/specs/<对应 spec>/evidence/`，并在该目录的 `index.yaml` 登记：本次断言、限制、以及仍未覆盖的子断言（例如 UI-HOME 的非零计数与"单域失败为未知"需要 S05 Runner 真实写入）。
