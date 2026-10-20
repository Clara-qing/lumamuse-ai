/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Server-side only. Never expose this value in a client response. */
  DASHSCOPE_API_KEY?: string;
  /** The Beijing Bailian workspace used for the realtime model. */
  DASHSCOPE_WORKSPACE_ID?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const REALTIME_MODEL = "qwen3.8-omni-flash-realtime";
const COACH_CHAT_MODEL = "qwen-plus";
const MAKEUP_TRANSFER_MODEL = "qwen-image-3.0";
const MAX_IMAGE_DATA_URI_LENGTH = 14_000_000;

function isImageDataUri(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 32
    && value.length <= MAX_IMAGE_DATA_URI_LENGTH
    && /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value);
}

async function generateMakeupPreview(request: Request, env: Env, pageUrl: URL): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== pageUrl.origin) {
    return Response.json({ error: "Cross-origin image requests are not allowed." }, { status: 403 });
  }
  if (!env.DASHSCOPE_API_KEY || !env.DASHSCOPE_WORKSPACE_ID) {
    return Response.json({ error: "图像试妆服务尚未在此部署环境配置。" }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as {
    faceImage?: unknown;
    referenceImage?: unknown;
    consent?: unknown;
  } | null;
  if (body?.consent !== true) {
    return Response.json({ error: "请先确认本次图片发送授权。" }, { status: 400 });
  }
  if (!isImageDataUri(body.faceImage) || !isImageDataUri(body.referenceImage)) {
    return Response.json({ error: "请提交清晰的 PNG、JPG 或 WebP 正脸照与参考妆容图（单张不超过约 10MB）。" }, { status: 400 });
  }

  const endpoint = `https://${env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/images/generations`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MAKEUP_TRANSFER_MODEL,
      image: [body.faceImage, body.referenceImage],
      prompt: "图1是使用者正脸，图2是参考妆容。严格保留图1的身份、脸型、五官比例、肤色、皮肤纹理、发型、表情、姿态、背景和原始光线。只迁移图2中清晰可见的妆容：眉型与眉色、眼影渐变、眼线、睫毛效果、鼻影、腮红的落点与边缘、面部修容、唇色与质感、高光。真实摄影质感、自然柔和融合，保留毛孔和真实皮肤光影。禁止改变脸型、眼睛大小、鼻形、嘴唇形状、发型、年龄、背景；禁止加入文字、水印、饰品、新人物或夸张美颜。输出一张自然、清晰的正脸静态试妆预览。",
      // This is the OpenAI-compatible Images endpoint, whose size separator is
      // the letter "x" (the DashScope protocol uses "*").
      size: "1024x1024",
      n: 1,
    }),
  });
  const payload = await upstream.json().catch(() => null) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { message?: string };
  } | null;
  const result = payload?.data?.[0];
  if (!upstream.ok || (!result?.url && !result?.b64_json)) {
    return Response.json({ error: "图像服务暂时未能生成预览，请稍后重试或更换更清晰的正脸图。" }, { status: 502 });
  }
  const image = result.url ?? `data:image/png;base64,${result.b64_json}`;
  return Response.json({ image }, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function answerCoachChat(request: Request, env: Env, pageUrl: URL): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== pageUrl.origin) return Response.json({ error: "Cross-origin coach requests are not allowed." }, { status: 403 });
  if (!env.DASHSCOPE_API_KEY || !env.DASHSCOPE_WORKSPACE_ID) return Response.json({ error: "小妆伴服务尚未在此部署环境配置。" }, { status: 503 });
  const body = await request.json().catch(() => null) as { message?: unknown; context?: unknown; history?: unknown; stream?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1200) : "";
  const context = typeof body?.context === "string" ? body.context.slice(0, 24000) : "";
  const history = Array.isArray(body?.history)
    ? body.history.filter((item): item is string => typeof item === "string").slice(-8).map((item) => item.slice(0, 800))
    : [];
  const wantsStream = body?.stream === true;
  if (!message) return Response.json({ error: "请先输入想问小妆伴的话。" }, { status: 400 });

  const endpoint = `https://${env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
  const system = `你是 MirrorMate 的“小妆伴”，只以这个身份与用户对话。绝不自称千问、Qwen、Qwen-Omni、AI 助手、语言模型或 API；若用户问身份，回答“我是 MirrorMate 的小妆伴，陪你把喜欢的妆容一步步画到自己脸上。”若用户问项目目标，回答 MirrorMate 会将灵感妆变成试妆预览和镜前分步陪练，你负责选妆、试妆、跟练、复盘与下次欢迎。你能看到的是下面的“当前页面状态”，不能假称看到了未提供的图片像素或用户真实妆面。自然、温暖、具体，通常 1—3 句，不做颜值评判、医学判断或产品功效承诺。\n\n当前页面状态：\n${context}`;
  const messages = [
    { role: "system", content: system },
    ...history.map((item) => ({ role: item.startsWith("你问：") || item.startsWith("你说：") ? "user" : "assistant", content: item.replace(/^(你问：|你说：|MirrorMate：)/, "") })),
    { role: "user", content: message },
  ];
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: COACH_CHAT_MODEL, messages, temperature: 0.72, max_tokens: 420, stream: wantsStream }),
  });
  if (wantsStream) {
    if (!upstream.ok || !upstream.body) {
      const failedPayload = await upstream.json().catch(() => null) as { error?: { message?: string } } | null;
      console.error(JSON.stringify({ event: "coach_chat_stream_failed", upstreamStatus: upstream.status, upstreamError: failedPayload?.error?.message?.slice(0, 180) }));
      return Response.json({ error: "小妆伴暂时无法回答，请稍后再试。" }, { status: 502 });
    }
    // Pass DashScope's Server-Sent Events through unchanged. The browser can
    // paint each content delta immediately instead of waiting for a full reply.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const payload = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
  const reply = payload?.choices?.[0]?.message?.content?.trim();
  if (!upstream.ok || !reply) {
    console.error(JSON.stringify({ event: "coach_chat_failed", upstreamStatus: upstream.status, upstreamError: payload?.error?.message?.slice(0, 180) }));
    return Response.json({ error: "小妆伴暂时无法回答，请稍后再试。" }, { status: 502 });
  }
  return Response.json({ reply: reply.slice(0, 1800) }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function exchangeRealtimeOffer(request: Request, env: Env, pageUrl: URL): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== pageUrl.origin) {
    return Response.json({ error: "Cross-origin realtime requests are not allowed." }, { status: 403 });
  }
  if (!env.DASHSCOPE_API_KEY || !env.DASHSCOPE_WORKSPACE_ID) {
    return Response.json({ error: "Realtime voice has not been configured on this deployment." }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as { sdp?: unknown } | null;
  if (!body || typeof body.sdp !== "string" || body.sdp.length < 20 || body.sdp.length > 200_000) {
    return Response.json({ error: "Invalid WebRTC offer." }, { status: 400 });
  }

  const endpoint = `https://${env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model=${REALTIME_MODEL}`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
    },
    body: body.sdp,
  });
  const answer = await upstream.text();
  if (!upstream.ok) {
    // Keep the provider response in server logs for diagnosis, but only return
    // the status category to the browser: upstream messages can contain
    // account-specific details and must not leak to a public client.
    console.error(JSON.stringify({
      event: "bailian_realtime_sdp_exchange_failed",
      upstreamStatus: upstream.status,
      upstreamBody: answer.slice(0, 300),
    }));
    return Response.json({
      error: `百炼实时会话被拒绝（HTTP ${upstream.status}）。请检查此 Worker 的 API Key、Workspace ID 与模型开通状态。`,
      upstreamStatus: upstream.status,
    }, { status: 502 });
  }
  return new Response(answer, {
    headers: {
      "Content-Type": "application/sdp; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/realtime/offer") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return exchangeRealtimeOffer(request, env, url);
    }

    if (url.pathname === "/api/coach-chat") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return answerCoachChat(request, env, url);
    }

    if (url.pathname === "/api/makeup-transfer") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return generateMakeupPreview(request, env, url);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
