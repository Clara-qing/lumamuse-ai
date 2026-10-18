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
      size: "1024*1024",
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
    console.error("Bailian realtime SDP exchange failed", upstream.status, answer.slice(0, 300));
    return Response.json({ error: "Realtime connection could not be established." }, { status: 502 });
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
