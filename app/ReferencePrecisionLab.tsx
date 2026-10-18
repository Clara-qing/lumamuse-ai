"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { makeupZones } from "./makeupZones";

const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const colors = ["#76505a", "#68424c", "#a16b75", "#bd7f83", "#8c6453", "#a95866", "#d8ad81"];

function drawPath(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], ids: number[], color: string) {
  ctx.beginPath();
  ids.forEach((id, index) => {
    const point = points[id]; if (!point) return;
    const x = point.x * ctx.canvas.width, y = point.y * ctx.canvas.height;
    if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath(); ctx.fillStyle = `${color}35`; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
}

export default function ReferencePrecisionLab({ imageUrl, onBack, onConfirm }: { imageUrl: string; onBack: () => void; onConfirm: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("正在读取参考图并定位面部关键点…");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let closed = false, landmarker: FaceLandmarker | null = null;
    async function mapReference() {
      const image = imageRef.current, canvas = canvasRef.current;
      if (!image || !canvas) return;
      try {
        await new Promise<void>((resolve, reject) => { if (image.complete) resolve(); else { image.onload = () => resolve(); image.onerror = () => reject(new Error("图片读取失败")); } });
        const vision = await FilesetResolver.forVisionTasks(WASM);
        landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL, delegate: "GPU" }, runningMode: "IMAGE", numFaces: 1 });
        const points = landmarker.detect(image).faceLandmarks[0];
        if (!points) throw new Error("没有检测到正脸。请使用无遮挡、正脸且清晰的成妆图。 ");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("无法绘制定位图");
        ctx.drawImage(image, 0, 0);
        makeupZones.forEach((zone, index) => zone.landmarkGroups.forEach((group) => drawPath(ctx, points, group, colors[index])));
        if (!closed) { setStatus("已建立以五官比例为基准的七分区候选坐标图。请先核对轮廓是否贴近实际妆效；它不等同于已识别妆容边界。 "); setReady(true); }
      } catch (error) { if (!closed) setStatus(error instanceof Error ? error.message : "定位失败，请换一张清晰正脸图。 "); }
      finally { landmarker?.close(); }
    }
    mapReference(); return () => { closed = true; landmarker?.close(); };
  }, [imageUrl]);
  return <section className="precision-lab">
    <div className="section-head"><div><p className="kicker">PRECISION MAP · 参考图位置校准</p><h2>先确认“画在哪里”，再决定怎么画</h2></div><p>这不是色彩滤镜。它以参考脸的眼、眉、鼻、唇与面部轮廓建立相对坐标；迁移到用户时按用户自身网格重新映射。</p></div>
    <div className="precision-grid"><div className="precision-canvas"><img ref={imageRef} src={imageUrl} alt="待校准的妆容参考图" /><canvas ref={canvasRef} aria-label="参考图七分区落点图" /></div>
      <div className="precision-panel"><p className="kicker">7 个独立定位层</p><h3>目标落点候选，而非泛泛区域</h3><div className="precision-zone-list">{makeupZones.map((zone, index) => <div key={zone.id}><i style={{ background: colors[index] }} /><b>{zone.label}</b><span>{zone.id === "blush" ? "颧骨高点至太阳穴的候选范围" : zone.id === "contour" ? "颧弓 / 下颌的候选阴影带，不覆盖整张侧脸" : "按局部五官比例锚定"}</span></div>)}</div><p className="lab-message">{status}</p>{ready && <button className="primary" onClick={onConfirm}>确认候选落点，进入本地跟练</button>}</div></div>
    <button className="secondary" onClick={onBack}>返回编辑</button>
  </section>;
}
