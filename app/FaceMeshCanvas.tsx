"use client";

/* Legacy stroke helpers remain available for the instructional overlay; the
 * live look intentionally uses landmark-bounded pigment bands instead. */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { RefObject, useEffect, useRef } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { trackingQuality } from "./trackingQuality";
import { smoothLandmarks } from "./faceSmoothing";
import type { MakeupEffectProfile } from "./makeupAnalysis";
import type { TrackingQuality } from "./trackingQuality";
export type { TrackingQuality } from "./trackingQuality";
export type FaceLandmarks = NormalizedLandmark[];

export type MeshStatus =
  | "idle"
  | "loading"
  | "tracking"
  | "no-face"
  | "fallback";

export type GazeStatus = "aligned" | "down" | "unknown";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  palette: string[];
  effectProfile: MakeupEffectProfile;
  intensity: number;
  look: "daily" | "smoky" | "contour";
  teachingZone?: string;
  mode: "tryon" | "teach";
  effectsEnabled?: boolean;
  showMesh?: boolean;
  brushDirection?: string;
  landmarksRef?: RefObject<FaceLandmarks | null>;
  onStatus: (status: MeshStatus) => void;
  onQuality?: (quality: TrackingQuality) => void;
  onGaze?: (status: GazeStatus) => void;
};

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
// Full eye loops include the iris and must never be used as an eyeshadow mask.
// These two upper/lower lid arcs define skin-only makeup bands instead.
const LEFT_UPPER_LID = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const RIGHT_UPPER_LID = [362, 398, 384, 385, 386, 387, 388, 466, 263];
const LEFT_LOWER_LID = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const RIGHT_LOWER_LID = [362, 382, 381, 380, 374, 373, 390, 249, 263];
const LEFT_BROW = [70, 63, 105, 66, 107];
const RIGHT_BROW = [300, 293, 334, 296, 336];
// Compact cheek planes avoid covering the jaw or side of the face with a
// single coloured polygon. Their soft edge is what gives the filter a makeup
// rather than sticker-like appearance.
const LEFT_CHEEK = [50, 101, 205, 187, 123, 116];
const RIGHT_CHEEK = [280, 330, 425, 411, 352, 345];
const LEFT_CONTOUR = [234, 93, 132, 123, 205, 50, 101];
const RIGHT_CONTOUR = [454, 323, 361, 352, 425, 330, 280];
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 95,
];
const LEFT_JAW = [234, 127, 162, 21, 54, 103, 67, 109];
const RIGHT_JAW = [454, 356, 389, 251, 284, 332, 297, 338];
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function rgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

type CanvasPoint = { x: number; y: number };

function toCanvasPoint(point: NormalizedLandmark, canvas: HTMLCanvasElement): CanvasPoint {
  return { x: point.x * canvas.width, y: point.y * canvas.height };
}

function interpolatePoint(from: CanvasPoint, to: CanvasPoint, amount: number): CanvasPoint {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function makeUpperLidBand(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  eyeIds: number[],
  browIds: number[],
  lift = 0.42,
  lashInset = 0.075,
  start = 0,
  end = eyeIds.length - 1,
): CanvasPoint[] {
  const lash = eyeIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const crease = lash.map((point, index) => {
    const browIndex = Math.round((index / (lash.length - 1)) * (browIds.length - 1));
    return interpolatePoint(point, toCanvasPoint(points[browIds[browIndex]], ctx.canvas), lift);
  });
  // Start a few pixels *above* the tracked lash curve. Apart from making the
  // pigment look more like it sits on skin, this deliberately leaves the
  // cornea and the wet lash line outside of the makeup mask.
  const lidBase = lash.map((point, index) =>
    interpolatePoint(point, crease[index], lashInset),
  );
  return [
    ...lidBase.slice(start, end + 1),
    ...crease.slice(start, end + 1).reverse(),
  ];
}

function makeLowerLidBand(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  lowerIds: number[],
  upperIds: number[],
  depth = 0.7,
): CanvasPoint[] {
  const upper = upperIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const lash = lowerIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  // Move away from each eye's upper-to-lower vector instead of simply moving
  // downward in screen coordinates. This follows a tilted face and prevents
  // a lower-eye effect from drifting back over the iris.
  const outerSkin = lash.map((point, index) => {
    const upperIndex = Math.round((index / (lash.length - 1)) * (upper.length - 1));
    const upperPoint = upper[upperIndex];
    const dx = point.x - upperPoint.x;
    const dy = point.y - upperPoint.y;
    const distance = Math.max(5, Math.hypot(dx, dy));
    return {
      x: point.x + (dx / distance) * distance * depth,
      y: point.y + (dy / distance) * distance * depth,
    };
  });
  return [
    ...lash,
    ...outerSkin.reverse(),
  ];
}

function gazeStatus(points: NormalizedLandmark[]): GazeStatus {
  if (points.length < 478) return "unknown";
  const eyeRatio = (eyeIds: number[], irisIds: number[]) => {
    const ys = eyeIds.map((id) => points[id]?.y).filter((value): value is number => value !== undefined);
    const irisY = irisIds.reduce((total, id) => total + (points[id]?.y ?? 0), 0) / irisIds.length;
    const top = Math.min(...ys), bottom = Math.max(...ys);
    return bottom - top < 0.006 ? null : (irisY - top) / (bottom - top);
  };
  const left = eyeRatio([...LEFT_UPPER_LID, ...LEFT_LOWER_LID], LEFT_IRIS);
  const right = eyeRatio([...RIGHT_UPPER_LID, ...RIGHT_LOWER_LID], RIGHT_IRIS);
  if (left === null || right === null) return "unknown";
  return left > 0.64 && right > 0.64 ? "down" : "aligned";
}

let pigmentLayer: HTMLCanvasElement | null = null;

function getPigmentLayer(canvas: HTMLCanvasElement) {
  if (typeof document === "undefined") return null;
  if (!pigmentLayer) pigmentLayer = document.createElement("canvas");
  if (pigmentLayer.width !== canvas.width || pigmentLayer.height !== canvas.height) {
    pigmentLayer.width = canvas.width;
    pigmentLayer.height = canvas.height;
  }
  return pigmentLayer;
}

function paintFeatheredShape(
  ctx: CanvasRenderingContext2D,
  coordinates: CanvasPoint[],
  gradient: CanvasGradient,
  blur: number,
  blend: GlobalCompositeOperation,
) {
  const layer = getPigmentLayer(ctx.canvas);
  if (!layer) return;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;
  layerCtx.clearRect(0, 0, layer.width, layer.height);
  layerCtx.save();
  layerCtx.filter = `blur(${blur}px)`;
  layerCtx.fillStyle = gradient;
  layerCtx.beginPath();
  coordinates.forEach((point, index) => index ? layerCtx.lineTo(point.x, point.y) : layerCtx.moveTo(point.x, point.y));
  layerCtx.closePath();
  layerCtx.fill();
  layerCtx.restore();
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.drawImage(layer, 0, 0);
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
  const layer = getPigmentLayer(ctx.canvas);
  const layerCtx = layer?.getContext("2d");
  if (!layerCtx) return;
  const gradient = layerCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.2);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.68, rgba(color, alpha * 0.6));
  gradient.addColorStop(1, rgba(color, 0));
  paintFeatheredShape(ctx, coordinates, gradient, blur, blend);
}

