"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FaceMeshCanvas, { MeshStatus } from "./FaceMeshCanvas";

type TemplateKey = "daily" | "smoky" | "contour";
type Stage = "upload" | "design" | "tryon" | "coach" | "finish";
type Step = {
  title: string;
  short: string;
  instruction: string;
  tip: string;
  zone: string;
};

const templates: Record<
  TemplateKey,
  { name: string; area: string; tags: string[]; steps: Step[] }
> = {
  daily: {
    name: "日常消肿眼妆",
    area: "眼妆",
    tags: ["低饱和", "眼尾上提", "适合新手"],
    steps: [
      {
        title: "眼窝打底",
        short: "浅色铺开",
        instruction: "从睫毛根部向上轻扫，越靠近眼窝颜色越淡。",
        tip: "第一遍宁可少，不要一次取太多。",
        zone: "base",
      },
      {
        title: "眼尾加深",
        short: "外深内浅",
        instruction: "从外眼角向内晕染，不超过瞳孔外侧。",
        tip: "刷子余粉先在手背轻点一下。",
        zone: "outer",
      },
      {
        title: "下眼影连接",
        short: "只画外侧",
        instruction: "连接下眼尾外侧三分之一，保持贴近睫毛根部。",
        tip: "用更小的刷头，范围不要向下扩张。",
        zone: "lower",
      },
      {
        title: "眼中提亮",
        short: "少量点亮",
        instruction: "在瞳孔上方轻点一次，再用指腹拍开边缘。",
        tip: "提亮只负责增加层次，不需要铺满。",
        zone: "highlight",
      },
    ],
  },
  smoky: {
    name: "柔雾小烟熏",
    area: "眼妆",
    tags: ["横向延伸", "深浅三层", "氛围感"],
    steps: [
      {
        title: "灰棕打底",
        short: "控制上界",
        instruction: "从眼尾向眼中平铺灰棕色，上界不超过眼窝。",
        tip: "保持眼头干净，先建立横向轮廓。",
        zone: "base",
      },
      {
        title: "睫毛根部加深",
        short: "贴根加深",
        instruction: "沿上睫毛根部叠加深色，向上晕开约一个刷头宽。",
        tip: "闭眼前先确认刷头没有过量余粉。",
        zone: "liner",
      },
      {
        title: "眼尾拉长",
        short: "平拉不下坠",
        instruction: "顺着下眼睑延长线向外平拉，边缘慢慢变淡。",
        tip: "不要先追求长度，先保证方向。",
        zone: "outer",
      },
      {
        title: "边界柔化",
        short: "空刷收尾",
        instruction: "换干净刷子沿上边界来回轻扫两次。",
        tip: "只动边缘，不要把深色带得更高。",
        zone: "soften",
      },
    ],
  },
  contour: {
    name: "自然轮廓修容",
    area: "修容",
    tags: ["颧骨下方", "下颌收边", "自然光影"],
    steps: [
      {
        title: "找到颧骨",
        short: "先定位",
        instruction: "从耳前向鼻翼方向比出参考线，终点停在瞳孔外侧。",
        tip: "这里只定位，暂时不要上色。",
        zone: "cheek",
      },
      {
        title: "少量落色",
        short: "耳前最深",
        instruction: "颜色从耳前开始，向内越来越淡。",
        tip: "一边两次轻扫就停下来观察。",
        zone: "cheek",
      },
      {
        title: "下颌收边",
        short: "向颈部带开",
        instruction: "沿下颌边缘少量扫过，再向颈部晕开。",
        tip: "不要在下颌线上留一条深色边。",
        zone: "jaw",
      },
      {
        title: "转头检查",
        short: "检查断层",
        instruction: "轻轻转头，确认耳前与下颌没有明显断层。",
        tip: "看不清时先增加补光，不要继续叠色。",
        zone: "scan",
      },
    ],
  },
};

