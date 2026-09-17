# 决策记录：S01 工作台首页与 shell 重建（Spec 2.1.0）

日期：2026-09-13 ｜ 范围：plugin-medical-ui、plugin-project、medical-contracts ｜ 状态：已实施

## 问题

Spec 2.1.0 要求 S01 交付真实的工作台首页（UI-HOME）与五项主导航，而当前实现把项目管理与 S02 检索塞在同一个会话视图里，没有首页视图；侧栏没有医学品牌与主导航；概览计数无法表达单域失败（把未知当 0）；宿主缺少根作用域切换视图的接缝。

## 决定

1. **视图拆分**：新增 `med-home`（S01 首页，UI-HOME）；`med-research` 只保留 S02（检索计划、PubMed 检索、保存论文），项目上下文来自会话绑定（`medProjects/sessionProject`），无绑定时显示引导而不是伪造内容。
2. **唯一主输入**：首页 Hero 通过 `mountComposer` 放置宿主真实 composer；普通消息准入成功后打开当前 Session Chat，灵感仅填入草稿。位置、事件隔离与提交行为由[首页唯一输入框决策](2026-09-13-single-home-composer.md)拥有。
3. **导航接缝**：DSH ui-sidebar 新增通用 additive `sidebar.primary.action` list slot（owner 只给 `wide`）；DSH ui-conversation 在 `UiConversation` 服务上公开根级 `openView(view, {sessionId?, focus?})`（经 `sharePerScopeStore` 共享每会话 store 实例）。med 注册 首页/研究/文献库/统计 四个可用入口与 技能 的禁用态（附本地化原因）；品牌占用 `sidebar.brand.mark/name`。空白会话激活功能视图时由视图承载界面（Hero 覆盖层抑制），composer 停靠不再遮挡内容。
4. **数据面**：`medProjects` 新增 `archive/restore/sessions/sessionProject/selectProject`（归档前有运行中分析返回 `PROJECT_BUSY`；重复名称 `PROJECT_DUPLICATE`；`update` 支持 `expectedVersion` 版本冲突检查）；`overview` 改为五域（Papers/Evidence/Datasets/Analyses/Charts）逐域计数，单域读取失败返回 `status: 'unavailable'` 而不是 0，附 `updatedAt`。
5. **删除伪 topbar**：上一轮添加的 `workbench.topbar`（通知/账户/搜索均为宿主能力或不存在）随 `topbar.tsx` 一起移除，DSH 侧未发布的槽位声明一并回收。

放弃的方案：在首页自建第二输入并让 composer 隐藏（需要宿主为单一业务改动 composer 生命周期，违反 additive 原则）；客户端缓存「当前项目」（第二事实源）；把 Evidence/Chart 计数在无 Runner/无全文摄取链路时伪造为非零（违反诚实失败）。

## 需要的验证

- `medProjects` 契约测试覆盖 archive/restore/busy/duplicate/version/partial overview/sessions/select 审计。
- 客户端测试覆盖首页 loading/empty/partial/failure、项目创建与选择、灵感只填输入、Enter 发送、五导航、rail 变体。
- 真实 profile 浏览器验证（三视口、键盘、zh/en、200% zoom、composer 遮挡、console）记录在 S01 evidence。
