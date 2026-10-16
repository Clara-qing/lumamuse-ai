"use client";

import { RefObject, useEffect, useRef } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { trackingQuality } from "./trackingQuality";
import { smoothLandmarks } from "./faceSmoothing";
import type { TrackingQuality } from "./trackingQuality";
export type { TrackingQuality } from "./trackingQuality";
export type FaceLandmarks = NormalizedLandmark[];

export type MeshStatus =
  | "idle"
  | "loading"
  | "tracking"
  | "no-face"
  | "fallback";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  palette: string[];
  intensity: number;
  look: "daily" | "smoky" | "contour";
  teachingZone?: string;
  mode: "tryon" | "teach";
  showMesh?: boolean;
  brushDirection?: string;
  landmarksRef?: RefObject<FaceLandmarks | null>;
  onStatus: (status: MeshStatus) => void;
  onQuality?: (quality: TrackingQuality) => void;
};

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const LEFT_EYE = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
];
const RIGHT_EYE = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381,
  382,
];
const LEFT_CHEEK = [234, 93, 132, 58, 172, 136, 150, 149];
const RIGHT_CHEEK = [454, 323, 361, 288, 397, 365, 379, 378];
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 95,
];
const LEFT_JAW = [234, 127, 162, 21, 54, 103, 67, 109];
const RIGHT_JAW = [454, 356, 389, 251, 284, 332, 297, 338];

function rgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function polygon(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  ids: number[],
  fill: string,
  blur = 0,
  stroke?: string,
  blend: GlobalCompositeOperation = "source-over",
) {
  ctx.save();
  ctx.filter = blur ? `blur(${blur}px)` : "none";
  ctx.globalCompositeOperation = blend;
  ctx.beginPath();
  ids.forEach((id, index) => {
    const p = points[id];
    const x = p.x * ctx.canvas.width;
    const y = p.y * ctx.canvas.height;
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.filter = "none";
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

function softlyFillPolygon(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  ids: number[],
  color: string,
  alpha: number,
  blur: number,
  blend: GlobalCompositeOperation,
) {
  const coordinates = ids.map((id) => ({
    x: points[id].x * ctx.canvas.width,
    y: points[id].y * ctx.canvas.height,
  }));
  const center = coordinates.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= coordinates.length;
  center.y /= coordinates.length;
  const radius = Math.max(
    20,
    ...coordinates.map((point) => Math.hypot(point.x - center.x, point.y - center.y)),
  );
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.2);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.68, rgba(color, alpha * 0.6));
  gradient.addColorStop(1, rgba(color, 0));

  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.globalCompositeOperation = blend;
  ctx.beginPath();
  coordinates.forEach((point, index) => {
    if (index) ctx.lineTo(point.x, point.y);
    else ctx.moveTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(center.x - radius * 1.4, center.y - radius * 1.4, radius * 2.8, radius * 2.8);
  ctx.restore();
}

function drawMesh(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[]) {
  ctx.save();
  FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(({ start, end }) => {
    const a = points[start],
      b = points[end];
    const depth = ((a.z || 0) + (b.z || 0)) / 2;
    const alpha = Math.max(0.1, Math.min(0.52, 0.24 - depth * 1.8));
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = Math.max(0.45, Math.min(1.25, 0.7 - depth * 2));
    ctx.beginPath();
    ctx.moveTo(a.x * ctx.canvas.width, a.y * ctx.canvas.height);
    ctx.lineTo(b.x * ctx.canvas.width, b.y * ctx.canvas.height);
    ctx.stroke();
  });
  ctx.restore();
}

function arrow(ctx: CanvasRenderingContext2D, from: NormalizedLandmark, to: NormalizedLandmark, label: string) {
  const x1=from.x*ctx.canvas.width,y1=from.y*ctx.canvas.height,x2=to.x*ctx.canvas.width,y2=to.y*ctx.canvas.height;
  const angle=Math.atan2(y2-y1,x2-x1),head=12;
  ctx.save();
  ctx.strokeStyle="#fff";ctx.fillStyle="#fff";ctx.lineWidth=3;ctx.lineCap="round";
  ctx.shadowColor="rgba(37,30,33,.7)";ctx.shadowBlur=5;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle-Math.PI/6),y2-head*Math.sin(angle-Math.PI/6));ctx.lineTo(x2-head*Math.cos(angle+Math.PI/6),y2-head*Math.sin(angle+Math.PI/6));ctx.closePath();ctx.fill();
  ctx.font="700 12px Arial";ctx.fillText(label,x1+8,y1-9);ctx.restore();
}

function drawBrushDirection(ctx:CanvasRenderingContext2D,points:NormalizedLandmark[],zone?:string){
  const pairs:Record<string,[number,number,string][]>={
    base:[[159,161,"向上轻扫"],[386,384,"向上轻扫"]],
    outer:[[133,33,"向外晕染"],[263,362,"向外晕染"]],
    lower:[[33,133,"向内连接"],[362,263,"向内连接"]],
    liner:[[33,133,"贴根平拉"],[362,263,"贴根平拉"]],
    soften:[[133,33,"来回柔化"],[263,362,"来回柔化"]],
    highlight:[[159,158,"轻点"],[386,387,"轻点"]],
    cheek:[[234,93,"耳前向内"],[454,323,"耳前向内"]],
    jaw:[[172,136,"向颈部带开"],[397,365,"向颈部带开"]],
    scan:[[1,234,"转头检查"]],
  };
  (pairs[zone||""]||[]).forEach(([a,b,label])=>{if(points[a]&&points[b])arrow(ctx,points[a],points[b],label)});
}

function renderLook(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  palette: string[],
  intensity: number,
  look: Props["look"],
  mode: Props["mode"],
  teachingZone?: string,
) {
  // Camera makeup should be almost imperceptible at the contour. Keeping the
  // pigment under 0.5 avoids the sticker-like look of flat AR masks.
  const a = Math.max(0.07, Math.min(0.54, (intensity / 100) * 0.52));
  const guide = "rgba(255,255,255,.9)";
  if (mode === "teach") {
    if (look === "contour") {
      const useJaw = teachingZone === "jaw" || teachingZone === "scan";
      const left = useJaw ? LEFT_JAW : LEFT_CHEEK;
      const right = useJaw ? RIGHT_JAW : RIGHT_CHEEK;
      polygon(ctx, points, left, rgba(palette[1], a * 0.48), 8, guide);
      polygon(ctx, points, right, rgba(palette[1], a * 0.48), 8, guide);
    } else {
      const eyeZones: Record<string, [number[], number[]]> = {
        base: [LEFT_EYE, RIGHT_EYE],
        soften: [LEFT_EYE, RIGHT_EYE],
        outer: [
          [33, 246, 161, 160, 159, 133, 155, 154],
          [362, 398, 384, 385, 386, 263, 249, 390],
        ],
        liner: [
          [33, 7, 163, 144, 145, 153, 154, 155, 133],
          [362, 382, 381, 380, 374, 373, 390, 249, 263],
        ],
        lower: [
          [33, 7, 163, 144, 145, 153, 154, 155, 133],
          [362, 382, 381, 380, 374, 373, 390, 249, 263],
        ],
        highlight: [
          [159, 158, 157, 173, 133, 155, 154, 153],
          [386, 387, 388, 466, 263, 249, 390, 373],
        ],
      };
      const [left, right] = eyeZones[teachingZone || "base"] || eyeZones.base;
      polygon(ctx, points, left, rgba(palette[0], a * 0.72), 3, guide);
      polygon(ctx, points, right, rgba(palette[0], a * 0.72), 3, guide);
    }
    const nose = points[1];
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "700 13px Arial";
    ctx.fillText(
      "当前步骤区域",
      nose.x * ctx.canvas.width - 44,
      nose.y * ctx.canvas.height - 36,
    );
    return;
  }
  if (look !== "contour") {
    // The blend modes intentionally mirror the compositing vocabulary used by
    // production effect editors: shadow darkens underlying skin while highlight
    // retains texture instead of painting an opaque flat colour.
    // Three very soft passes mimic the subtle, camera-friendly layering used
    // by short-video makeup effects: diffuse base, darker outer corner, and
    // a tiny centre highlight. There are deliberately no hard outlines.
    softlyFillPolygon(ctx, points, LEFT_EYE, palette[0], a * 0.48, 7, "soft-light");
    softlyFillPolygon(ctx, points, RIGHT_EYE, palette[0], a * 0.48, 7, "soft-light");
    const outerA = look === "smoky" ? a * 1.25 : a * 0.8;
    polygon(
      ctx,
      points,
      [33, 246, 161, 160, 159, 133, 155, 154, 153],
      rgba(palette[1], outerA * 0.38),
      7,
      undefined,
      "multiply",
    );
    polygon(
      ctx,
      points,
      [362, 398, 384, 385, 386, 263, 249, 390, 373],
      rgba(palette[1], outerA * 0.38),
      7,
      undefined,
      "multiply",
    );
    softlyFillPolygon(ctx, points, LEFT_CHEEK, palette[0], a * 0.22, 14, "soft-light");
    softlyFillPolygon(ctx, points, RIGHT_CHEEK, palette[0], a * 0.22, 14, "soft-light");
    polygon(ctx, points, LIPS, rgba(palette[1], a * 0.38), 4, undefined, "multiply");
  } else {
    softlyFillPolygon(ctx, points, LEFT_CHEEK, palette[1], a * 0.38, 16, "multiply");
    softlyFillPolygon(ctx, points, RIGHT_CHEEK, palette[1], a * 0.38, 16, "multiply");
    softlyFillPolygon(ctx, points, LEFT_JAW, palette[1], a * 0.16, 18, "multiply");
    softlyFillPolygon(ctx, points, RIGHT_JAW, palette[1], a * 0.16, 18, "multiply");
  }
}

export default function FaceMeshCanvas({
  videoRef,
  enabled,
  palette,
  intensity,
  look,
  teachingZone,
  mode,
  showMesh = false,
  brushDirection,
  landmarksRef,
  onStatus,
  onQuality,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({
    palette,
    intensity,
    look,
    teachingZone,
    mode,
    showMesh,
    brushDirection,
  });
  useEffect(() => {
    latest.current = { palette, intensity, look, teachingZone, mode, showMesh, brushDirection };
  }, [palette, intensity, look, teachingZone, mode, showMesh, brushDirection]);

  useEffect(() => {
    if (!enabled || landmarksRef) return;
    let cancelled = false;
    let frame = 0;
    let landmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let previousPoints: FaceLandmarks | null = null;
    let lastStatus: MeshStatus = "idle";
    let lastQuality: TrackingQuality = "waiting";
    const report = (status: MeshStatus) => {
      if (status !== lastStatus) {
        lastStatus = status;
        onStatus(status);
      }
    };

    async function boot() {
      report("loading");
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM);
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });
        loop();
      } catch {
        report("fallback");
      }
    }

    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && landmarker && video.readyState >= 2) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          // A transparent overlay cannot blend with the pixels in the separate
          // <video> element. Compositing the frame first makes `multiply` and
          // `soft-light` interact with actual skin pixels, like an effect editor.
          ctx?.clearRect(0, 0, width, height);
          ctx?.drawImage(video, 0, 0, width, height);
          const result = landmarker.detectForVideo(video, performance.now());
          const rawPoints = result.faceLandmarks[0];
          if (rawPoints && ctx) {
            const points = smoothLandmarks(previousPoints, rawPoints);
            previousPoints = points;
            report("tracking");
            const s = latest.current;
            const quality = trackingQuality(points);
            if (quality !== lastQuality) {
              lastQuality = quality;
              onQuality?.(quality);
            }
            if (s.showMesh) drawMesh(ctx, points);
            renderLook(
              ctx,
              points,
              s.palette,
              s.intensity,
              s.look,
              s.mode,
              s.teachingZone,
            );
            if(s.brushDirection) drawBrushDirection(ctx,points,s.teachingZone);
          } else {
            previousPoints = null;
            report("no-face");
            if (lastQuality !== "waiting") {
              lastQuality = "waiting";
              onQuality?.("waiting");
            }
          }
        }
      }
      frame = requestAnimationFrame(loop);
    }

    boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
    };
  }, [enabled, landmarksRef, onStatus, onQuality, videoRef]);

  useEffect(() => {
    if (!enabled || !landmarksRef) return;
    let cancelled = false;
    let frame = 0;
    let lastVideoTime = -1;
    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, width, height);
        ctx?.drawImage(video, 0, 0, width, height);
        const points = landmarksRef.current;
        if (points && ctx) {
          const s = latest.current;
          if (s.showMesh) drawMesh(ctx, points);
          renderLook(ctx, points, s.palette, s.intensity, s.look, s.mode, s.teachingZone);
          if (s.brushDirection) drawBrushDirection(ctx, points, s.teachingZone);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [enabled, landmarksRef, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="face-mesh-canvas"
      aria-label={
        brushDirection
          ? `实时面部网格妆效叠加层，当前刷具方向：${brushDirection}`
          : "实时面部网格妆效叠加层"
      }
    />
  );
}

/** Runs one MediaPipe inference loop for multiple visual renderers. */
export function FaceMeshTracker({
  videoRef,
  enabled,
  landmarksRef,
  onStatus,
  onQuality,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  landmarksRef: RefObject<FaceLandmarks | null>;
  onStatus: (status: MeshStatus) => void;
  onQuality?: (quality: TrackingQuality) => void;
}) {
  useEffect(() => {
    if (!enabled) {
      landmarksRef.current = null;
      return;
    }
    let cancelled = false;
    let frame = 0;
    let landmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let lastStatus: MeshStatus = "idle";
    let lastQuality: TrackingQuality = "waiting";
    let previousPoints: FaceLandmarks | null = null;
    const report = (status: MeshStatus) => {
      if (status !== lastStatus) {
        lastStatus = status;
        onStatus(status);
      }
    };
    async function boot() {
      report("loading");
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM);
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });
        loop();
      } catch {
        report("fallback");
      }
    }
    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const rawPoints = landmarker.detectForVideo(video, performance.now()).faceLandmarks[0];
        if (rawPoints) {
          const points = smoothLandmarks(previousPoints, rawPoints);
          previousPoints = points;
          landmarksRef.current = points;
          report("tracking");
          const quality = trackingQuality(points);
          if (quality !== lastQuality) {
            lastQuality = quality;
            onQuality?.(quality);
          }
        } else {
          previousPoints = null;
          landmarksRef.current = null;
          report("no-face");
        }
      }
      frame = requestAnimationFrame(loop);
    }
    boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarksRef.current = null;
      landmarker?.close();
    };
  }, [enabled, landmarksRef, onQuality, onStatus, videoRef]);
  return null;
}
