# Agent Note: 产品设计系统与共享表单导航控件

Status: implemented

[English](2026-09-13-product-design-system.md) | 中文

## Problem

Web 样式规则定义了 CSS 的职责归属，但没有定义产品视觉语言。功能插件即使遵循 CSS Modules 和仅使用 token 的规则，仍可能选择彼此无关的画布、操作色、状态对比度、控件高度和响应式行为。共享组件包也没有持有表单标签与标签页键盘行为，导致功能包重复实现这些交互模式。

## Decision

[`docs/design-system.md`](../../../../docs/design-system.zh.md) 持有产品视觉语言。DSH 使用冷色临床画布、蓝色交互层级、明确的语义状态文字、克制的圆角与 elevation 尺度，以及阅读专用的衬线字体角色。浅色与深色取值位于 `ui-theme`；功能包消费语义别名，并且只能通过 `ThemeRuntime.overrideTokens` 注册范围狭窄的领域 token。

`accent-primary` 标识焦点、选择轨道和非文字强调。承载文字的主操作使用 `accent-strong` 与 `label-on-accent`，悬停使用 `accent-hover`。这种拆分既保留可识别的产品蓝，也满足文字对比度要求。`state-success-label`、`state-warn-label` 和 `state-error-label` 是文字角色；更明亮的状态色保留给非文字标记。

`ui-primitives` 持有另外两种交互模式。`Field` 把调用方提供的本地化标签、说明、错误和操作与调用方渲染的控件关联。`TabList<T>` 管理受控选择、漫游 `tabIndex`、跳过禁用项以及方向键/Home/End 激活，调用方负责面板生命周期与内容。`Button` 增加 44px 主操作尺寸；`Input` 增加 32px 紧凑与 40px 标准表单尺寸，并呈现 `aria-invalid` 状态。

Med Research 插件通过浏览器模块表消费共享 primitives。编译后的样式带有 loader 所有权标签，因此卸载和 HMR 会随插件移除样式。插件把统计学紫色注册为领域 token；导航、焦点、主操作、Evidence 状态、表面和文字均使用 DSH 语义别名。`asset/` 下的文件只作参考，绝不进入浏览器 bundle。

## 与现有决策的关系

[Web 样式系统](../process/2026-07-19-web-styling-system.zh.md) 继续保持活跃，因为它持有 CSS Modules、token 职责、主题隔离和间距策略。[共享客户端控件 primitives](2026-09-05-shared-client-control-primitives.zh.md) 继续保持活跃，因为它持有复用判据以及共享控件与功能布局的区分。本记录增加产品语言与表单/标签页交互约定，不取代前述任一理由。

## Alternatives considered

**采用 Material UI、Tailwind 或 Storybook 作为设计系统。** 否决，因为它们都会在现有 token 样式表、CSS Modules 构建路径和组件目录之外增加第二套样式或组件权威。产品需要的是一致语言和可复用约定，而不是并行的运行时框架。

**从 `ui-primitives` 导出页面外壳、卡片、表格和工作台布局。** 否决，因为这些结构仍只有一个领域所有者，并且编码了功能信息架构。直到两个独立包需要相同行为之前，它们都保留在功能包内。

**让一个蓝色 token 同时承担装饰、焦点和按钮填充。** 否决，因为参考强调色与白色普通字号文字的对比度不足。拆分强调色与操作色可以保留视觉身份，又不会降低操作文字可读性。

**打包参考 PNG 或用其中的示例内容填充未完成视图。** 否决，因为截图不是产品数据。运行时视图只渲染持久化或 Remote 状态；未完成能力呈现已本地化的不可用状态。

## Consequences

功能作者拥有一份视觉参考、一套语义调色板，以及共享的无障碍字段与标签页行为。所有加载 `ui-theme` 的 DSH profile 都会发生可见调色板变化，因此回归按产品级别评估，不能视为插件局部变化。功能专属页面组合仍有意保留在本地，领域色必须显式注册到主题。自动测试固定 token 存在性、已删除的含混别名、ARIA 关系、键盘行为和 Med Research bundle 的样式所有权；像素级外观仍以浏览器截图作为证据。
