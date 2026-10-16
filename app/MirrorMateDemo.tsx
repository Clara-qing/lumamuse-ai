"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FaceMeshCanvas, { FaceMeshTracker, MeshStatus } from "./FaceMeshCanvas";
import type { FaceLandmarks, TrackingQuality } from "./FaceMeshCanvas";
import { extractReferenceAnalysis } from "./makeupAnalysis";
import type { ReferenceAnalysis, RGB } from "./makeupAnalysis";

type TemplateKey = "daily" | "smoky" | "contour";
type Stage = "upload" | "design" | "tryon" | "coach" | "finish";
type VoiceStatus = "idle" | "connecting" | "listening" | "unsupported";
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
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
function analyzeReferenceImage(file: File): Promise<ReferenceAnalysis> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 30;
      canvas.height = 30;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(extractReferenceAnalysis([]));
        return;
      }
      ctx.drawImage(img, 0, 0, 30, 30);
      const d = ctx.getImageData(0, 0, 30, 30).data;
      const pixels: RGB[] = [];
      for (let i = 0; i < d.length; i += 16)
        if (d[i + 3] > 100) pixels.push([d[i], d[i + 1], d[i + 2]]);
      URL.revokeObjectURL(url);
      resolve(extractReferenceAnalysis(pixels));
    };
    img.onerror = () => resolve(extractReferenceAnalysis([]));
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
function qualityCopy(quality: TrackingQuality) {
  return {
    waiting: "等待面部定位",
    closer: "请靠近一点",
    farther: "请离远一点",
    center: "请回到镜面中央",
    ready: "距离与位置合适",
  }[quality];
}
function directionCopy(zone: string) {
  return {
    base: "从睫毛根部向上轻扫",
    outer: "从外眼角向外晕染",
    lower: "沿下眼尾向内连接",
    liner: "贴睫毛根部平拉",
    soften: "沿边界来回柔化",
    highlight: "在眼中少量轻点",
    cheek: "从耳前向内带开",
    jaw: "沿下颌向颈部带开",
    scan: "轻转头检查边界",
  }[zone] ?? "跟随镜面箭头";
}

