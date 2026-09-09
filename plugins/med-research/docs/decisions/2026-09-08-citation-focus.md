# 引用定位：Evidence → Papers 的 focus 契约

- 状态：已实施
- 日期：2026-09-08
- 依据：SPEC §42.3、§31、PRD §36 Research DoD（「点击 Citation 定位原文」）

## 问题

Research DoD 的最后一步是「点击 Citation 定位原文」。当前证据卡片的「打开原文」只切到 Papers 视图（`openView('med-papers', paperId)`），没有定位到引文所在段落。两个已知约束：

1. 右栏席位（`sidebar.right.pane.tab`）的类型包未发布，不能作为落点；
2. Remote 面没有「某文档的全部段落」列表方法。

## 决定

用 SPEC §42.3 的**跨视图跳转 + 目标自有的 opaque focus**：`openView('med-papers', focus)`，focus 由 Papers 视图自己定义和解析。

- `src/client/focus.ts` 定义 `PaperFocus` 与 `encodePaperFocus` / `decodePaperFocus`，格式为 `paperId|documentId|paragraphId|startOffset|endOffset`（空段表示缺省；偏移缺失即整段展示）。解码对段数、空 paperId、非整数/负偏移、end < start 一律返回 `undefined`。
- Evidence 视图用证据记录的 `paperId` / `documentId` / `paragraphId` / `startOffset` / `endOffset` 编码 focus。
- Papers 视图解码后：
  - `medPapers/get` 取元数据；
  - `medPapers/paragraph` 取该段落（**已有方法**）；
  - `medPapers/sections`（按 `documentId`）取段落所属 section 的标题；
  - 用段落归一化文本 `text` 的 `[startOffset, endOffset)` 渲染 `<mark data-med-quote>`，并在加载完成后 `scrollIntoView({ block: 'center' })`。

### 为什么不需要新 Remote 方法

「定位一条已存引文」只需**单段落**读取：`medPapers/paragraph(paragraphId)` 已在 SPEC §30/§31 的清单内。缺的只是「读整篇」所需的段落列表，那是 Paper Reader 的完整阅读体验，与本 DoD 无关。

### 偏移基准

Evidence 的 `offsetBase` 固定为 `normalized_paragraph`，偏移相对段落归一化文本。因此高亮渲染在 `PaperParagraph.text`（归一化文本）上，而不是 `rawText`；这样偏移与显示严格一致。

## 放弃的方案

- **等列表方法再实现**：定位单条引文不需要列表；等下去只会阻塞 DoD。
- **右栏 tab**：类型包未发布；运行时虽有该席位，但 out-of-tree 无法取得 `SidebarRightTabInjected`。
- **把 focus 定义成裸 `paperId`**：无法表达段落与偏移，等于没定位。

## 验证

- `packages/plugin-medical-ui/tests/focus.spec.ts`：完整 span 与仅 paper 的往返；空串、缺 paperId、非数字偏移、end < start 全部拒绝。
- `packages/plugin-medical-ui/tests/views.client.spec.tsx`：Evidence 卡片点击「打开原文」传出 `paper-1|document-1|paragraph-1|17|21`；Papers 视图按该 focus 渲染 section 标题与 `<mark data-med-quote>`，且 `scrollIntoView` 被调用（jsdom 下由测试桩提供）。
- `pnpm run typecheck`（node + client）、`pnpm run test`（37 files / 205 tests）、`pnpm run verify:client` 全绿。

## 已知限制

- 整篇阅读（全部段落）仍需一个段落列表方法；届时 focus 契约不变，只是 Papers 视图多一段列表渲染。
- 浏览器端到端演示需要真实数据（跑通 Research 链），组件层已覆盖高亮与跳转。jsdom 无布局，`scrollIntoView` 由测试桩替代。