const defaultPalette = ["#b97872", "#6f4543", "#e7c0ad"];
function dominantColor(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 30;
      canvas.height = 30;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(defaultPalette[0]);
        return;
      }
      ctx.drawImage(img, 0, 0, 30, 30);
      const d = ctx.getImageData(0, 0, 30, 30).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 20) {
        if (d[i + 3] > 100) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
      }
      URL.revokeObjectURL(url);
      resolve(
        `#${[r / n, g / n, b / n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`,
      );
    };
    img.onerror = () => resolve(defaultPalette[0]);
    img.src = url;
  });
}
function shift(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return `#${f(n >> 16)
    .toString(16)
    .padStart(2, "0")}${f((n >> 8) & 255)
    .toString(16)
    .padStart(2, "0")}${f(n & 255)
    .toString(16)
    .padStart(2, "0")}`;
}
function statusCopy(status: MeshStatus) {
  return {
    idle: "等待启动",
    loading: "正在加载 3D 面部模型",
    tracking: "478 点面部网格跟踪中",
    ["no-face"]: "请把脸移入镜面中央",
    fallback: "模型离线，已使用示例脸降级",
  }[status];
}

export default function MirrorMateDemo() {
  const [stage, setStage] = useState<Stage>("upload"),
    [reference, setReference] = useState<string | null>(null),
    [palette, setPalette] = useState(defaultPalette),
    [templateKey, setTemplateKey] = useState<TemplateKey>("daily"),
    [prompt, setPrompt] = useState("低饱和、干净、日常通勤"),
    [intensity, setIntensity] = useState(55),
    [step, setStep] = useState(0),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [meshStatus, setMeshStatus] = useState<MeshStatus>("idle"),
    [rescue, setRescue] = useState(false),
    [events, setEvents] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null);
  const t = templates[templateKey],
    current = t.steps[step],
    progress = Math.round(((step + 1) / t.steps.length) * 100);
  const paletteStyle = useMemo(
    () => ({ "--makeup": palette[1] }) as React.CSSProperties,
    [palette],
  );
  const onMeshStatus = useCallback((s: MeshStatus) => setMeshStatus(s), []);
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, camera]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((x) => x.stop());
    },
    [],
  );
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (reference) URL.revokeObjectURL(reference);
    const url = URL.createObjectURL(file);
    setReference(url);
    const c = await dominantColor(file);
    setPalette([c, shift(c, -0.22), shift(c, 0.32)]);
    setEvents(["范本仅在本机内存中读取", "已提取参考图主色"]);
    setStage("design");
  }
  function interpretStyle(text = prompt) {
    const p = text.toLowerCase();
    const key: TemplateKey =
      p.includes("修容") || p.includes("立体") || p.includes("轮廓")
        ? "contour"
        : p.includes("烟熏") || p.includes("酷") || p.includes("欧美")
          ? "smoky"
          : "daily";
    setTemplateKey(key);
    if (!reference) {
      if (p.includes("桃") || p.includes("甜"))
        setPalette(["#d88991", "#873e4d", "#f1c1b3"]);
      else if (p.includes("冷") || p.includes("灰"))
        setPalette(["#8d7d89", "#453b49", "#c8bac3"]);
      else if (p.includes("橘") || p.includes("暖"))
        setPalette(["#c77c62", "#744334", "#efbea3"]);
      else setPalette(defaultPalette);
    }
    setEvents((v) => [...v, `风格解释：${templates[key].name}`]);
  }
  async function startTryOn() {
    interpretStyle();
    setCameraError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = s;
      setCamera(true);
      setStage("tryon");
      setEvents((v) => [...v, "摄像头已开启：开始本地实时定位"]);
    } catch {
      setCamera(false);
      setStage("tryon");
      setMeshStatus("fallback");
      setCameraError("摄像头未授权，示例脸仍可演示妆效与教学流程。");
    }
  }
  function acceptLook() {
    setStep(0);
    setStage("coach");
    setEvents((v) => [...v, `已确认妆效：${t.name}，浓度 ${intensity}%`]);
  }
  function speak() {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      `${current.title}。${current.instruction}`,
    );
    u.lang = "zh-CN";
    speechSynthesis.speak(u);
  }
  function next() {
    setRescue(false);
    if (step < t.steps.length - 1) {
      setStep(step + 1);
      setEvents((v) => [...v, `完成：${current.title}`]);
    } else setStage("finish");
  }
  function reset() {
    window.speechSynthesis?.cancel();
    streamRef.current?.getTracks().forEach((x) => x.stop());
    streamRef.current = null;
    if (reference) URL.revokeObjectURL(reference);
    setReference(null);
    setPalette(defaultPalette);
    setTemplateKey("daily");
    setPrompt("低饱和、干净、日常通勤");
    setIntensity(55);
    setCamera(false);
    setCameraError("");
    setMeshStatus("idle");
    setStage("upload");
    setStep(0);
    setRescue(false);
    setEvents([]);
  }
  return (
    <main className="app-shell" style={paletteStyle}>
      <header className="appbar">
        <button className="brand-button" onClick={reset}>
          <span>MM</span>
          <b>妆伴 MirrorMate</b>
        </button>
        <div className="appbar-actions">
          <span className="local-badge">
            <i />
            本地隐私模式
          </span>
          <span className="prototype-badge">实时 3D 试妆</span>
        </div>
      </header>
      {stage === "upload" && (
        <section className="landing">
          <div className="landing-copy">
            <p className="kicker">REFERENCE · TRY ON · LEARN</p>
            <h1>
              先看见适合，
              <br />
              再真正学会。
            </h1>
            <p className="lead">
              上传喜欢的妆效或直接描述风格。妆伴把它映射到你的实时面部网格，满意后再一步步教你完成。
            </p>
            <label className="upload-cta">
              <input type="file" accept="image/*" onChange={onFile} />
              <span>上传妆容范本</span>
              <small>图片仅在此设备处理</small>
            </label>
            <button className="text-action" onClick={() => setStage("design")}>
              没有图片？用文字描述风格 →
            </button>
          </div>
          <DemoFace look="daily" palette={palette} />
          <div className="capabilities">
            <div>
              <b>01</b>
              <span>图片 / 文字生妆效</span>
            </div>
            <div>
              <b>02</b>
              <span>478 点实时定位</span>
            </div>
            <div>
              <b>03</b>
              <span>满意后再教学</span>
            </div>
            <div>
              <b>04</b>
              <span>脸上分区跟练</span>
            </div>
          </div>
        </section>
      )}
      {stage === "design" && (
        <section className="workspace">
          <div className="section-head">
            <div>
              <p className="kicker">STEP 1 · 生成妆效</p>
              <h2>你想试什么感觉？</h2>
            </div>
            <p>
              参考图提供颜色，文字提供气质。系统生成可编辑的视觉解释，不冒充原作者真实产品与手法。
            </p>
          </div>
          <div className="design-grid">
            <div className="reference-card">
              {reference ? (
                <img src={reference} alt="用户上传的妆容范本" />
              ) : (
                <div className="sample-reference">
                  <span>文字生成模式</span>
                  <b>{prompt}</b>
                </div>
              )}
              <div className="image-label">
                {reference ? "参考图仅本地读取" : "没有上传图片"}
              </div>
            </div>
            <div className="style-builder">
              <label>
                描述想要的妆感
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：清冷灰棕、小烟熏、眼尾上扬"
                />
              </label>
              <div className="prompt-chips">
                {[
                  "日常低饱和",
                  "清冷灰棕小烟熏",
                  "暖橘氛围感",
                  "自然立体修容",
                ].map((x) => (
                  <button
                    key={x}
                    onClick={() => {
                      setPrompt(x);
                      interpretStyle(x);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="palette-row">
                {palette.map((c, i) => (
                  <span key={c + i} style={{ background: c }} />
                ))}
              </div>
              <button
                className="interpret-button"
                onClick={() => interpretStyle()}
              >
                重新解释风格
              </button>
            </div>
          </div>
          <h3 className="choose-title">选择生成方向</h3>
          <div className="template-grid">
            {(Object.keys(templates) as TemplateKey[]).map((key) => (
              <button
                key={key}
                className={`template-card ${templateKey === key ? "selected" : ""}`}
                onClick={() => setTemplateKey(key)}
              >
                <span>{templates[key].area}</span>
                <b>{templates[key].name}</b>
                <small>{templates[key].tags.join(" · ")}</small>
                <i>{templates[key].steps.length} 个教学动作</i>
              </button>
            ))}
          </div>
          <div className="bottom-actions">
            <button className="secondary" onClick={() => setStage("upload")}>
              返回
            </button>
            <button className="primary" onClick={startTryOn}>
              开启摄像头，实时试妆
            </button>
          </div>
        </section>
      )}
      {stage === "tryon" && (
        <section className="tryon-layout">
          <div className="tryon-copy">
            <p className="kicker">STEP 2 · 实时试妆</p>
            <h2>{t.name}</h2>
            <p>
              转头、靠近或远离镜头，妆效会跟随面部网格。先调整到你满意，再把这个版本变成教学目标。
            </p>
            <div className="mesh-status">
              <i className={meshStatus} />
              <div>
                <b>{statusCopy(meshStatus)}</b>
                <span>在本设备实时计算，不上传视频帧</span>
              </div>
            </div>
            <label className="intensity-control">
              <span>
                妆效浓度 <b>{intensity}%</b>
              </span>
              <input
                type="range"
                min="15"
                max="90"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
            <div className="tryon-palette">
              {palette.map((c, i) => (
                <button
                  aria-label={`使用色板 ${i + 1}`}
                  key={c + i}
                  style={{ background: c }}
                  onClick={() => setPalette([c, shift(c, -0.2), shift(c, 0.3)])}
                />
              ))}
            </div>
            <button
              className="secondary wide"
              onClick={() => setStage("design")}
            >
              换一个风格
            </button>
            <button className="primary wide accept-look" onClick={acceptLook}>
              我满意，用这个妆效教我
            </button>
            <p className="prototype-note">
              实时定位来自 MediaPipe 478
              点面部网格；妆效为参考色与风格关键词的参数化视觉解释。
            </p>
          </div>
          <LiveMirror
            camera={camera}
            videoRef={videoRef}
            meshStatus={meshStatus}
            onMeshStatus={onMeshStatus}
            palette={palette}
            intensity={intensity}
            look={templateKey}
            mode="tryon"
          />
          {cameraError && (
            <p className="camera-error tryon-error">{cameraError}</p>
          )}
        </section>
      )}
      {stage === "coach" && (
        <section className="coach-layout">
          <aside className="lesson-panel">
            <div>
              <p className="kicker">STEP 3 · 对镜跟练</p>
              <h2>{t.name}</h2>
              <div className="progress-track">
                <i style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-label">
                第 {step + 1} / {t.steps.length} 步
              </span>
            </div>
            <ol className="step-list">
              {t.steps.map((s, i) => (
                <li
                  key={s.title}
                  className={i === step ? "active" : i < step ? "done" : ""}
                >
                  <button
                    onClick={() => {
                      setStep(i);
                      setRescue(false);
                    }}
                  >
                    <span>{i < step ? "✓" : i + 1}</span>
                    <div>
                      <b>{s.title}</b>
                      <small>{s.short}</small>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
            <div className="privacy-mini">
              <i />
              {statusCopy(meshStatus)}
            </div>
          </aside>
          <div className="mirror-stage">
            <LiveMirror
              camera={camera}
              videoRef={videoRef}
              meshStatus={meshStatus}
              onMeshStatus={onMeshStatus}
              palette={palette}
              intensity={intensity}
              look={templateKey}
              teachingZone={current.zone}
              mode="teach"
            />
          </div>
          <aside className="instruction-panel">
            <p className="step-number">
              动作 {String(step + 1).padStart(2, "0")}
            </p>
            <h2>{current.title}</h2>
            <p className="instruction">{current.instruction}</p>
            <div className="tip">
              <b>新手提示</b>
              <span>{current.tip}</span>
            </div>
            {rescue ? (
              <div className="rescue-card">
                <p>只先调整一个点</p>
                <b>
                  {templateKey === "contour"
                    ? "用空刷向颈部带开两次"
                    : "用干净刷从外向内轻扫两次"}
                </b>
                <span>完成后停下来观察，不要继续叠色。</span>
                <button onClick={() => setRescue(false)}>我已调整</button>
              </div>
            ) : (
              <button
                className="help-button"
                onClick={() => {
                  setRescue(true);
                  setEvents((v) => [...v, "用户主动求助：需要补救"]);
                }}
              >
                我画出界了，帮我救一下
              </button>
            )}
            <div className="coach-controls">
              <button onClick={speak}>▶ 朗读步骤</button>
              <button
                onClick={() => step > 0 && setStep(step - 1)}
                disabled={step === 0}
              >
                上一步
              </button>
              <button className="primary" onClick={next}>
                {step === t.steps.length - 1 ? "完成练习" : "完成，下一步"}
              </button>
            </div>
            <p className="prototype-note">
              白色边界会随面部关键点移动；当前不识别刷具，也不进行颜值评价。
            </p>
          </aside>
        </section>
      )}
      {stage === "finish" && (
        <section className="finish-screen">
          <div className="finish-mark">✓</div>
          <p className="kicker">SESSION COMPLETE</p>
          <h1>你完成了「{t.name}」</h1>
          <p>
            从参考风格、实时试妆到对镜跟练，这个妆效已经变成了你能再次复现的动作。
          </p>
          <div className="recap-grid">
            <div>
              <span>已确认妆效</span>
              <b>
                {t.name} · {intensity}%
              </b>
            </div>
            <div>
              <span>今天学会</span>
              <b>
                {t.steps
                  .map((s) => s.short)
                  .slice(0, 3)
                  .join(" · ")}
              </b>
            </div>
            <div>
              <span>隐私状态</span>
              <b className="safe">图片与视频未上传</b>
            </div>
          </div>
          <div className="event-log">
            <h3>本次学习轨迹</h3>
            {events.map((e, i) => (
              <p key={`${e}-${i}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {e}
              </p>
            ))}
          </div>
          <div className="delete-row">
            <div>
              <b>结束并清除会话</b>
              <span>清除参考图、摄像头流和临时分析结果</span>
            </div>
            <button className="primary" onClick={reset}>
              清除并重新开始
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function LiveMirror({
  camera,
  videoRef,
  meshStatus,
  onMeshStatus,
  palette,
  intensity,
  look,
  teachingZone,
  mode,
}: {
  camera: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  meshStatus: MeshStatus;
  onMeshStatus: (s: MeshStatus) => void;
  palette: string[];
  intensity: number;
  look: TemplateKey;
  teachingZone?: string;
  mode: "tryon" | "teach";
}) {
  const fallback = !camera || meshStatus === "fallback";
  return (
    <div className={`live-mirror ${camera && !fallback ? "camera-on" : ""}`}>
      <div className="mirror-top">
        <span>
          <i />
          {mode === "tryon" ? "实时试妆" : "面部跟练"}
        </span>
        <b>{statusCopy(meshStatus)}</b>
      </div>
      <video ref={videoRef} muted playsInline />
      {fallback && <DemoFace look={look} palette={palette} />}
      <FaceMeshCanvas
        videoRef={videoRef}
        enabled={camera}
        palette={palette}
        intensity={intensity}
        look={look}
        teachingZone={teachingZone}
        mode={mode}
        onStatus={onMeshStatus}
      />
      <div className="mirror-caption">
        <span>{mode === "tryon" ? "LIVE LOOK" : "LIVE COACH"}</span>
        <b>{fallback ? "示例脸降级模式" : "妆效跟随面部姿态"}</b>
      </div>
    </div>
  );
}
function DemoFace({ look, palette }: { look: TemplateKey; palette: string[] }) {
  return (
    <div
      className={`demo-mirror compact ${look}`}
      style={{ "--makeup": palette[1] } as React.CSSProperties}
    >
      <div className="demo-face">
        <div className="hair" />
        <div className="demo-brow l" />
        <div className="demo-brow r" />
        <div className="demo-eye l">
          <i />
        </div>
        <div className="demo-eye r">
          <i />
        </div>
        <div className="demo-nose" />
        <div className="demo-mouth" />
      </div>
      <div
        className={`guide-overlay ${look} ${look === "contour" ? "cheek" : "outer"}`}
      >
        <i className="z1" />
        <i className="z2" />
      </div>
      <div className="mirror-caption">
        <span>MAKEUP PREVIEW</span>
        <b>{look === "contour" ? "立体轮廓" : "眼妆风格"}</b>
      </div>
    </div>
  );
}