function softlyFillCoordinates(
  ctx: CanvasRenderingContext2D,
  coordinates: CanvasPoint[],
  color: string,
  alpha: number,
  blur: number,
  blend: GlobalCompositeOperation,
) {
  const center = coordinates.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  center.x /= coordinates.length;
  center.y /= coordinates.length;
  const radius = Math.max(
    14,
    ...coordinates.map((point) => Math.hypot(point.x - center.x, point.y - center.y)),
  );
  const layer = getPigmentLayer(ctx.canvas);
  const layerCtx = layer?.getContext("2d");
  if (!layerCtx) return;
  const gradient = layerCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.18);
  // The two inner stops give pigment a denser centre but retain visible skin
  // texture through blend modes. A single flat fill is what reads as a sticker.
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.38, rgba(color, alpha * 0.78));
  gradient.addColorStop(0.72, rgba(color, alpha * 0.35));
  gradient.addColorStop(1, rgba(color, 0));
  paintFeatheredShape(ctx, coordinates, gradient, blur, blend);
}

/**
 * A diffuse, symmetric pigment cloud.  Unlike a clipped polygon this has no
 * visible edge to read as a drawn shape, so it works well for cream blush,
 * contour and liquid highlight.  Keeping the two centres mirrored around the
 * nose bridge avoids one side of the face looking more heavily made up when a
 * webcam landmark jitters for a frame.
 */
function softlyFillEllipse(
  ctx: CanvasRenderingContext2D,
  center: CanvasPoint,
  radiusX: number,
  radiusY: number,
  color: string,
  alpha: number,
  blur: number,
  blend: GlobalCompositeOperation,
  rotation = 0,
) {
  const safeY = Math.max(8, radiusY);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.scale(Math.max(0.45, radiusX / safeY), 1);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, safeY);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.45, rgba(color, alpha * 0.72));
  gradient.addColorStop(0.78, rgba(color, alpha * 0.24));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.filter = `blur(${blur}px)`;
  ctx.globalCompositeOperation = blend;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, safeY, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function applyFoundation(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  shade: string,
  intensity: number,
) {
  // Render into the same feathered pigment pipeline as colour makeup.  A hard
  // canvas clip creates an obvious line at the hairline/forehead, especially
  // under strong overhead lighting.
  softlyFillPolygon(ctx, points, FACE_OVAL, shade, intensity * 0.5, 26, "source-over");
  softlyFillPolygon(ctx, points, FACE_OVAL, "#fff0e9", intensity * 0.32, 30, "soft-light");
}

function averagePoint(coordinates: CanvasPoint[]) {
  return coordinates.reduce(
    (total, point) => ({ x: total.x + point.x / coordinates.length, y: total.y + point.y / coordinates.length }),
    { x: 0, y: 0 },
  );
}

