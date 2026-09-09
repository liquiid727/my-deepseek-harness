# 调外部 API 的工具：异步作业 + 轮询

## 目录
- [为什么不能同步请求](#为什么不能同步请求)
- [核心模式：异步作业 + 轮询](#核心模式异步作业--轮询)
- [可注入 fetch：测试与安全](#可注入-fetch测试与安全)
- [Cookie 与鉴权](#cookie-与鉴权)
- [配置与状态机](#配置与状态机)

## 为什么不能同步请求

外部服务（如 AI 课堂平台）生成内容往往要 30 秒~几分钟。工具执行若同步阻塞，会拖死整个模型调用。dsh 工具的正确姿势：**异步提交作业 → 轮询查询状态 → 完成后返回**。

## 核心模式：异步作业 + 轮询

```
execute(input)
  ├─ ① POST /jobs          提交作业 → 拿 jobId（作业 ID）
  ├─ ② 循环（间隔 pollIntervalMs，最多 maxWaitMs）：
  │      GET /jobs/{jobId}  查询状态
  │       ├─ running / queued → 继续等
  │       └─ succeeded / failed → 跳出
  └─ ③ 成功 → 组装 output + meta 返回；失败 → 返回结构化失败
```

```ts
async function waitForJob(api, jobId, config): Promise<JobResult> {
  const deadline = Date.now() + config.maxWaitMs;
  while (Date.now() < deadline) {
    const job = await api.getJob(jobId);
    if (job.status === "succeeded") return job;
    if (job.status === "failed") throw new Error(`作业失败：${job.error}`);
    await sleep(config.pollIntervalMs);
  }
  throw new Error(`作业超时（>${config.maxWaitMs}ms），请稍后重试`);
}
```

## 可注入 fetch：测试与安全

**不要把 `fetch` 写死。** 让 API 客户端接收可注入的 fetch 实现：

```ts
export function makeApiClient(config: Config, fetchImpl: typeof fetch = fetch) {
  return {
    async createJob(input) {
      const res = await fetchImpl(`${config.baseUrl}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: config.accessCode },
        body: JSON.stringify(input),
      });
      return res.json();
    },
    // ...
  };
}
```

好处：
- **测试**：客户端测试时注入假的 `fetch`，模拟各种响应，无需真实网络（这是可测试性的关键）。
- **安全**：真实环境可用受限 fetch 注入访问控制；凭据（accessCode）从配置读取，不写死在代码里。

## Cookie 与鉴权

- 与第三方平台交互时，Cookie 会话需要**持久化保存**（存磁盘/配置），避免每次重建会话；同时注意过期与刷新。
- API 密钥/口令放在 `config`（preset/用户配置），**绝不打进代码或输出**；也不要打印/回显到工具 output。
- 处理 CORS：浏览器端不直连第三方 API，统一走 Node 端（后端）转发，避免跨域和凭据泄露。

## 配置与状态机

把"可调项"都做成插件 `Config`（schemastery z.object，带默认值与 description），用户可在 profile/补丁层覆盖：

| 配置项 | 默认值 | 建议 | 说明 |
| --- | --- | --- | --- |
| `baseUrl` | 第三方服务地址 | — | 可换服务/自建 |
| `accessCode` | 空 | — | 鉴权口令，勿硬编码 |
| `pollIntervalMs` | 5000 | **60000** | 轮询间隔：默认 5s 太密，长作业建议 60s |
| `maxWaitMs` | 600000 | — | 最大等待 10 分钟 |

**状态机**：作业状态（queued → running → succeeded / failed → 超时视为 failed）用显式状态机表达，避免散落的 if 判断；失败/超时都返回**结构化错误**（见 tool-plugin.md 错误处理），模型才能读懂并引导用户重试。

## 受限网络：走代理

有些外部 API（如部分图片/视频生成网关）在受限网络里**直连超时、必须走本地代理**。插件不能依赖进程全局代理，因为：
- 运行时改 `process.env.HTTPS_PROXY` 对已初始化的 fetch 无效（dispatcher 在启动时就固定了）；
- 插件要在各种宿主环境都能跑，代理应做成**可配置项**（`Config.proxyUrl`，缺省空 = 直连）。

用 undici `ProxyAgent` 逐请求注入 dispatcher：

```ts
import { fetch as undiciFetch, ProxyAgent } from 'undici'

export function makeFetch(proxyUrl?: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  if (!proxyUrl) return fetchImpl
  // undici v7：必须传对象 { uri }，字符串形式不生效（会仍直连而超时）
  const dispatcher = new ProxyAgent({ uri: proxyUrl })
  return (input, init) => undiciFetch(input as RequestInfo, { ...init, dispatcher })
}
```

注意：**undici 要显式加进插件 `package.json` 依赖**，并在 tsdown 的 node 端 `bundle: ['undici']`（浏览器端不 import 它）。密钥/代理等敏感配置用环境变量注入（进程启动前设好），勿硬编码进代码或产物。验证代理是否真的生效：请求一个回显出口 IP 的服务（如 `api.ipify.org`），IP 变化即走代理成功。

> 完整工具骨架（含 output/meta 分离）见 [tool-plugin.md](tool-plugin.md)。真实案例（代理 + 异步出图 + 画廊）见 `assets/examples/ecom-details-image-plugin/`。