export default function MirrorMateDemo() {
  const [stage, setStage] = useState<Stage>("upload"),
    [reference, setReference] = useState<string | null>(null),
    [palette, setPalette] = useState(defaultPalette),
    [templateKey, setTemplateKey] = useState<TemplateKey>("daily"),
    [prompt, setPrompt] = useState("低饱和、干净、日常通勤"),
    [promptDirty, setPromptDirty] = useState(false),
    [intensity, setIntensity] = useState(55),
    [referenceAnalysis, setReferenceAnalysis] =
      useState<ReferenceAnalysis | null>(null),
    [step, setStep] = useState(0),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [meshStatus, setMeshStatus] = useState<MeshStatus>("idle"),
    [trackingQuality, setTrackingQuality] =
      useState<TrackingQuality>("waiting"),
    [showMesh, setShowMesh] = useState(false),
    [rescue, setRescue] = useState(false),
    [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle"),
    [voiceTranscript, setVoiceTranscript] = useState(""),
    [events, setEvents] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null),
    guideVideoRef = useRef<HTMLVideoElement>(null),
    previewVideoRef = useRef<HTMLVideoElement>(null),
    coachLandmarksRef = useRef<FaceLandmarks | null>(null),
    recognitionRef = useRef<SpeechRecognitionLike | null>(null),
    streamRef = useRef<MediaStream | null>(null),
    voiceStreamRef = useRef<MediaStream | null>(null),
    realtimePcRef = useRef<RTCPeerConnection | null>(null),
    realtimeChannelRef = useRef<RTCDataChannel | null>(null),
    realtimeAudioRef = useRef<HTMLAudioElement | null>(null),
    realtimeActiveRef = useRef(false);
  const t = templates[templateKey],
    current = t.steps[step],
    progress = Math.round(((step + 1) / t.steps.length) * 100);
  const paletteStyle = useMemo(
    () => ({ "--makeup": palette[1] }) as React.CSSProperties,
    [palette],
  );
  const onMeshStatus = useCallback((s: MeshStatus) => setMeshStatus(s), []);
  const onTrackingQuality = useCallback(
    (q: TrackingQuality) => setTrackingQuality(q),
    [],
  );
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, camera]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((x) => x.stop());
      recognitionRef.current?.stop();
      voiceStreamRef.current?.getTracks().forEach((x) => x.stop());
      realtimeChannelRef.current?.close();
      realtimePcRef.current?.close();
    },
    [],
  );
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (reference) URL.revokeObjectURL(reference);
    const url = URL.createObjectURL(file);
    setReference(url);
    const analysis = await analyzeReferenceImage(file);
    setReferenceAnalysis(analysis);
    setPalette(analysis.palette);
    setTemplateKey(analysis.suggestedTemplate);
    setIntensity(analysis.suggestedIntensity);
    setPrompt(
      `${analysis.temperature}、${analysis.saturation}、${analysis.contrast}`,
    );
    setPromptDirty(false);
    setEvents([
      "范本仅在本机内存中读取",
      analysis.fallback
        ? "图片解析失败：使用安全默认妆效"
        : `已聚类三组妆效色：${analysis.temperature} / ${analysis.contrast}`,
    ]);
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
    setPromptDirty(false);
    setEvents((v) => [...v, `风格解释：${templates[key].name}`]);
  }
  async function startTryOn() {
    if (promptDirty) interpretStyle();
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
  function speakText(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    speechSynthesis.speak(u);
  }
  function speak() {
    speakText(`${current.title}。${current.instruction}`);
  }
  function stopVoiceCoach() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    realtimeActiveRef.current = false;
    realtimeChannelRef.current?.close();
    realtimeChannelRef.current = null;
    realtimePcRef.current?.close();
    realtimePcRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
      realtimeAudioRef.current = null;
    }
    setVoiceStatus("idle");
  }
  function handleVoiceCommand(transcript: string) {
    const cleaned = transcript.replace(/\s/g, "");
    const say = (text: string) => {
      if (!realtimeActiveRef.current) speakText(text);
    };
    setVoiceTranscript(`你说：“${transcript}”`);
    if (/上一步|返回/.test(cleaned)) {
      if (step > 0) setStep(step - 1);
      say(step > 0 ? "好的，回到上一步。" : "这已经是第一步。 ");
      return;
    }
    if (/下一步|继续|完成/.test(cleaned)) {
      if (step < t.steps.length - 1) {
        next();
        say(`好的，下一步是${t.steps[step + 1].title}。${t.steps[step + 1].instruction}`);
      } else {
        say("你已经完成全部步骤，可以点击完成练习查看复盘。 ");
      }
      return;
    }
    if (/慢一点|放慢/.test(cleaned)) {
      say(`${current.title}。${current.instruction}。我再慢一点说：${directionCopy(current.zone)}。`);
      return;
    }
    if (/再说一遍|重复|没听清/.test(cleaned)) {
      if (!realtimeActiveRef.current) speak();
      return;
    }
    if (/救一下|出界|画错/.test(cleaned)) {
      setRescue(true);
      setEvents((v) => [...v, "语音求助：需要补救"]);
      say("我来帮你补救。先停下，不要继续叠色，然后按补救卡完成一个小动作。 ");
      return;
    }
    say(`我听到你说${transcript}。你可以说下一步、慢一点、再说一遍或救一下。`);
  }
  function startBrowserVoiceCoach(message = "") {
    const browser = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("unsupported");
      setVoiceTranscript(message || "当前浏览器未提供语音识别；仍可使用朗读和按钮。 ");
      return;
    }
    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript;
      if (transcript) handleVoiceCommand(transcript);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) setVoiceStatus("idle");
    };
    recognition.onerror = () => {
      setVoiceStatus("idle");
      setVoiceTranscript("没有听清，点击后可以重新接通。 ");
    };
    recognitionRef.current = recognition;
    setVoiceStatus("listening");
    setVoiceTranscript("已接通：可以说“下一步”“慢一点”“再说一遍”或“救一下”。");
    try {
      recognition.start();
      speakText(`已接通语音陪练。当前是${current.title}。`);
    } catch {
      recognitionRef.current = null;
      setVoiceStatus("idle");
      setVoiceTranscript("暂时无法接通麦克风，请检查浏览器权限后重试。 ");
    }
  }
  async function startVoiceCoach() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      startBrowserVoiceCoach("当前浏览器不支持实时通话，已切换至浏览器语音模式。");
      return;
    }
    stopVoiceCoach();
    setVoiceStatus("connecting");
    setVoiceTranscript("正在安全连接 LumaMuse 实时语音…");
    try {
      const voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      voiceStreamRef.current = voiceStream;
      const pc = new RTCPeerConnection();
      realtimePcRef.current = pc;
      const track = voiceStream.getAudioTracks()[0];
      const sender = track ? pc.addTrack(track, voiceStream) : null;
      if (sender) await sender.replaceTrack(null);
      const channel = pc.createDataChannel("oai-events");
      realtimeChannelRef.current = channel;
      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        realtimeAudioRef.current = audio;
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          if (realtimePcRef.current === pc) stopVoiceCoach();
        }
      };
      channel.onmessage = (event) => {
        let data: { type?: string; transcript?: string; error?: { message?: string } };
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === "session.created") {
          channel.send(JSON.stringify({
            event_id: `lumamuse_${Date.now()}`,
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              voice: "Tina",
              input_audio_format: "pcm",
              output_audio_format: "pcm",
              input_audio_transcription: { model: "qwen3-asr-flash-realtime" },
              turn_detection: {
                type: "server_vad",
                prefix_padding_ms: 500,
                silence_duration_ms: 800,
                threshold: 0.5,
              },
              instructions: `你是 LumaMuse 光感妆伴，一位耐心、简洁、鼓励式的中文化妆陪练。用户正在练习「${t.name}」第 ${step + 1} 步「${current.title}」。给出一步一动作的可执行指导，不评价颜值，不进行医疗建议。听到“下一步、上一步、慢一点、再说一遍、救一下/画错”时先用一句简短中文回应。`,
            },
          }));
        } else if (data.type === "session.updated") {
          realtimeActiveRef.current = true;
          sender?.replaceTrack(track ?? null).catch(() => {});
          setVoiceStatus("listening");
          setVoiceTranscript("已接通千问实时陪练，可以自然说话或随时打断。");
        } else if (data.type === "conversation.item.input_audio_transcription.completed" && data.transcript) {
          handleVoiceCommand(data.transcript);
        } else if (data.type === "error") {
          setVoiceTranscript(data.error?.message || "实时语音发生错误，请重新接通。");
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const timeout = window.setTimeout(resolve, 2500);
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") {
            window.clearTimeout(timeout);
            resolve();
          }
        }, { once: true });
      });
      const response = await fetch("/api/realtime/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: pc.localDescription?.sdp }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "无法建立实时连接");
      }
      const answerSdp = (await response.text()).trim().replace(/\r?\n/g, "\r\n");
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      const message = error instanceof Error ? error.message : "实时语音暂时不可用";
      stopVoiceCoach();
      startBrowserVoiceCoach(`实时模式未接通：${message}。已切换至浏览器语音模式。`);
    }
  }
  function next() {
    setRescue(false);
    if (step < t.steps.length - 1) {
      setStep(step + 1);
      setEvents((v) => [...v, `完成：${current.title}`]);
    } else {
      stopVoiceCoach();
      setStage("finish");
    }
  }
  function reset() {
    window.speechSynthesis?.cancel();
    stopVoiceCoach();
    streamRef.current?.getTracks().forEach((x) => x.stop());
    streamRef.current = null;
    if (reference) URL.revokeObjectURL(reference);
    setReference(null);
    setPalette(defaultPalette);
    setTemplateKey("daily");
    setPrompt("低饱和、干净、日常通勤");
    setPromptDirty(false);
    setIntensity(55);
    setReferenceAnalysis(null);
    setCamera(false);
    setCameraError("");
    setMeshStatus("idle");
    setTrackingQuality("waiting");
    setShowMesh(false);
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
          <b>LumaMuse 光感妆伴</b>
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
              上传喜欢的妆效或直接描述风格。LumaMuse 把它映射到你的实时面部网格，满意后再一步步教你完成。
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
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setPromptDirty(true);
                  }}
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
                      setPromptDirty(false);
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
              {referenceAnalysis && (
                <div className="analysis-tags" aria-label="参考图妆效分析">
                  <span>
                    {referenceAnalysis.fallback
                      ? "默认妆效"
                      : referenceAnalysis.temperature}
                  </span>
                  <span>{referenceAnalysis.saturation}</span>
                  <span>{referenceAnalysis.contrast}</span>
                  <small>
                    建议浓度 {referenceAnalysis.suggestedIntensity}%
                  </small>
                </div>
              )}
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
                onClick={() => {
                  setTemplateKey(key);
                  setPromptDirty(false);
                }}
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
            <div className={`calibration ${trackingQuality}`}>
              <b>{qualityCopy(trackingQuality)}</b>
              <span>
                {trackingQuality === "ready"
                  ? "可以确认妆效并进入教学"
                  : "调整后定位会更稳定"}
              </span>
            </div>
            <button
              className={`mesh-toggle ${showMesh ? "active" : ""}`}
              onClick={() => setShowMesh((v) => !v)}
            >
              {showMesh ? "隐藏 3D 网格" : "查看 3D 面部网格"}
            </button>
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
            <button
              className="primary wide accept-look"
              onClick={acceptLook}
              disabled={
                camera &&
                meshStatus !== "fallback" &&
                trackingQuality !== "ready"
              }
            >
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
            stream={streamRef.current}
            meshStatus={meshStatus}
            onMeshStatus={onMeshStatus}
            palette={palette}
            intensity={intensity}
            look={templateKey}
            mode="tryon"
            showMesh={showMesh}
            onQuality={onTrackingQuality}
          />
          {cameraError && (
            <p className="camera-error tryon-error">{cameraError}</p>
          )}
        </section>
      )}
      {stage === "coach" && (
        <section className="coach-layout">
          <FaceMeshTracker
            videoRef={guideVideoRef}
            enabled={camera}
            landmarksRef={coachLandmarksRef}
            onStatus={onMeshStatus}
            onQuality={onTrackingQuality}
          />
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
          <div className="mirror-stage dual-mirror-stage">
            <div className="coach-mirror-cell">
              <p className="coach-view-label">操作镜头 · 按箭头上妆</p>
            <LiveMirror
              camera={camera}
              videoRef={guideVideoRef}
              stream={streamRef.current}
              meshStatus={meshStatus}
              onMeshStatus={onMeshStatus}
              palette={palette}
              intensity={intensity}
              look={templateKey}
              teachingZone={current.zone}
              mode="teach"
              showMesh={false}
              brushDirection={current.zone}
              landmarksRef={coachLandmarksRef}
              onQuality={onTrackingQuality}
            />
            </div>
            <div className="coach-mirror-cell target-look-cell">
              <p className="coach-view-label">目标妆效 · 实时对照</p>
              <LiveMirror
                camera={camera}
                videoRef={previewVideoRef}
                stream={streamRef.current}
                meshStatus={meshStatus}
                onMeshStatus={onMeshStatus}
                palette={palette}
                intensity={intensity}
                look={templateKey}
                mode="tryon"
                showMesh={false}
                onQuality={onTrackingQuality}
                landmarksRef={coachLandmarksRef}
              />
            </div>
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
            <p className="direction-hint">
              <b>镜面箭头</b>
              {directionCopy(current.zone)}
            </p>
            <div className={`voice-call ${voiceStatus}`} aria-label="语音陪练">
              <div className="voice-avatar" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="voice-copy">
                <b>AI 语音陪练</b>
                <span>
                  {voiceStatus === "listening"
                    ? "正在聆听，可随时打断"
                    : voiceStatus === "connecting"
                      ? "正在连接千问实时陪练"
                    : voiceStatus === "unsupported"
                      ? "此浏览器不支持语音识别"
                      : "千问实时通话 · 浏览器语音降级"}
                </span>
              </div>
              {voiceStatus === "listening" || voiceStatus === "connecting" ? (
                <button className="voice-hangup" onClick={stopVoiceCoach}>挂断</button>
              ) : (
                <button className="voice-connect" onClick={startVoiceCoach}>接通</button>
              )}
              {voiceTranscript && <p className="voice-transcript">{voiceTranscript}</p>}
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
  stream,
  meshStatus,
  onMeshStatus,
  palette,
  intensity,
  look,
  teachingZone,
  mode,
  showMesh,
  brushDirection,
  landmarksRef,
  onQuality,
}: {
  camera: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  meshStatus: MeshStatus;
  onMeshStatus: (s: MeshStatus) => void;
  palette: string[];
  intensity: number;
  look: TemplateKey;
  teachingZone?: string;
  mode: "tryon" | "teach";
  showMesh: boolean;
  brushDirection?: string;
  landmarksRef?: React.RefObject<FaceLandmarks | null>;
  onQuality: (q: TrackingQuality) => void;
}) {
  const fallback = !camera || meshStatus === "fallback";
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, videoRef]);
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
        showMesh={showMesh}
        brushDirection={brushDirection}
        landmarksRef={landmarksRef}
        onStatus={onMeshStatus}
        onQuality={onQuality}
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