function faceMakeupAnchors(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[]) {
  const nose = toCanvasPoint(points[1], ctx.canvas);
  const left = averagePoint(LEFT_CHEEK.map((id) => toCanvasPoint(points[id], ctx.canvas)));
  const right = averagePoint(RIGHT_CHEEK.map((id) => toCanvasPoint(points[id], ctx.canvas)));
  // Use the averaged height and mirrored X positions.  This is less literal
  // than raw landmarks but much more flattering and stable for a live filter.
  const cheekY = (left.y + right.y) / 2;
  const cheekDistance = Math.max(26, (Math.abs(left.x - nose.x) + Math.abs(right.x - nose.x)) / 2);
  const cheekLeft = { x: nose.x - cheekDistance, y: cheekY };
  const cheekRight = { x: nose.x + cheekDistance, y: cheekY };
  // Unlike blush, face-side sculpting must remain faithful to the real left
  // and right contours while the head turns.  These anchors therefore use the
  // live contour landmarks instead of a mirrored, fixed offset.
  const leftSide = averagePoint(LEFT_CONTOUR.map((id) => toCanvasPoint(points[id], ctx.canvas)));
  const rightSide = averagePoint(RIGHT_CONTOUR.map((id) => toCanvasPoint(points[id], ctx.canvas)));
  const bridge = toCanvasPoint(points[6], ctx.canvas);
  const tip = toCanvasPoint(points[4], ctx.canvas);
  const noseWidth = Math.max(12, Math.abs(toCanvasPoint(points[98], ctx.canvas).x - toCanvasPoint(points[327], ctx.canvas).x));
  return { cheekLeft, cheekRight, cheekDistance, leftSide, rightSide, bridge, tip, noseWidth };
}

function faceTurnFactor(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[]) {
  const nose = toCanvasPoint(points[1], ctx.canvas);
  const leftEdge = toCanvasPoint(points[234], ctx.canvas);
  const rightEdge = toCanvasPoint(points[454], ctx.canvas);
  const leftDistance = Math.max(1, Math.abs(nose.x - leftEdge.x));
  const rightDistance = Math.max(1, Math.abs(rightEdge.x - nose.x));
  const asymmetry = Math.abs(leftDistance - rightDistance) / (leftDistance + rightDistance);
  // Makeup filtering needs a frontal-ish canvas.  When a face turns, a flat
  // 2D pigment layer cannot faithfully wrap its far cheek, so fading it is
  // more natural than allowing a shadow to float across the face.
  return Math.max(0.18, Math.min(1, 1 - Math.max(0, asymmetry - 0.06) * 3.4));
}

function pairedEyeFactor(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[]) {
  const openness = (upperIds: number[], lowerIds: number[]) => {
    const upper = toCanvasPoint(points[upperIds[Math.floor(upperIds.length / 2)]], ctx.canvas);
    const lower = toCanvasPoint(points[lowerIds[Math.floor(lowerIds.length / 2)]], ctx.canvas);
    const first = toCanvasPoint(points[upperIds[0]], ctx.canvas);
    const last = toCanvasPoint(points[upperIds.at(-1)!], ctx.canvas);
    return Math.abs(lower.y - upper.y) / Math.max(1, Math.hypot(last.x - first.x, last.y - first.y));
  };
  const minimum = Math.min(openness(LEFT_UPPER_LID, LEFT_LOWER_LID), openness(RIGHT_UPPER_LID, RIGHT_LOWER_LID));
  // If either eye is blinking / partly occluded, lower both eye overlays for
  // that frame. A matched, softer pair looks better than one painted eyelid.
  return Math.max(0.28, Math.min(1, (minimum - 0.045) * 15));
}

function scaleCoordinates(coordinates: CanvasPoint[], xScale: number, yScale: number) {
  const center = averagePoint(coordinates);
  return coordinates.map((point) => ({
    x: center.x + (point.x - center.x) * xScale,
    y: center.y + (point.y - center.y) * yScale,
  }));
}

