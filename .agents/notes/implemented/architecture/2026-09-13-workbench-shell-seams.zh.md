# Agent Note：工作台 shell 接缝——侧栏主导航与根级视图激活

状态：implemented

[English](2026-09-13-workbench-shell-seams.md) | 中文

## 问题

树外工作台插件需要两个 shell 此前未提供的能力。侧栏没有可叠加的插件主导航区域；根作用域的界面无法在当前会话上激活已注册的会话视图——视图选择只存在于会话作用域的槽位条目内，侧栏条目能启动会话，却无法在既有会话上切换视图。

## 决定

侧栏 shell 在“新会话”按钮与工作区浏览区之间声明一个可叠加的 `sidebar.primary.action` list slot。owner 只共享列状态（`wide`）；条目以自己的 `id`/`order`/`label` 注册并拥有自己的导航行为。条目存活时，shell 把它们渲染为工作区浏览区左侧的独立 56px 图标栏——即宿主列内原型的两个分组；图标栏对 strip 做响应式跟踪，没有条目时绝不挂载，几何不变。收起时图标行叠在区域自身的 rail 列之上。

`UiConversation` 新增 `openView(view, { sessionId?, focus? })`：解析当前（或指定）会话，在会话装配上激活已注册的视图，并通过共享的每会话 Conversation store 写入选择与焦点请求。store handle 由 `sharePerScopeStore` 包装，使槽位框架与直接服务调用方观察到同一个每作用域实例，而不是两个仅共享持久化的活实例。空白会话若激活了已注册的功能视图，则呈现该视图而非居中 Hero：视图拥有界面、composer 常驻停靠，视图内容不会被 Hero 覆盖层遮挡。shell 通过 Conversation inject 上新的 `viewSelection` hook 读取选择；无会话时 `openView` 拒绝，调用方保留自己的启动流程。

底部停靠是默认放置方式。View 可通过 [View composer outlet](2026-09-13-view-composer-outlet.zh.md)将同一个常驻 composer 放入内容区；该决策拥有放置与准入后的回调。

跨插件导航按服务名（`uiConversation`、`uiWorkspace`）经客户端 `inject` 列表解析；需要这些接缝的插件必须在那里声明，因为 inject 清单之外的服务不保证可解析。

## 放弃的方案

**由侧栏 slot 的 owner 提供导航回调。** 这会把 shell 与会话语义耦合，并随导航目标增长 owner props；规格要求 owner props 只提供 `wide`。

**穿透框架私有实例缓存访问视图 store。** 按契约，每键实例唯一性是调用方的责任；包装 handle 让共享显式化，对两类读取方都成立。

**用轮询活 store 或读取持久化偏好来抑制 Hero。** inject hook 复用会话体消费的同一个 observable，Hero 决策因此是响应式且单源的。

## 后果

工作台插件注册主导航条目（图标栏 + 由公开 `viewSelection` 读取器驱动的活动视图胶囊高亮）、在活会话上切换视图；呈现功能视图的空白会话停靠 composer，视图内容可完整滚入。无条目时侧栏几何、新会话、工作区浏览器、设置与 chat 的默认视图行为不变。composer chain、hero launch 槽位与既有视图花名册保持其契约；`workbench.topbar` 因不再使用而移除，而不是保留一个空的预留条。
