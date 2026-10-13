"use client";

import { RefObject, useEffect, useRef } from "react";
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from "@mediapipe/tasks-vision";

export type MeshStatus = "idle" | "loading" | "tracking" | "no-face" | "fallback";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  palette: string[];
  intensity: number;
  look: "daily" | "smoky" | "contour";
  teachingZone?: string;
  mode: "tryon" | "teach";
  onStatus: (status: MeshStatus) => void;
};

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
const LEFT_CHEEK = [234, 93, 132, 58, 172, 136, 150, 149];
const RIGHT_CHEEK = [454, 323, 361, 288, 397, 365, 379, 378];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const LEFT_JAW = [234, 127, 162, 21, 54, 103, 67, 109];
const RIGHT_JAW = [454, 356, 389, 251, 284, 332, 297, 338];

function rgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function polygon(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], ids: number[], fill: string, blur = 0, stroke?: string) {
  ctx.save();
  ctx.filter = blur ? `blur(${blur}px)` : "none";
  ctx.beginPath();
  ids.forEach((id, index) => {
    const p = points[id];
    const x = p.x * ctx.canvas.width;
    const y = p.y * ctx.canvas.height;
    if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
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

function renderLook(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], palette: string[], intensity: number, look: Props["look"], mode: Props["mode"], teachingZone?: string) {
  const a = Math.max(0.08, Math.min(0.72, intensity / 100 * 0.68));
  const guide = mode === "teach" ? "rgba(255,255,255,.85)" : undefined;
  if (look !== "contour") {
    polygon(ctx, points, LEFT_EYE, rgba(palette[0], a), 4, guide);
    polygon(ctx, points, RIGHT_EYE, rgba(palette[0], a), 4, guide);
    const outerA = look === "smoky" ? a * 1.25 : a * .8;
    polygon(ctx, points, [33, 246, 161, 160, 159, 133, 155, 154, 153], rgba(palette[1], outerA), 2);
    polygon(ctx, points, [362, 398, 384, 385, 386, 263, 249, 390, 373], rgba(palette[1], outerA), 2);
    if (mode === "tryon") {
      polygon(ctx, points, LEFT_CHEEK, rgba(palette[0], a * .32), 12);
      polygon(ctx, points, RIGHT_CHEEK, rgba(palette[0], a * .32), 12);
      polygon(ctx, points, LIPS, rgba(palette[1], a * .75), 1);
    }
  } else {
    polygon(ctx, points, LEFT_CHEEK, rgba(palette[1], a * .65), 10, guide);
    polygon(ctx, points, RIGHT_CHEEK, rgba(palette[1], a * .65), 10, guide);
    polygon(ctx, points, LEFT_JAW, rgba(palette[1], a * .35), 12, teachingZone === "jaw" ? guide : undefined);
    polygon(ctx, points, RIGHT_JAW, rgba(palette[1], a * .35), 12, teachingZone === "jaw" ? guide : undefined);
  }
  if (mode === "teach") {
    const nose = points[1];
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "700 13px Arial";
    ctx.fillText("跟随白色边界", nose.x * ctx.canvas.width - 48, nose.y * ctx.canvas.height - 36);
  }
}

export default function FaceMeshCanvas({ videoRef, enabled, palette, intensity, look, teachingZone, mode, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ palette, intensity, look, teachingZone, mode });
  useEffect(() => { latest.current = { palette, intensity, look, teachingZone, mode }; }, [palette, intensity, look, teachingZone, mode]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let frame = 0;
    let landmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let lastStatus: MeshStatus = "idle";
    const report = (status: MeshStatus) => { if (status !== lastStatus) { lastStatus = status; onStatus(status); } };

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
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, width, height);
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = landmarker.detectForVideo(video, performance.now());
          const points = result.faceLandmarks[0];
          if (points && ctx) {
            report("tracking");
            const s = latest.current;
            renderLook(ctx, points, s.palette, s.intensity, s.look, s.mode, s.teachingZone);
          } else report("no-face");
        }
      }
      frame = requestAnimationFrame(loop);
    }

    boot();
    return () => { cancelled = true; cancelAnimationFrame(frame); landmarker?.close(); };
  }, [enabled, onStatus, videoRef]);

  return <canvas ref={canvasRef} className="face-mesh-canvas" aria-label="实时面部网格妆效叠加层" />;
}