function outlineCoordinates(
  ctx: CanvasRenderingContext2D,
  coordinates: CanvasPoint[],
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = 1.35;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  coordinates.forEach((point, index) => {
    if (index) ctx.lineTo(point.x, point.y);
    else ctx.moveTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function polygonArea(coordinates: CanvasPoint[]) {
  return Math.abs(coordinates.reduce((sum, point, index) => {
    const next = coordinates[(index + 1) % coordinates.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function balancedAlpha(base: number, left: CanvasPoint[], right: CanvasPoint[]) {
  const leftArea = Math.max(1, polygonArea(left));
  const rightArea = Math.max(1, polygonArea(right));
  const mean = (leftArea + rightArea) / 2;
  // Landmark geometry is intentionally faithful to the user's face, but the
  // pigment density should not become visibly heavier on the smaller side.
  return [
    base * Math.max(0.82, Math.min(1.18, mean / leftArea)),
    base * Math.max(0.82, Math.min(1.18, mean / rightArea)),
  ] as const;
}

function lightingCompensation(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[]) {
  try {
    const sampleIds = [1, 4, 6, 168, 197];
    const samples = sampleIds.map((id) => {
      const point = toCanvasPoint(points[id], ctx.canvas);
      return ctx.getImageData(
        Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(point.x))),
        Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(point.y))), 1, 1,
      ).data;
    });
    const luma = samples.reduce((sum, rgba) => sum + 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2], 0) / samples.length;
    // Dim webcam scenes need a touch more pigment; bright scenes need less to
    // avoid a chalky mask. Keep the range deliberately conservative.
    return Math.max(0.86, Math.min(1.16, 1.08 - (luma / 255) * 0.16));
  } catch {
    return 1;
  }
}

function drawLashLine(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  ids: number[],
  color: string,
  alpha: number,
) {
  const coordinates = ids.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const width = Math.max(1.15, Math.hypot(coordinates[0].x - coordinates.at(-1)!.x, coordinates[0].y - coordinates.at(-1)!.y) * 0.035);
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.shadowColor = rgba(color, alpha * 0.55);
  ctx.shadowBlur = 1.5;
  ctx.beginPath();
  coordinates.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.restore();
}

function drawLashes(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  eyeIds: number[],
  browIds: number[],
  color: string,
  alpha: number,
) {
  const lash = eyeIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineCap = "round";
  ctx.lineWidth = 1.05;
  [1, 2, 3, 4, 5, 6].forEach((index) => {
    const from = lash[index];
    const brow = toCanvasPoint(points[browIds[Math.round((index / (lash.length - 1)) * (browIds.length - 1))]], ctx.canvas);
    const length = Math.min(11, Math.max(4, Math.hypot(brow.x - from.x, brow.y - from.y) * 0.18));
    const dx = brow.x - from.x, dy = brow.y - from.y, distance = Math.max(1, Math.hypot(dx, dy));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(from.x + (dx / distance) * length * 0.4, from.y + (dy / distance) * length * 0.65, from.x + (dx / distance) * length, from.y + (dy / distance) * length);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBrows(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], ids: number[], color: string, alpha: number) {
  const coordinates = ids.map((id) => toCanvasPoint(points[id], ctx.canvas));
  ctx.save();
  // Powder shadow first, then sparse short hairs: this is deliberately not a
  // single dark marker line, which is the main reason virtual brows look fake.
  ctx.strokeStyle = rgba(color, alpha * 0.52);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.2, Math.hypot(coordinates[0].x - coordinates.at(-1)!.x, coordinates[0].y - coordinates.at(-1)!.y) * 0.105);
  ctx.filter = "blur(1.15px)";
  ctx.beginPath();
  coordinates.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.filter = "none";
  ctx.strokeStyle = rgba(color, alpha * 0.42);
  ctx.lineWidth = 0.8;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index];
    const to = coordinates[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    for (const position of [0.18, 0.52, 0.82]) {
      const x = from.x + dx * position;
      const y = from.y + dy * position;
      ctx.beginPath();
      ctx.moveTo(x - nx * 1.5, y - ny * 1.5);
      ctx.lineTo(x + nx * 2.8, y + ny * 2.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawContacts(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], ids: number[], color: string, alpha: number) {
  const coordinates = ids.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const center = coordinates.reduce((sum, point) => ({ x: sum.x + point.x / coordinates.length, y: sum.y + point.y / coordinates.length }), { x: 0, y: 0 });
  const radius = Math.max(2.5, coordinates.reduce((sum, point) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) / coordinates.length);
  ctx.save();
  const radial = ctx.createRadialGradient(center.x, center.y, radius * 0.34, center.x, center.y, radius * 1.04);
  radial.addColorStop(0, rgba(color, 0));
  radial.addColorStop(0.48, rgba(color, alpha * 0.22));
  radial.addColorStop(0.8, rgba(color, alpha * 0.76));
  radial.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(color, alpha * 0.62);
  ctx.lineWidth = Math.max(0.8, radius * 0.28);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSoftCrease(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  eyeIds: number[],
  browIds: number[],
  color: string,
  alpha: number,
) {
  const lash = eyeIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const crease = lash.map((point, index) => {
    const brow = toCanvasPoint(points[browIds[Math.round((index / (lash.length - 1)) * (browIds.length - 1))]], ctx.canvas);
    return interpolatePoint(point, brow, 0.46);
  });
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = Math.max(1.35, Math.hypot(crease[0].x - crease.at(-1)!.x, crease[0].y - crease.at(-1)!.y) * 0.022);
  ctx.lineCap = "round";
  ctx.filter = "blur(1.8px)";
  ctx.globalCompositeOperation = "multiply";
  ctx.beginPath();
  crease.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.stroke();
  ctx.restore();
}

function drawSoftWing(
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmark[],
  eyeIds: number[],
  color: string,
  alpha: number,
) {
  const eye = eyeIds.map((id) => toCanvasPoint(points[id], ctx.canvas));
  const nose = toCanvasPoint(points[1], ctx.canvas);
  const first = eye[0];
  const last = eye.at(-1)!;
  const outer = Math.abs(first.x - nose.x) > Math.abs(last.x - nose.x) ? first : last;
  const inner = outer === first ? last : first;
  const span = Math.max(8, Math.hypot(outer.x - inner.x, outer.y - inner.y));
  const outward = outer.x < nose.x ? -1 : 1;
  const tip = { x: outer.x + outward * span * 0.23, y: outer.y - span * 0.1 };
  const base = interpolatePoint(outer, inner, 0.24);
  softlyFillCoordinates(ctx, [outer, base, tip], color, alpha, 1.45, "multiply");
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
  // The complete canvas is mirrored to make the camera behave like a mirror.
  // Counter-mirror only glyphs so directions and labels remain readable.
  ctx.font="700 12px Arial";
  ctx.save();ctx.scale(-1,1);ctx.fillText(label,-(x1+8),y1-9);ctx.restore();
  ctx.restore();
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
  effectProfile: MakeupEffectProfile,
  intensity: number,
  look: Props["look"],
  mode: Props["mode"],
  teachingZone?: string,
) {
  // Use layered translucent pigment rather than a single opaque mask. This
  // keeps skin texture visible while making the selected look legible on a
  // webcam, even at the default 55% intensity.
  const light = lightingCompensation(ctx, points);
  const a = Math.max(0.13, Math.min(0.72, (intensity / 100) * 0.78 * light));
  const guide = "rgba(255,255,255,.9)";
  const leftLid = makeUpperLidBand(ctx, points, LEFT_UPPER_LID, LEFT_BROW);
  const rightLid = makeUpperLidBand(ctx, points, RIGHT_UPPER_LID, RIGHT_BROW);
  const leftOuterLid = makeUpperLidBand(ctx, points, LEFT_UPPER_LID, LEFT_BROW, 0.42, 0.09, 0, 4);
  const rightOuterLid = makeUpperLidBand(ctx, points, RIGHT_UPPER_LID, RIGHT_BROW, 0.42, 0.09, 0, 4);
  const leftLiner = makeUpperLidBand(ctx, points, LEFT_UPPER_LID, LEFT_BROW, 0.16, 0.025);
  const rightLiner = makeUpperLidBand(ctx, points, RIGHT_UPPER_LID, RIGHT_BROW, 0.16, 0.025);
  const leftLower = makeLowerLidBand(ctx, points, LEFT_LOWER_LID, LEFT_UPPER_LID);
  const rightLower = makeLowerLidBand(ctx, points, RIGHT_LOWER_LID, RIGHT_UPPER_LID);
  const eyeA = a * pairedEyeFactor(ctx, points);
  if (mode === "teach") {
    if (teachingZone === "prep") {
      // Complexion preparation is a face-wide process.  Do not reuse the eye
      // mask here: it makes a foundation lesson look like an eye-shadow guide.
      softlyFillPolygon(ctx, points, FACE_OVAL, palette[2], a * 0.26, 22, "soft-light");
      outlineCoordinates(ctx, FACE_OVAL.map((id) => toCanvasPoint(points[id], ctx.canvas)), guide);
    } else if (look === "contour") {
      const useJaw = teachingZone === "jaw" || teachingZone === "scan";
      const left = useJaw ? LEFT_JAW : LEFT_CHEEK;
      const right = useJaw ? RIGHT_JAW : RIGHT_CHEEK;
      const [leftAlpha, rightAlpha] = balancedAlpha(a * 0.36, left.map((id) => toCanvasPoint(points[id], ctx.canvas)), right.map((id) => toCanvasPoint(points[id], ctx.canvas)));
      softlyFillPolygon(ctx, points, left, effectProfile.contour, leftAlpha, 12, "multiply");
      softlyFillPolygon(ctx, points, right, effectProfile.contour, rightAlpha, 12, "multiply");
      outlineCoordinates(ctx, left.map((id) => toCanvasPoint(points[id], ctx.canvas)), guide);
      outlineCoordinates(ctx, right.map((id) => toCanvasPoint(points[id], ctx.canvas)), guide);
    } else {
      const zone = teachingZone || "base";
      if (zone === "cheek") {
        const left = LEFT_CHEEK.map((id) => toCanvasPoint(points[id], ctx.canvas));
        const right = RIGHT_CHEEK.map((id) => toCanvasPoint(points[id], ctx.canvas));
        const [leftAlpha, rightAlpha] = balancedAlpha(a * effectProfile.cheekOpacity * 1.35, left, right);
        softlyFillCoordinates(ctx, left, effectProfile.cheek, leftAlpha, 14, "soft-light");
        softlyFillCoordinates(ctx, right, effectProfile.cheek, rightAlpha, 14, "soft-light");
        outlineCoordinates(ctx, left, guide);
        outlineCoordinates(ctx, right, guide);
      } else {
      const [left, right] = zone === "outer"
        ? [leftOuterLid, rightOuterLid]
        : zone === "liner"
          ? [leftLiner, rightLiner]
          : zone === "lower"
            ? [leftLower, rightLower]
            : [leftLid, rightLid];
      const color = zone === "highlight" ? palette[2] : zone === "lower" ? effectProfile.lowerEye : zone === "outer" || zone === "liner" ? effectProfile.eyeOuter : effectProfile.eyeBase;
      const [leftAlpha, rightAlpha] = balancedAlpha(a * effectProfile.eyeOpacity, left, right);
      softlyFillCoordinates(ctx, left, color, leftAlpha, zone === "liner" ? 2 : 5, zone === "liner" ? "multiply" : "soft-light");
      softlyFillCoordinates(ctx, right, color, rightAlpha, zone === "liner" ? 2 : 5, zone === "liner" ? "multiply" : "soft-light");
      outlineCoordinates(ctx, left, guide);
      outlineCoordinates(ctx, right, guide);
      }
    }
    const nose = points[1];
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "700 13px Arial";
    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillText(
      "当前步骤区域",
      -(nose.x * ctx.canvas.width - 44),
      nose.y * ctx.canvas.height - 36,
    );
    ctx.restore();
    return;
  }
  // Foundation is the shared base of every colour layer.  Without it, even a
  // good lip or eye mask reads as isolated paint on uneven webcam lighting.
  applyFoundation(ctx, points, palette[2], a);
  softlyFillPolygon(ctx, points, FACE_OVAL, palette[2], a * 0.22, 20, "soft-light");
  const { cheekLeft, cheekRight, cheekDistance, leftSide, rightSide, bridge, tip, noseWidth } = faceMakeupAnchors(ctx, points);
  const turn = faceTurnFactor(ctx, points);
  const blushPlan = look === "daily"
    ? {
        // 斜向提拉：从颧骨外侧向太阳穴带开，适合通勤消肿感。
        left: { x: cheekLeft.x - cheekDistance * 0.04, y: cheekLeft.y - cheekDistance * 0.15 },
        right: { x: cheekRight.x + cheekDistance * 0.04, y: cheekRight.y - cheekDistance * 0.15 },
        radiusX: cheekDistance * 0.88, radiusY: cheekDistance * 0.36, leftRotation: -0.34, rightRotation: 0.34,
      }
    : look === "smoky"
      ? {
          // 眼下氛围腮红：更靠近面中和下眼睑，呼应烟熏眼妆。
          left: { x: cheekLeft.x + cheekDistance * 0.28, y: cheekLeft.y - cheekDistance * 0.44 },
          right: { x: cheekRight.x - cheekDistance * 0.28, y: cheekRight.y - cheekDistance * 0.44 },
          radiusX: cheekDistance * 0.7, radiusY: cheekDistance * 0.62, leftRotation: 0.06, rightRotation: -0.06,
        }
      : {
          // 团状收缩腮红：面积更集中，配合修容令面中视觉更短。
          left: { x: cheekLeft.x + cheekDistance * 0.15, y: cheekLeft.y + cheekDistance * 0.1 },
          right: { x: cheekRight.x - cheekDistance * 0.15, y: cheekRight.y + cheekDistance * 0.1 },
          radiusX: cheekDistance * 0.55, radiusY: cheekDistance * 0.56, leftRotation: 0, rightRotation: 0,
        };
  const { left: blushLeft, right: blushRight, radiusX: blushRadiusX, radiusY: blushRadiusY, leftRotation, rightRotation } = blushPlan;
  // Face makeup is applied before detail makeup.  This is the important order:
  // the viewer should first perceive healthy skin, sculpting and lip colour,
  // not a black line around each eye.
  const blushStrength = look === "smoky" ? 0.98 : look === "contour" ? 0.84 : 1.04;
  softlyFillEllipse(ctx, blushLeft, blushRadiusX, blushRadiusY, effectProfile.cheek, a * blushStrength, 15, "soft-light", leftRotation);
  softlyFillEllipse(ctx, blushRight, blushRadiusX, blushRadiusY, effectProfile.cheek, a * blushStrength, 15, "soft-light", rightRotation);
  // A smaller warm core stops blush reading as a flat coloured patch while
  // preserving the webcam's natural skin texture.
  softlyFillEllipse(ctx, blushLeft, blushRadiusX * 0.56, blushRadiusY * 0.52, palette[0], a * 0.34, 10, "soft-light", leftRotation);
  softlyFillEllipse(ctx, blushRight, blushRadiusX * 0.56, blushRadiusY * 0.52, palette[0], a * 0.34, 10, "soft-light", rightRotation);

  // Side sculpting follows the actual left/right landmark planes.  This fixes
  // the old "floating side shadow" when the head is shifted or slightly turned.
  const leftContourCenter = { x: leftSide.x, y: leftSide.y + blushRadiusY * 0.12 };
  const rightContourCenter = { x: rightSide.x, y: rightSide.y + blushRadiusY * 0.12 };
  const contourStrength = look === "contour" ? 0.58 : 0.34;
  softlyFillEllipse(ctx, leftContourCenter, cheekDistance * 0.22, cheekDistance * 0.7, effectProfile.contour, a * contourStrength * turn, 20, "multiply", -0.34);
  softlyFillEllipse(ctx, rightContourCenter, cheekDistance * 0.22, cheekDistance * 0.7, effectProfile.contour, a * contourStrength * turn, 20, "multiply", 0.34);
  // Highlight sits above blush and contour as a narrow light reflection, not
  // a white painted stripe.  Screen makes it respond to the user's own light.
  const highlightLift = blushRadiusY * 0.72;
  softlyFillEllipse(ctx, { x: blushLeft.x - cheekDistance * 0.08, y: blushLeft.y - highlightLift }, cheekDistance * 0.48, cheekDistance * 0.19, palette[2], a * 0.68, 11, "screen", leftRotation);
  softlyFillEllipse(ctx, { x: blushRight.x + cheekDistance * 0.08, y: blushRight.y - highlightLift }, cheekDistance * 0.48, cheekDistance * 0.19, palette[2], a * 0.68, 11, "screen", rightRotation);
  // Nose contour uses bridge + tip landmarks rather than screen coordinates,
  // so its two soft shadows travel with the nose.  The centre highlight is
  // deliberately narrower and brighter, like a liquid rather than a stripe.
  const bridgeLength = Math.max(16, Math.hypot(tip.x - bridge.x, tip.y - bridge.y));
  const noseAngle = Math.atan2(tip.y - bridge.y, tip.x - bridge.x) - Math.PI / 2;
  const noseMid = { x: (bridge.x + tip.x) / 2, y: (bridge.y + tip.y) / 2 };
  const noseSculpt = look === "contour" ? 0.78 : 0.55;
  softlyFillEllipse(ctx, { x: noseMid.x - noseWidth * 0.36, y: noseMid.y }, noseWidth * 0.16, bridgeLength * 0.58, effectProfile.contour, a * noseSculpt * turn, 9, "multiply", noseAngle);
  softlyFillEllipse(ctx, { x: noseMid.x + noseWidth * 0.36, y: noseMid.y }, noseWidth * 0.16, bridgeLength * 0.58, effectProfile.contour, a * noseSculpt * turn, 9, "multiply", noseAngle);
  softlyFillEllipse(ctx, { x: noseMid.x, y: noseMid.y - bridgeLength * 0.12 }, noseWidth * 0.11, bridgeLength * 0.46, palette[2], a * 0.62 * turn, 8, "screen", noseAngle);
  softlyFillEllipse(ctx, tip, noseWidth * 0.36, noseWidth * 0.16, palette[2], a * 0.56 * turn, 7, "screen");
  // Two translucent lip passes retain the lip texture while making the colour
  // strong enough to be visible on a typical webcam.
  const lips = LIPS.map((id) => toCanvasPoint(points[id], ctx.canvas));
  // A restrained lip-liner expansion gives a more defined cupid's bow and
  // fuller visual lip shape without distorting the user's face image.
  softlyFillCoordinates(ctx, scaleCoordinates(lips, 1.055, 1.14), effectProfile.lip, a * 0.32, 3.5, "soft-light");
  softlyFillPolygon(ctx, points, LIPS, effectProfile.lip, a * (look === "smoky" ? 1.18 : 1.08), 4, "soft-light");
  softlyFillPolygon(ctx, points, LIPS, effectProfile.lip, a * 0.46, 2.5, "source-over");
  if (look !== "contour") {
    // The blend modes intentionally mirror the compositing vocabulary used by
    // production effect editors: shadow darkens underlying skin while highlight
    // retains texture instead of painting an opaque flat colour.
    // Three very soft passes mimic the subtle, camera-friendly layering used
    // by short-video makeup effects: diffuse base, darker outer corner, and
    // a tiny centre highlight. There are deliberately no hard outlines.
    const baseBlend = "soft-light";
    const [leftBaseAlpha, rightBaseAlpha] = balancedAlpha(eyeA * effectProfile.eyeOpacity * (look === "smoky" ? 1.35 : 1.08), leftLid, rightLid);
    softlyFillCoordinates(ctx, leftLid, effectProfile.eyeBase, leftBaseAlpha, 5, baseBlend);
    softlyFillCoordinates(ctx, rightLid, effectProfile.eyeBase, rightBaseAlpha, 5, baseBlend);
    const outerA = look === "smoky" ? eyeA * 1.35 : eyeA * 0.82;
    const [leftOuterAlpha, rightOuterAlpha] = balancedAlpha(outerA * effectProfile.eyeOpacity, leftOuterLid, rightOuterLid);
    softlyFillCoordinates(ctx, leftOuterLid, effectProfile.eyeOuter, leftOuterAlpha, 6, "multiply");
    softlyFillCoordinates(ctx, rightOuterLid, effectProfile.eyeOuter, rightOuterAlpha, 6, "multiply");
    // A second pigment pass gives a smoky look its opaque-to-translucent
    // powder gradient instead of a single grey overlay.
    const [leftOuterDepth, rightOuterDepth] = balancedAlpha(eyeA * (look === "smoky" ? 0.46 : 0.2), leftOuterLid, rightOuterLid);
    softlyFillCoordinates(ctx, leftOuterLid, effectProfile.eyeOuter, leftOuterDepth, 7, "soft-light");
    softlyFillCoordinates(ctx, rightOuterLid, effectProfile.eyeOuter, rightOuterDepth, 7, "soft-light");
    const [leftLowerAlpha, rightLowerAlpha] = balancedAlpha(eyeA * effectProfile.eyeOpacity * (look === "smoky" ? 0.48 : 0.28), leftLower, rightLower);
    softlyFillCoordinates(ctx, leftLower, effectProfile.lowerEye, leftLowerAlpha, 3, "multiply");
    softlyFillCoordinates(ctx, rightLower, effectProfile.lowerEye, rightLowerAlpha, 3, "multiply");
    // Eyeliner is a skin-only band placed just above the lash curve.  It has
    // pigment density but no freehand stroke, so it avoids drawing over iris
    // reflections and remains usable with glasses.
    const [leftLinerAlpha, rightLinerAlpha] = balancedAlpha(eyeA * (look === "smoky" ? 0.94 : 0.66), leftLiner, rightLiner);
    softlyFillCoordinates(ctx, leftLiner, effectProfile.eyeOuter, leftLinerAlpha, 2.25, "multiply");
    softlyFillCoordinates(ctx, rightLiner, effectProfile.eyeOuter, rightLinerAlpha, 2.25, "multiply");
    // Keep both eyes controlled by the skin-only liner band. A procedural
    // triangular wing is too sensitive to one-frame landmark jitter and was
    // responsible for the visibly different left/right block in the preview.
    drawBrows(ctx, points, LEFT_BROW, effectProfile.eyeOuter, eyeA * 0.46);
    drawBrows(ctx, points, RIGHT_BROW, effectProfile.eyeOuter, eyeA * 0.46);
    drawContacts(ctx, points, LEFT_IRIS, palette[0], eyeA * (look === "smoky" ? 0.72 : 0.56));
    drawContacts(ctx, points, RIGHT_IRIS, palette[0], eyeA * (look === "smoky" ? 0.72 : 0.56));
  } else {
    // Contour look still carries the complete base makeup; it just prioritizes
    // face sculpting instead of the stronger eye emphasis of smoky makeup.
    softlyFillCoordinates(ctx, leftLid, effectProfile.eyeBase, a * 0.44, 5, "soft-light");
    softlyFillCoordinates(ctx, rightLid, effectProfile.eyeBase, a * 0.44, 5, "soft-light");
    softlyFillCoordinates(ctx, leftLiner, effectProfile.eyeOuter, a * 0.42, 1.8, "multiply");
    softlyFillCoordinates(ctx, rightLiner, effectProfile.eyeOuter, a * 0.42, 1.8, "multiply");
    drawBrows(ctx, points, LEFT_BROW, effectProfile.eyeOuter, a * 0.38);
    drawBrows(ctx, points, RIGHT_BROW, effectProfile.eyeOuter, a * 0.38);
    drawContacts(ctx, points, LEFT_IRIS, palette[0], a * 0.44);
    drawContacts(ctx, points, RIGHT_IRIS, palette[0], a * 0.44);
    // The shared face-makeup layer above carries blush, lip colour, sculpting
    // and highlight for this look too; contour simply keeps its eye makeup
    // intentionally light.
  }
}

export default function FaceMeshCanvas({
  videoRef,
  enabled,
  palette,
  effectProfile,
  intensity,
  look,
  teachingZone,
  mode,
  effectsEnabled = true,
  showMesh = false,
  brushDirection,
  landmarksRef,
  onStatus,
  onQuality,
  onGaze,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({
    palette,
    effectProfile,
    intensity,
    look,
    teachingZone,
    mode,
    effectsEnabled,
    showMesh,
    brushDirection,
  });
  useEffect(() => {
    latest.current = { palette, effectProfile, intensity, look, teachingZone, mode, effectsEnabled, showMesh, brushDirection };
  }, [palette, effectProfile, intensity, look, teachingZone, mode, effectsEnabled, showMesh, brushDirection]);

  useEffect(() => {
    if (!enabled || landmarksRef) return;
    let cancelled = false;
    let frame = 0;
    let landmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let previousPoints: FaceLandmarks | null = null;
    let lastStatus: MeshStatus = "idle";
    let lastQuality: TrackingQuality = "waiting";
    let lastGaze: GazeStatus = "unknown";
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
            const gaze = gazeStatus(points);
            if (gaze !== lastGaze) {
              lastGaze = gaze;
              onGaze?.(gaze);
            }
            if (s.showMesh) drawMesh(ctx, points);
            if (s.effectsEnabled) renderLook(ctx, points, s.palette, s.effectProfile, s.intensity, s.look, s.mode, s.teachingZone);
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
  }, [enabled, landmarksRef, onGaze, onStatus, onQuality, videoRef]);

  useEffect(() => {
    if (!enabled || !landmarksRef) return;
    let cancelled = false;
    let frame = 0;
    let lastVideoTime = -1;
    let lastGaze: GazeStatus = "unknown";
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
          const gaze = gazeStatus(points);
          if (gaze !== lastGaze) {
            lastGaze = gaze;
            onGaze?.(gaze);
          }
          if (s.showMesh) drawMesh(ctx, points);
          if (s.effectsEnabled) renderLook(ctx, points, s.palette, s.effectProfile, s.intensity, s.look, s.mode, s.teachingZone);
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
  }, [enabled, landmarksRef, onGaze, videoRef]);

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
  onGaze,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  landmarksRef: RefObject<FaceLandmarks | null>;
  onStatus: (status: MeshStatus) => void;
  onQuality?: (quality: TrackingQuality) => void;
  onGaze?: (status: GazeStatus) => void;
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
    let lastGaze: GazeStatus = "unknown";
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
          const gaze = gazeStatus(points);
          if (gaze !== lastGaze) {
            lastGaze = gaze;
            onGaze?.(gaze);
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
  }, [enabled, landmarksRef, onGaze, onQuality, onStatus, videoRef]);
  return null;
}
