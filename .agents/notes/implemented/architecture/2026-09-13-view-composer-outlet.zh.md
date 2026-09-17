# Agent Note: View 中的常驻 composer 放置

Status: implemented

[English](2026-09-13-view-composer-outlet.md) | 中文

## 问题

工作台 View 需要将主要消息输入放进 Hero。第二个编辑器即使共享纯文本草稿，也无法保留宿主的附件暂存、引用节点、命令处理和发送状态。把宿主编辑器重新挂载到另一个 React 目标也会丢失编辑器本地状态。

## 决策

`conversation.view` 获得 `mountComposer`：View 提供空元素的唯一 DOM id、本地化 placeholder 和消息准入成功回调。宿主持有一个稳定的 portal 容器，在该元素与 shell 底部之间移动。客户端插件域之间只传 id 和回调；View 不接收宿主 React 节点或编辑器内部对象。注册属于 Session 作用域，随 View 或 Session 释放。按对象身份检查的释放操作不会删除较新的注册。

portal 容器在所属 React 分发后停止原生交互事件冒泡。View 可能包含独立 React root；让同一事件进入该 root 会使工具栏动作分发两次。浏览器验证和嵌套 root 回归覆盖此隔离。

普通提交捕获注册，只有准入成功且相同 Session、View 和注册仍为当前状态时才调用回调。发送失败使用现有草稿恢复流程。命令不触发导航。待处理交互将 composer chain 放回 shell 底部，使审批和提问接管保持可达。

[工作台导航决策](2026-09-13-workbench-shell-seams.zh.md)继续拥有主导航与 View 选择。它规定的底部放置是未注册 outlet 的 View 的默认行为。

## 考虑过的替代方案

第二个 textarea 会重复输入行为并丢失结构化草稿状态。在 View 中另渲染 InputBar 会重新挂载 Lexical 并拆分宿主所有权。通过 owner props 传递 React 元素会使独立客户端域依赖同一个框架实例。

## 影响

工作台插件控制放置位置与准入后的导航，宿主保留输入行为、附件生命周期与临时接管。放置属于临时 UI 状态，不产生 Session event。使用此回调的已部署 View 需要匹配的宿主客户端接口与构建。
