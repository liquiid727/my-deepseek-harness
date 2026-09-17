# Med Research 采用 DSH 产品设计系统

状态：已实施

## 问题

医疗工作台已有参考图和局部手写样式，但颜色、控件、状态与样式注入没有统一权威。组件内 `<style>`、TS 字符串样式和行内布局也无法稳定参与主题、卸载与 HMR 生命周期。

## 决定

医疗 UI 以 DSH `docs/design-system.md` 为视觉权威，通过模块表消费 `@deepseek-ai/dsh-client-ui-primitives`，并依赖 `ui-theme` 服务注册统计学紫色这一组领域 token。其余导航、焦点、操作、Evidence 状态、文字、表面与边框全部读取 `--dsw-*` 语义 token。

插件自带的 tsdown 配置使用 Lightning CSS 编译全局视图样式与 CSS Modules，产物在 factory 执行时插入带 `data-plugin`/`data-plugin-css` 的样式标签。DSH loader 按插件所有权在卸载与 HMR 时清理这些标签。组件不渲染 `<style>`，布局不写行内 style。

Home、Research、Evidence、导航和设置复用 Button、Input、Field、Pill、Tag 与 StateDot。ViewFrame、SectionHeader、AsyncState、MetricTile 与 CapabilityCard 保留为医疗插件内部纯 props 组件，不加入公共导出，也不创建新的 Cordis 服务。

参考图继续位于 `asset/`，只用于信息层级和视觉核对，不进入 bundle。缺少真实读取或统计能力的视图保持真实空态或禁用态，不填充截图中的示例内容。

## 放弃的方案

**引入 Material UI、Tailwind 或独立 Storybook。** 这会产生第二套 token、构建与组件权威，并增加插件运行时依赖。

**把医疗卡片和页面外壳提升为 DSH 公共组件。** 当前只有医疗插件需要这些信息结构，公共 API 会把单一领域布局固化成全局约定。

**继续使用 TS 字符串样式。** 它绕过 CSS 编译和模块隔离，并要求每个渲染位置或插件入口自行管理样式生命周期。

## 验证要求

组件测试覆盖真实 Remote 状态、Field ARIA 与 TabList 键盘行为；bundle 校验必须确认共享 primitives 是允许的模块表依赖、编译样式存在所有权标签，且视图与导航样式进入单一 `client.js`。浏览器核对覆盖浅色、深色、宽屏、窄屏、双语和 200% 缩放。
