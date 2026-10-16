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
