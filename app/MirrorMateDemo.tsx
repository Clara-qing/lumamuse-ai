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
import type { FaceLandmarks, GazeStatus, TrackingQuality } from "./FaceMeshCanvas";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { extractReferenceAnalysis, profileFromPalette, refineReferenceAnalysisByLandmarks } from "./makeupAnalysis";
import type { MakeupEffectProfile, ReferenceAnalysis, RGB } from "./makeupAnalysis";
import ReferencePrecisionLab from "./ReferencePrecisionLab";
import CloudMakeupTransfer from "./CloudMakeupTransfer";
import {
  coachInstructions,
  knowledgeByZone,
  prepGuide,
  realtimeCoachTools,
  searchTeachingKnowledge,
} from "./coachKnowledge";
import type { CoachSnapshot, FocusMode } from "./coachKnowledge";

type TemplateKey = "daily" | "smoky" | "contour";
type Stage = "intro" | "upload" | "design" | "precision" | "cloud" | "tryon-loading" | "tryon" | "coach-loading" | "coach" | "finish";
type VoiceStatus = "idle" | "connecting" | "listening" | "error";
type PetDialoguePlacement = {
  vertical: "above" | "below";
  horizontal: "start" | "end";
};
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
        title: "妆前与底妆",
        short: "保湿、校色、薄铺底妆",
        instruction: "先完成保湿和局部校色；粉底从面中薄铺到脸缘，再在需要处少量遮瑕并轻压定妆。",
        tip: "先薄后叠，眼下和鼻翼只用剩余粉，避免把底妆堆厚。",
        zone: "prep",
      },
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
        title: "妆前与底妆",
        short: "保湿、校色、薄铺底妆",
        instruction: "先完成保湿和局部校色；粉底从面中薄铺到脸缘，再在需要处少量遮瑕并轻压定妆。",
        tip: "烟熏眼妆前先把眼下底妆压牢，后续落粉才更容易清理。",
        zone: "prep",
      },
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
        title: "妆前与底妆",
        short: "保湿、校色、薄铺底妆",
        instruction: "先完成保湿和局部校色；粉底从面中薄铺到脸缘，再在需要处少量遮瑕并轻压定妆。",
        tip: "底妆要留出真实肤色，修容叠上去才不会显脏。",
        zone: "prep",
      },
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
const sceneMoments = [
  { index: "01", title: "赴约之前", label: "镜前复刻", image: "scene-east-asian-bangs-cutout.png", intent: "replicate", copy: "你把收藏很久的氛围带到镜子前。接下来，只需跟上几笔，让今晚的光落在你自己的轮廓上。" },
  { index: "02", title: "早晨十分钟", label: "日常出门", image: "scene-caucasian-man-cutout-v2.png", intent: "everyday", copy: "你不必重新开始一天。用手边的几样东西，留下刚刚好的精神感，然后从容出门。" },
  { index: "03", title: "卡在一笔", label: "即时追问", image: "scene-black-woman-cutout.png", intent: "learn", copy: "你可以在最犹豫的一笔停下来。问清刷子、方向与用量，再让这一笔变得笃定。" },
  { index: "04", title: "留给自己", label: "自然化调整", image: "scene-latina-cutout.png", intent: "everyday", copy: "你保留心动的部分，也留出自己的呼吸。把灵感调成真正适合你日常的一版。" },
] as const;
const defaultEffectProfile: MakeupEffectProfile = {
  eyeBase: defaultPalette[0], eyeOuter: defaultPalette[1], lowerEye: defaultPalette[1],
  cheek: defaultPalette[0], lip: defaultPalette[1], contour: defaultPalette[1],
  eyeOpacity: 0.55, cheekOpacity: 0.38, lipOpacity: 0.52, source: "palette",
};
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const VISION_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
function analyzeReferenceImage(file: File): Promise<ReferenceAnalysis> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(extractReferenceAnalysis([]));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const pixels: RGB[] = [];
      for (let i = 0; i < d.length; i += 64)
        if (d[i + 3] > 100) pixels.push([d[i], d[i + 1], d[i + 2]]);
      let analysis = extractReferenceAnalysis(pixels);
      try {
        const vision = await FilesetResolver.forVisionTasks(VISION_WASM);
        const detector = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "IMAGE", numFaces: 1,
        });
        const landmarks = detector.detect(img).faceLandmarks[0];
        detector.close();
        if (landmarks) analysis = refineReferenceAnalysisByLandmarks(
          analysis, imageData.data, canvas.width, canvas.height, landmarks,
        );
      } catch {
        // Generic palette analysis remains available when the local vision
        // model is offline or the reference is not a detectable frontal face.
      }
      URL.revokeObjectURL(url);
      resolve(analysis);
    };
    img.onerror = () => resolve(extractReferenceAnalysis([]));
    img.src = url;
  });
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
    prep: "从面中向外薄铺，鼻翼和眼下只用剩余粉",
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

function inferLookName(text: string, key: TemplateKey) {
  const compact = text.replace(/[，,。.!！?？]/g, "").trim();
  if (/烟熏|欧美|清冷/.test(compact)) return "清冷灰棕小烟熏";
  if (/修容|立体|轮廓/.test(compact)) return "自然立体轮廓妆";
  if (/桃|甜|氛围|约会/.test(compact)) return "蜜桃氛围感妆";
  if (compact && compact.length <= 16 && !/低饱和|干净|日常通勤/.test(compact)) return `${compact}妆`;
  return templates[key].name;
}

export default function MirrorMateDemo() {
  const [stage, setStage] = useState<Stage>("intro"),
    [sceneDetail, setSceneDetail] = useState<number | null>(null),
    [reference, setReference] = useState<string | null>(null),
    [referenceFile, setReferenceFile] = useState<File | null>(null),
    [palette, setPalette] = useState(defaultPalette),
    [effectProfile, setEffectProfile] = useState<MakeupEffectProfile>(defaultEffectProfile),
    [templateKey, setTemplateKey] = useState<TemplateKey>("daily"),
    [lookName, setLookName] = useState(""),
    [lookNameTouched, setLookNameTouched] = useState(false),
    [prompt, setPrompt] = useState("低饱和、干净、日常通勤"),
    [promptDirty, setPromptDirty] = useState(false),
    [intent, setIntent] = useState<"learn" | "replicate" | "everyday">("learn"),
    [intensity, setIntensity] = useState(55),
    [referenceAnalysis, setReferenceAnalysis] =
      useState<ReferenceAnalysis | null>(null),
    [step, setStep] = useState(0),
    [camera, setCamera] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [meshStatus, setMeshStatus] = useState<MeshStatus>("idle"),
    [trackingQuality, setTrackingQuality] =
      useState<TrackingQuality>("waiting"),
    [gazeStatus, setGazeStatus] = useState<GazeStatus>("unknown"),
    [showMesh, setShowMesh] = useState(false),
    [rescue, setRescue] = useState(false),
    [focusMode, setFocusMode] = useState<FocusMode>("full"),
    [skinProfile, setSkinProfile] = useState<CoachSnapshot["skinProfile"]>("unknown"),
    [prepChecked, setPrepChecked] = useState(false),
    [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle"),
    [agentDraft, setAgentDraft] = useState(""),
    [chatHistory, setChatHistory] = useState<string[]>([]),
    [petOpen, setPetOpen] = useState(false),
    [petPosition, setPetPosition] = useState<{ left: number; top: number } | null>(null),
    [petDialoguePlacement, setPetDialoguePlacement] = useState<PetDialoguePlacement>({ vertical: "above", horizontal: "end" }),
    [previewEffectsVisible, setPreviewEffectsVisible] = useState(true),
    [events, setEvents] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null),
    guideVideoRef = useRef<HTMLVideoElement>(null),
    previewVideoRef = useRef<HTMLVideoElement>(null),
    coachLandmarksRef = useRef<FaceLandmarks | null>(null),
    streamRef = useRef<MediaStream | null>(null),
    voiceStreamRef = useRef<MediaStream | null>(null),
    realtimePcRef = useRef<RTCPeerConnection | null>(null),
    realtimeChannelRef = useRef<RTCDataChannel | null>(null),
    realtimeAudioRef = useRef<HTMLAudioElement | null>(null),
    realtimeActiveRef = useRef(false),
    realtimeConfigSentRef = useRef(false),
    realtimeGreetingSentRef = useRef(false),
    welcomeShownRef = useRef(false),
    petDragRef = useRef({ startX: 0, startY: 0, left: 0, top: 0, didDrag: false }),
    petToggleRef = useRef<HTMLButtonElement>(null),
    coachSnapshotRef = useRef<CoachSnapshot | null>(null);
  const t = templates[templateKey],
    activeLookName = lookName.trim() || t.name,
    current = t.steps[step],
    progress = Math.round(((step + 1) / t.steps.length) * 100),
    stepGroups = [
      { title: "妆前与底妆", note: "保湿、校色、分区上妆与定妆", indexes: [0] },
      { title: "重点上妆", note: "从大范围到关键落点", indexes: [1, 2] },
      { title: "收尾与检查", note: "小范围晕染后再看整体", indexes: [3, 4] },
    ].map((group) => ({
      ...group,
      steps: group.indexes
        .filter((index) => t.steps[index])
        .map((index) => ({ ...t.steps[index], index })),
    }));
  const coachSnapshot = useMemo<CoachSnapshot>(
    () => ({
      journeyStage: stage,
      lookName: activeLookName,
      userIntent: intent === "learn" ? "学会这个妆容" : intent === "replicate" ? "尽量复刻参考妆" : "调整成自然日常版",
      inspiration: prompt.trim() || "用户暂未补充文字偏好",
      referenceSummary: referenceAnalysis
        ? `${referenceAnalysis.temperature}、${referenceAnalysis.saturation}、${referenceAnalysis.contrast}；建议浓度 ${referenceAnalysis.suggestedIntensity}%`
        : reference ? "用户已上传参考图，尚未完成风格摘要" : "用户未上传参考图",
      referenceLook: referenceAnalysis
        ? `主色 ${referenceAnalysis.palette.join(" / ")}；妆效来源 ${referenceAnalysis.effectProfile.source === "reference-regions" ? "参考图分区提取" : "色板估计"}`
        : "没有可用的参考图色彩解析",
      teachingProtocol: "每个教学动作只说清目标、工具、用量、第一落点、方向/力度与停止条件；先给一个可执行动作，用户追问时再解释原理、错误与补救；不做颜值判断或医疗判断。",
      intensity,
      stepIndex: step,
      totalSteps: t.steps.length,
      stepTitle: current.title,
      instruction: current.instruction,
      tip: current.tip,
      zone: current.zone,
      direction: directionCopy(current.zone),
      tracking: qualityCopy(trackingQuality),
      meshStatus: statusCopy(meshStatus),
      focusMode,
      skinProfile,
      prepChecked,
      knowledge: knowledgeByZone[current.zone] ?? knowledgeByZone.base,
    }),
    [activeLookName, current, focusMode, intensity, intent, meshStatus, prepChecked, prompt, reference, referenceAnalysis, skinProfile, stage, step, t.steps.length, trackingQuality],
  );
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
    coachSnapshotRef.current = coachSnapshot;
    const channel = realtimeChannelRef.current;
    if (realtimeActiveRef.current && channel?.readyState === "open") {
      sendRealtimeSessionUpdate(channel, coachSnapshot, false);
    }
  }, [coachSnapshot]);
  useEffect(() => {
    if (stage !== "upload" || welcomeShownRef.current) return;
    welcomeShownRef.current = true;
    updateVoiceTranscript("欢迎来到 MirrorMate。上传一张心动的妆容图，或直接告诉我今天想练什么；从选妆到收尾，我都会在这里陪你。 ");
  }, [stage]);
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, camera]);
  useEffect(() => {
    const keepPetVisible = () => {
      setPetPosition((position) => {
        if (!position) return position;
        return {
          left: Math.max(8, Math.min(window.innerWidth - 120, position.left)),
          top: Math.max(8, Math.min(window.innerHeight - 134, position.top)),
        };
      });
      if (petOpen) requestAnimationFrame(placePetDialogue);
    };
    window.addEventListener("resize", keepPetVisible);
    return () => window.removeEventListener("resize", keepPetVisible);
  }, [petOpen]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((x) => x.stop());
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
    setReferenceFile(file);
    const analysis = await analyzeReferenceImage(file);
    setReferenceAnalysis(analysis);
    setPalette(analysis.palette);
    setEffectProfile(analysis.effectProfile);
    setTemplateKey(analysis.suggestedTemplate);
    if (!lookNameTouched) setLookName(inferLookName(prompt, analysis.suggestedTemplate));
    setIntensity(analysis.suggestedIntensity);
    setPrompt(
      `${analysis.temperature}、${analysis.saturation}、${analysis.contrast}`,
    );
    setPromptDirty(false);
    setEvents([
      "范本仅在本机内存中读取",
      analysis.fallback
        ? "图片解析失败：使用安全默认妆效"
        : analysis.effectProfile.source === "reference-regions"
          ? "已定位参考脸的眼影、腮红与唇色，并将其同步到实时妆效"
          : `已聚类三组妆效色：${analysis.temperature} / ${analysis.contrast}`,
    ]);
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
    if (!lookNameTouched) setLookName(inferLookName(text, key));
    if (!reference) {
      const nextPalette: [string, string, string] = p.includes("桃") || p.includes("甜")
        ? ["#d88991", "#873e4d", "#f1c1b3"]
        : p.includes("冷") || p.includes("灰")
          ? ["#8d7d89", "#453b49", "#c8bac3"]
          : p.includes("橘") || p.includes("暖")
            ? ["#c77c62", "#744334", "#efbea3"]
            : defaultPalette;
      setPalette(nextPalette);
      setEffectProfile(profileFromPalette(nextPalette, intensity));
    }
    setPromptDirty(false);
    setEvents((v) => [...v, `风格解释：${templates[key].name}`]);
  }
  async function startTryOn() {
    if (promptDirty) interpretStyle();
    setCameraError("");
    setStage("tryon-loading");
    const loadingStartedAt = Date.now();
    const finishLoading = async () => {
      const remaining = Math.max(0, 1450 - (Date.now() - loadingStartedAt));
      if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setStage("tryon");
    };
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
      setEvents((v) => [...v, "摄像头已开启：开始本地实时定位"]);
      await finishLoading();
    } catch {
      setCamera(false);
      setMeshStatus("fallback");
      setCameraError("摄像头未授权，示例脸仍可演示妆效与教学流程。");
      await finishLoading();
    }
  }
  function acceptLook() {
    setStep(0);
    setStage("coach-loading");
    setEvents((v) => [...v, `已确认妆效：${activeLookName}，浓度 ${intensity}%`]);
    window.setTimeout(() => setStage("coach"), 1450);
  }
  function speakText(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    speechSynthesis.speak(u);
  }
  function startPromptDictation() {
    const browser = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setEvents((items) => [...items, "当前浏览器不支持语音输入，请直接键入想法"]);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken) {
        setPrompt(spoken);
        setPromptDirty(true);
      }
    };
    recognition.start();
  }
  function speak() {
    speakText(`${current.title}。${current.instruction}`);
  }
  function updateVoiceTranscript(message: string) {
    setChatHistory((items) => items.at(-1) === message ? items : [...items, message].slice(-48));
  }
  function displayChatMessage(message: string) {
    if (/^(你说|你问)：?/.test(message)) return message.replace(/^(你说|你问)：?\s*[“"]?/, "").replace(/[”"]$/, "");
    return message.replace(/^MirrorMate：\s*/, "");
  }
  function placePetDialogue() {
    const rect = petToggleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dialogueWidth = Math.min(352, window.innerWidth - 24);
    const targetHeight = Math.min(430, window.innerHeight - 24);
    setPetDialoguePlacement({
      vertical: rect.top >= targetHeight + 12 || window.innerHeight - rect.bottom < targetHeight + 12 ? "above" : "below",
      horizontal: rect.left + dialogueWidth + 8 <= window.innerWidth ? "start" : "end",
    });
  }
  function startPetDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const shell = event.currentTarget.parentElement;
    if (!shell) return;
    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    petDragRef.current = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, didDrag: false };
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const drag = petDragRef.current;
      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.didDrag = true;
      setPetPosition({
        left: Math.max(8, Math.min(window.innerWidth - 120, drag.left + dx)),
        top: Math.max(8, Math.min(window.innerHeight - 134, drag.top + dy)),
      });
      if (petOpen) requestAnimationFrame(placePetDialogue);
    };
    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (petOpen) requestAnimationFrame(placePetDialogue);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function togglePet() {
    if (petDragRef.current.didDrag) {
      petDragRef.current.didDrag = false;
      return;
    }
    if (!petOpen) placePetDialogue();
    setPetOpen((open) => !open);
  }
  function stopVoiceCoach() {
    realtimeActiveRef.current = false;
    realtimeConfigSentRef.current = false;
    realtimeGreetingSentRef.current = false;
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
      setChatHistory((items) => [...items, `MirrorMate：${text}`].slice(-48));
      if (!realtimeActiveRef.current) speakText(text);
    };
    updateVoiceTranscript(`你说：“${transcript}”`);
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
    if (/放大|看局部|局部视图/.test(cleaned)) {
      setFocusMode("detail");
      say("已放大当前教学局部，右侧仍保留整脸目标方便对照。");
      return;
    }
    if (/整脸|缩小|退回全脸|退回整脸/.test(cleaned)) {
      setFocusMode("full");
      say("已退回整脸视图。");
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
    if (/肤质|干皮|油皮|敏感|妆前|保湿|清洁|卡粉|起皮/.test(cleaned)) {
      const profile = /干皮|起皮/.test(cleaned) ? "dry" : /油皮/.test(cleaned) ? "oily" : /敏感/.test(cleaned) ? "sensitive" : skinProfile;
      if (profile === "unknown") {
        say("你现在更接近偏干、偏油、敏感，还是比较稳定？我会据此调整妆前提醒，不替你诊断肤质。");
      } else {
        say(prepGuide[profile]);
      }
      return;
    }
    if (/什么刷|什么工具|怎么画|怎么晕|取多少|什么时候停|位置/.test(cleaned)) {
      const knowledge = knowledgeByZone[current.zone] ?? knowledgeByZone.base;
      say(`当前建议用${knowledge.tool}。${knowledge.amount}。${knowledge.technique}。${knowledge.stopCondition}`);
      return;
    }
    say(`我听到你说${transcript}。你可以说下一步、慢一点、再说一遍或救一下。`);
  }
  async function sendAgentMessage() {
    const question = agentDraft.trim();
    if (!question) return;
    setAgentDraft("");
    setEvents((items) => [...items, `文字提问：${question}`]);
    const snapshot = coachSnapshotRef.current ?? coachSnapshot;
    setChatHistory((items) => [...items, `你问：${question}`].slice(-16));
    try {
      const response = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          context: coachInstructions(snapshot),
          history: chatHistory.slice(-8),
        }),
      });
      const body = await response.json().catch(() => ({})) as { reply?: string; error?: string };
      if (!response.ok || !body.reply) throw new Error(body.error || "小妆伴暂时没有听清");
      setChatHistory((items) => [...items, `MirrorMate：${body.reply}`].slice(-16));
      updateVoiceTranscript(`MirrorMate：${body.reply}`);
    } catch (error) {
      setEvents((items) => [...items, `小妆伴文字服务暂不可用：${error instanceof Error ? error.message : "未知错误"}`]);
      handleVoiceCommand(question);
    }
  }
  function requestRealtimeWelcome(channel: RTCDataChannel) {
    if (realtimeGreetingSentRef.current || channel.readyState !== "open") return;
    realtimeGreetingSentRef.current = true;
    const snapshot = coachSnapshotRef.current ?? coachSnapshot;
    channel.send(JSON.stringify({
      event_id: `mirrormate_welcome_${Date.now()}`,
      type: "response.create",
      response: { instructions: `请用一到两句自然、温暖的中文以“小妆伴”身份欢迎用户。她本次目标是“${snapshot.userIntent}”，已知想法是“${snapshot.inspiration}”，当前处于 ${snapshot.journeyStage} 阶段。根据阶段给出一个最容易开始的下一步：上传/选妆阶段邀请她上传灵感或说一个担心；试妆阶段邀请她先看整体；跟练阶段直接陪她完成当前这一小步。不要罗列功能、不要自我介绍成系统、不要用客服腔。` },
    }));
  }
  function sendRealtimeSessionUpdate(
    channel: RTCDataChannel,
    snapshot: CoachSnapshot,
    initialize = true,
  ) {
    if (channel.readyState !== "open") return;
    const session = initialize
      ? {
          modalities: ["text", "audio"],
          audio: {
            input: { format: { type: "pcm", sample_rate: 16000 } },
            output: { format: { type: "pcm", sample_rate: 24000 }, voice: "longanlingxin" },
          },
          input_audio_transcription: { model: "qwen3-asr-flash-realtime" },
          turn_detection: {
            type: "semantic_vad",
            prefix_padding_ms: 500,
            silence_duration_ms: 700,
            threshold: 0.35,
          },
          instructions: coachInstructions(snapshot),
          tools: realtimeCoachTools,
          temperature: 0.9,
          max_tokens: 480,
        }
      : { instructions: coachInstructions(snapshot) };
    channel.send(
      JSON.stringify({
        event_id: `mirrormate_session_${Date.now()}`,
        type: "session.update",
        session,
      }),
    );
  }
  function runRealtimeCoachTool(name: string, args: Record<string, unknown>) {
    const snapshot = coachSnapshotRef.current ?? coachSnapshot;
    if (name === "get_coaching_context") return snapshot;
    if (name === "search_teaching_knowledge") {
      return searchTeachingKnowledge(String(args.query || ""));
    }
    if (name === "move_step") {
      const direction = args.direction === "previous" ? "previous" : "next";
      const requestedStep = direction === "previous"
        ? Math.max(0, snapshot.stepIndex - 1)
        : Math.min(snapshot.totalSteps - 1, snapshot.stepIndex + 1);
      const changed = requestedStep !== snapshot.stepIndex;
      setStep((value) => {
        return direction === "previous"
          ? Math.max(0, value - 1)
          : Math.min(snapshot.totalSteps - 1, value + 1);
      });
      setRescue(false);
      setEvents((items) => [...items, `语音切换：${direction === "previous" ? "上一步" : "下一步"}`]);
      return { ok: true, changed, direction, message: changed ? "步骤已切换" : "已经到达边界步骤" };
    }
    if (name === "set_mirror_view") {
      const mode: FocusMode = args.mode === "detail" ? "detail" : "full";
      setFocusMode(mode);
      setEvents((items) => [...items, mode === "detail" ? "放大当前教学局部" : "退回整脸视图"]);
      return { ok: true, mode, message: mode === "detail" ? "操作镜头已放大当前局部，右侧仍保留整脸对照" : "操作镜头已退回整脸" };
    }
    if (name === "open_rescue") {
      setRescue(true);
      setEvents((items) => [...items, `语音求助：${String(args.problem || "当前步骤")}`]);
      return { ok: true, rescue: snapshot.knowledge.rescue, rule: "只纠一个关键问题；视觉置信度不足时不判断完成质量" };
    }
    return { ok: false, error: `未知工具：${name}` };
  }
  function answerRealtimeTool(
    channel: RTCDataChannel,
    callId: string,
    name: string,
    rawArguments = "{}",
  ) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(rawArguments) as Record<string, unknown>;
    } catch {
      args = {};
    }
    const output = runRealtimeCoachTool(name, args);
    channel.send(JSON.stringify({
      event_id: `mirrormate_tool_${Date.now()}`,
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
    }));
    channel.send(JSON.stringify({
      event_id: `mirrormate_response_${Date.now()}`,
      type: "response.create",
    }));
  }
  async function startVoiceCoach() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setVoiceStatus("error");
      return;
    }
    stopVoiceCoach();
    setVoiceStatus("connecting");
    updateVoiceTranscript("正在安全连接 MirrorMate 实时语音…");
    try {
      const voiceStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      voiceStreamRef.current = voiceStream;
      const pc = new RTCPeerConnection();
      realtimePcRef.current = pc;
      const track = voiceStream.getAudioTracks()[0];
      if (track) track.enabled = false;
      const sender = track ? pc.addTrack(track, voiceStream) : null;
      // Creating a local channel makes it part of the SDP negotiation. Bailian
      // then opens its own `txt` channel for realtime events; messages must be
      // read from and sent back on that server-created channel.
      const offerChannel = pc.createDataChannel("oai-events");
      realtimeChannelRef.current = offerChannel;
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
      const listenForRealtimeEvents = (eventChannel: RTCDataChannel) => {
        eventChannel.onmessage = (event) => {
          let data: {
            type?: string;
            transcript?: string;
            name?: string;
            arguments?: string;
            call_id?: string;
            error?: { message?: string };
          };
          try { data = JSON.parse(event.data); } catch { return; }
          if (data.type === "session.created") {
            // Do not release microphone audio yet. A voice segment arriving
            // between session.created and session.updated is handled using
            // Qwen's default persona, which is exactly the identity race we
            // must prevent for the companion.
            if (realtimeConfigSentRef.current) return;
            realtimeConfigSentRef.current = true;
            realtimeChannelRef.current = eventChannel;
            sendRealtimeSessionUpdate(eventChannel, coachSnapshotRef.current ?? coachSnapshot);
          } else if (data.type === "session.updated") {
            if (realtimeConfigSentRef.current && !realtimeActiveRef.current) {
              if (track) track.enabled = true;
              sender?.replaceTrack(track ?? null).catch(() => {});
              realtimeActiveRef.current = true;
              setVoiceStatus("listening");
              updateVoiceTranscript("已接通 MirrorMate。它会从选妆陪你到完成，你可以随时开口或输入问题。 ");
              requestRealtimeWelcome(eventChannel);
            }
          } else if (realtimeActiveRef.current && data.type === "conversation.item.input_audio_transcription.completed" && data.transcript) {
            updateVoiceTranscript(`你说：“${data.transcript}”`);
          } else if (
            data.type === "response.function_call_arguments.done" &&
            data.name &&
            data.call_id
          ) {
            updateVoiceTranscript("我看一下这一小步。");
            answerRealtimeTool(eventChannel, data.call_id, data.name, data.arguments);
          } else if (realtimeActiveRef.current && data.type === "response.audio_transcript.done" && data.transcript) {
            updateVoiceTranscript(`MirrorMate：${data.transcript}`);
          } else if (data.type === "error") {
            setVoiceStatus("error");
          }
        };
      };
      // The server may create a second DataChannel. Per the official WebRTC
      // flow, session.update must be sent back on whichever channel delivered
      // session.created, so the handler above promotes it only at that point.
      listenForRealtimeEvents(offerChannel);
      pc.ondatachannel = (event) => {
        if (event.channel.label !== "txt") return;
        listenForRealtimeEvents(event.channel);
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
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch {
      stopVoiceCoach();
      setVoiceStatus("error");
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
    setReferenceFile(null);
    setPalette(defaultPalette);
    setEffectProfile(defaultEffectProfile);
    setTemplateKey("daily");
    setLookName("");
    setLookNameTouched(false);
    setPrompt("低饱和、干净、日常通勤");
    setPromptDirty(false);
    setIntensity(55);
    setReferenceAnalysis(null);
    setIntent("learn");
    setCamera(false);
    setCameraError("");
    setMeshStatus("idle");
    setTrackingQuality("waiting");
    setGazeStatus("unknown");
    setShowMesh(false);
    setFocusMode("full");
    setSkinProfile("unknown");
    setPrepChecked(false);
    setStage("intro");
    setStep(0);
    setRescue(false);
    setAgentDraft("");
    setChatHistory([]);
    setPetOpen(false);
    setPetPosition(null);
    welcomeShownRef.current = false;
    setEvents([]);
  }
  return (
    <main className="app-shell" style={paletteStyle}>
      {stage !== "intro" && <header className="appbar">
        <span className="mirrormate-wordmark" aria-label="MirrorMate 美妆陪练">MirrorMate<small>BEAUTY STUDY</small></span>
        <button className="brand-button" onClick={reset}>
          <b>MirrorMate<small>BEAUTY STUDY</small></b>
        </button>
        <div className="appbar-actions">
          <span className="local-badge">本地模式</span>
          <span className="editorial-search">⌕</span>
        </div>
      </header>}
      {stage === "intro" && <>
        <section className="opening-screen">
          <div className="opening-aura" />
          <div className="opening-editorial-copy" aria-hidden="true">
            <p><span>BEAUTY,</span><span>IN FOCUS.</span></p>
            <div><b>LOOK CLOSER.</b><small>A thoughtful mirror for every detail,<br />from borrowed inspiration to your own reflection.</small></div>
          </div>
          <img src="/editorial/mirrormate-opening-model.png" alt="MirrorMate 开屏人物" className="opening-portrait" />
          <div className="opening-wordmark"><b>MirrorMate</b><small>BEAUTY STUDY</small></div>
          <button className="opening-invite" onClick={() => setStage("upload")}>
            <b>从灵感，到镜前</b><i>开始体验&nbsp;→</i>
          </button>
          <span className="opening-scroll-cue">SCROLL TO EXPLORE&nbsp; ↓</span>
        </section>
        <section className="opening-scenes" aria-label="MirrorMate 使用场景">
          <div className="scene-intro"><p className="kicker">MIRRORMATE / MOMENTS</p><h2>每一次对镜，<br />都可以更笃定。</h2><span>悬停，读到属于这一刻的帮助。</span></div>
          <div className="scene-grid">
            {sceneMoments.map((scene, sceneIndex) => <button className={`scene-card scene-${sceneIndex + 1}`} key={scene.index} onClick={() => { setIntent(scene.intent); setSceneDetail(sceneIndex); }}>
              <img className="scene-person" src={`/editorial/${scene.image}`} alt="" />
              <div><small>{scene.index}</small><b>{scene.title}</b><span>{scene.label}</span></div><p>{scene.copy}</p>
            </button>)}
          </div>
        </section>
        {sceneDetail !== null && (
          <div className="scene-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSceneDetail(null); }}>
            <section className="scene-modal" role="dialog" aria-modal="true" aria-label={sceneMoments[sceneDetail].title}>
              <button className="scene-modal-close" onClick={() => setSceneDetail(null)} aria-label="关闭场景介绍">×</button>
              <div className={`scene-modal-portrait scene-${sceneDetail + 1}`}><img src={`/editorial/${sceneMoments[sceneDetail].image}`} alt="" /></div>
              <div className="scene-modal-copy"><p className="kicker">{sceneMoments[sceneDetail].label}</p><h2>{sceneMoments[sceneDetail].title}</h2><p>{sceneMoments[sceneDetail].copy}</p><button className="scene-modal-enter" onClick={() => { setSceneDetail(null); setStage("upload"); }}>从这里开始&nbsp; →</button></div>
            </section>
          </div>
        )}
      </>}
      {stage === "upload" && (
        <section className="inspiration-page">
          <div className="inspiration-banner">
            <img src="/editorial/mirrormate-banner-v2.png" alt="MirrorMate 妆容灵感" />
            <div className="banner-copy"><p className="kicker">YOUR LOOK, IN MOTION</p><h1>先把心动的妆，<br />带到镜子前。</h1><span>上传一张灵感图，把它拆成属于你的对镜动作。</span></div>
          </div>
          <div className="inspiration-main">
            <div className="reference-input-area">
              <label className={`inspiration-upload ${reference ? "has-image" : ""}`}>
                <input type="file" accept="image/*" onChange={onFile} />
                {reference ? <img src={reference} alt="已上传妆容范本" /> : <><b>＋</b><strong>上传妆容灵感</strong><span>JPG / PNG · 仅用于本次体验</span></>}
              </label>
              <label className="look-name-input upload-look-name">
                <span>妆容命名</span>
                <input
                  value={lookName}
                  onChange={(event) => { setLookName(event.target.value); setLookNameTouched(true); }}
                  placeholder={reference ? templates[templateKey].name : "上传后可自动生成"}
                  aria-label="妆容名称"
                />
                <small>{reference ? "留空时，使用图片解析出的名称" : "可先输入；上传后也会自动生成建议名称"}</small>
              </label>
            </div>
            <div className="inspiration-copy">
              <p className="kicker">IMAGE-TO-MIRROR</p>
              <h2>一张灵感图，<br />一段属于你的练习。</h2>
              <p>先建立静态试妆方向，再用面部定位把重点拆解为可跟练的局部动作。</p>
              <button className="primary start-tryon" onClick={startTryOn}>完成上传，开始试妆 <span>→</span></button>
              <small className="privacy-line"><i /> 图片只在本次会话中使用</small>
            </div>
          </div>
          <div className="intent-panel">
            <div><p className="kicker">CHOOSE YOUR INTENTION</p><h2>这次，你想怎样靠近它？</h2></div>
            <div className="intent-options">
              {([
                ["learn", "学会它", "拆成步骤，跟着镜子练"],
                ["replicate", "尽量复刻", "保留参考妆的完整情绪"],
                ["everyday", "自然一点", "把灵感调成日常可用版本"],
              ] as const).map(([key, name, detail]) => <button key={key} className={intent === key ? "active" : ""} onClick={() => setIntent(key)}><b>{name}</b><span>{detail}</span></button>)}
            </div>
          </div>
          <div className="idea-bar">
            <div><label htmlFor="look-idea">还有什么想先告诉 MirrorMate？</label><textarea id="look-idea" value={prompt} onChange={(e) => { setPrompt(e.target.value); setPromptDirty(true); }} placeholder="例如：眼尾想更干净一些，但保留一点氛围感" /></div>
            <button className="dictation-button" onClick={startPromptDictation}>◉ <span>说出想法</span></button>
          </div>
          <section className="feature-gallery" aria-label="技术展示">
            <article><figure><img src="/editorial/feature-static-preview-v1.png" alt="模特跟随白色动态箭头练习眼妆" /></figure><div><em>01</em><h3>静态妆效预览</h3><p>先判断方向，再开始练习</p></div></article>
            <article><figure><img src="/editorial/feature-face-landmarks-v1.png" alt="贴合模特面部的三角拓扑定位" /></figure><div><em>02</em><h3>478 点面部定位</h3><p>每一步都落在自己的脸上</p></div></article>
            <article><figure><img src="/editorial/feature-voice-coach-v1.png" alt="模特在镜前使用实时语音陪练" /></figure><div><em>03</em><h3>实时语音陪练</h3><p>卡住时，只问当下这一件事</p></div></article>
          </section>
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
              参考图先用于生成静态试妆预览；本地网格只做落点与教学辅助，不把图形覆盖层称为真实试妆。
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
                {reference
                  ? "参考图仅本地读取"
                  : "没有上传图片"}
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
              {reference && (
                <button className="interpret-button" onClick={() => setStage("precision")}>
                  先校准七分区落点
                </button>
              )}
              <button className="cloud-button" onClick={() => setStage("cloud")}>
                生成真实感静态试妆预览
              </button>
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
              开启摄像头，查看本地落点辅助
            </button>
          </div>
        </section>
      )}
      {stage === "precision" && reference && (
        <ReferencePrecisionLab
          imageUrl={reference}
          onBack={() => setStage("design")}
          onConfirm={() => {
            setEvents((items) => [...items, "已确认参考图的七分区相对落点"]);
            startTryOn();
          }}
        />
      )}
      {stage === "cloud" && (
        <CloudMakeupTransfer
          referenceFile={referenceFile}
          referenceUrl={reference}
          onBack={() => setStage("design")}
          onUseAsGoal={() => startTryOn()}
        />
      )}
      {stage === "tryon-loading" && (
        <section className="coach-loading tryon-loading" aria-label="正在生成试妆预览">
          <div className="wave-stage" aria-hidden="true"><i /><i /><i /></div>
          <p className="kicker">MIRRORMATE · ALIGNING</p>
          <h2>把这份灵感，<br />轻轻对准你的轮廓。</h2>
          <span>{activeLookName} · 正在准备镜面预览</span>
        </section>
      )}
      {stage === "tryon" && (
        <section className="tryon-layout stage-fade">
          <div className="tryon-copy">
            <p className="kicker">STEP 2 · LOOK CHECK</p>
            <h2>确认今天的<br />「{activeLookName}」。</h2>
            <p>先在镜前看整体平衡；妆效名称会根据你输入的灵感词或参考图解析方向自动映射，也可在上一步手动修改。</p>
            <div className="look-check-note">
              <span><i className={meshStatus} />{meshStatus === "tracking" ? "已定位" : "准备定位"}</span>
              <small>面部数据仅在本设备处理</small>
            </div>
            <label className="intensity-control">
              <span>
                妆感强度 <b>{intensity}%</b>
              </span>
              <input
                type="range"
                min="15"
                max="90"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
            <button
              className="secondary wide"
              onClick={() => setStage("design")}
            >
              返回调整灵感
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
              确认，开始跟练&nbsp; →
            </button>
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
            effectProfile={effectProfile}
            effectsEnabled={previewEffectsVisible}
            onEffectHoldChange={setPreviewEffectsVisible}
            mode="tryon"
            showMesh={showMesh}
            onQuality={onTrackingQuality}
            gazeStatus={gazeStatus}
            showGazeGuide
            onGaze={setGazeStatus}
          />
          {cameraError && (
            <p className="camera-error tryon-error">{cameraError}</p>
          )}
        </section>
      )}
      {stage === "coach-loading" && (
        <section className="coach-loading" aria-label="正在进入对镜跟练">
          <div className="wave-stage" aria-hidden="true"><i /><i /><i /></div>
          <p className="kicker">MIRRORMATE · PREPARING</p>
          <h2>把妆容拆成<br />可以跟上的动作。</h2>
          <span>{activeLookName}</span>
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
            onGaze={setGazeStatus}
          />
          <aside className="lesson-panel">
            <div>
              <p className="kicker">STEP 3 · 对镜跟练</p>
              <h2>{activeLookName}</h2>
              <div className="progress-track">
                <i style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-label">
                第 {step + 1} / {t.steps.length} 步
              </span>
            </div>
            <div className="step-groups" aria-label="练妆步骤">
              {stepGroups.map((group, groupIndex) => (
                <section className="step-group" key={group.title}>
                  <header>
                    <span>{String(groupIndex + 1).padStart(2, "0")}</span>
                    <div><b>{group.title}</b><small>{group.note}</small></div>
                  </header>
                  <ol className="step-list">
                    {group.steps.map((s) => (
                      <li key={s.title} className={s.index === step ? "active" : s.index < step ? "done" : ""}>
                        <button onClick={() => { setStep(s.index); setRescue(false); }}>
                          <span>{s.index < step ? "✓" : s.index + 1}</span>
                          <div><b>{s.title}</b><small>{s.short}</small></div>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            <div className="privacy-mini">
              <i />
              {statusCopy(meshStatus)}
            </div>
          </aside>
          <div className="mirror-stage dual-mirror-stage">
            <div className="mirror-view-controls" aria-label="镜面视图">
              <span>操作镜头</span>
              <button
                className={focusMode === "full" ? "active" : ""}
                onClick={() => setFocusMode("full")}
              >
                整脸
              </button>
              <button
                className={focusMode === "detail" ? "active" : ""}
                onClick={() => setFocusMode("detail")}
              >
                放大当前局部
              </button>
            </div>
            <div className="coach-mirror-cell">
              <p className="coach-view-label">
                操作镜头 · {focusMode === "detail" ? "当前局部已放大" : "按箭头上妆"}
              </p>
            <LiveMirror
              camera={camera}
              videoRef={guideVideoRef}
              stream={streamRef.current}
              meshStatus={meshStatus}
              onMeshStatus={onMeshStatus}
              palette={palette}
              intensity={intensity}
              look={templateKey}
              effectProfile={effectProfile}
              teachingZone={current.zone}
              mode="teach"
              showMesh={false}
              brushDirection={current.zone}
              landmarksRef={coachLandmarksRef}
              onQuality={onTrackingQuality}
              focusMode={focusMode}
              focusZone={current.zone}
              gazeStatus={gazeStatus}
              showGazeGuide
              onGaze={setGazeStatus}
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
                effectProfile={effectProfile}
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
            {rescue && (
              <div className="tip" role="status">
                <b>先别继续叠色</b>
                <span>{coachSnapshot.knowledge.rescue}</span>
              </div>
            )}
            <div className="pet-coach-note"><b>MirrorMate 小桌宠在右下角陪你。</b><span>随时点它提问、求助或查看本次对话。</span></div>
            <div className="coach-controls">
              <button className="primary" onClick={next}>
                {step === t.steps.length - 1 ? "完成妆容" : "标记此步完成"}
              </button>
            </div>
            <p className="prototype-note">
              向 MirrorMate 直接提问工具、用量、落点或手法；它会围绕当前步骤回答。
            </p>
          </aside>
        </section>
      )}
      {stage === "finish" && (
        <section className="finish-screen">
          <div className="confetti confetti-wave" aria-hidden="true">
            {Array.from({ length: 54 }, (_, index) => {
              const spread = (index % 27 - 13) * 42 + (index > 26 ? 18 : 0);
              return <i key={index} style={{ "--x": `${spread}px`, "--r": `${(index * 47) % 560 - 280}deg`, "--d": `${(index % 7) * 25 - 80}px`, animationDelay: `${(index % 9) * 0.035}s` } as React.CSSProperties} />;
            })}
          </div>
          <div className="finish-mark">✓</div>
          <p className="kicker">SESSION COMPLETE</p>
          <h1>你完成了「{activeLookName}」</h1>
          <p>
            从参考风格、实时试妆到对镜跟练，这个妆效已经变成了你能再次复现的动作。
          </p>
          <div className="recap-grid">
            <div>
              <span>已确认妆效</span>
              <b>
                {activeLookName} · {intensity}%
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
              <b className="safe">本地图片已在结束时清除</b>
            </div>
            <div>
              <span>本次陪练</span>
              <b>{events.filter((item) => item.includes("语音") || item.includes("补救")).length ? "你主动使用了镜面引导" : "你完成了自主跟练"}</b>
            </div>
            <div>
              <span>下次可以练习</span>
              <b>{t.area === "眼妆" ? "把眼尾方向留给自己完成" : "在稳定光线下练习更轻的落色"}</b>
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
            <button className="secondary finish-back" onClick={() => { setStep(t.steps.length - 1); setStage("coach"); }}>
              ← 返回上一步
            </button>
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
      {stage !== "intro" && (
        <aside className={`mirror-pet ${voiceStatus} ${petOpen ? "open" : ""} dialogue-${petDialoguePlacement.vertical} dialogue-${petDialoguePlacement.horizontal}`} style={petPosition ? { left: petPosition.left, top: petPosition.top, right: "auto", bottom: "auto" } : undefined} aria-label="MirrorMate 悬浮陪练助手">
          {petOpen && (
            <section className="pet-dialogue" aria-label="MirrorMate 聊天记录">
              <header>
                <div className="pet-mini" aria-hidden="true"><img src="/editorial/xiaozhuangban-teardrop-mirror-v3.png" draggable={false} alt="" /></div>
                <div><b>MirrorMate 小妆伴</b><span>{voiceStatus === "listening" ? "正在陪你练妆" : voiceStatus === "connecting" ? "正在靠近镜子" : "随时准备陪你"}</span></div>
                <button onClick={() => setPetOpen(false)} aria-label="收起聊天窗口">×</button>
              </header>
              <div className="pet-chat-log" aria-live="polite">
                {chatHistory.length ? chatHistory.map((message, index) => <p className={/^(你说|你问)/.test(message) ? "from-user" : "from-pet"} key={`${message}-${index}`}>{displayChatMessage(message)}</p>) : <p className="from-pet">嗨，我是你的镜前小妆伴。想从哪一部分开始？</p>}
              </div>
              <form className="pet-composer" onSubmit={(event) => { event.preventDefault(); sendAgentMessage(); }}>
                <input value={agentDraft} onChange={(event) => setAgentDraft(event.target.value)} placeholder="和小妆伴说句话…" aria-label="输入给 MirrorMate 的问题" />
                <button type="submit" aria-label="发送问题">↑</button>
              </form>
              <div className="pet-actions">
                {voiceStatus === "listening" || voiceStatus === "connecting" ? <button onClick={stopVoiceCoach}>结束陪伴</button> : <button onClick={startVoiceCoach}>{voiceStatus === "error" ? "重新接通" : "开始陪我"}</button>}
                <small>聊天记录只保留在本次体验，重新开始时会清除。</small>
              </div>
            </section>
          )}
          <button ref={petToggleRef} className="pet-toggle" onPointerDown={startPetDrag} onClick={togglePet} aria-expanded={petOpen} aria-label="打开或拖动 MirrorMate 小妆伴">
            <span className="pet-portrait" aria-hidden="true"><img src="/editorial/xiaozhuangban-teardrop-mirror-v3.png" draggable={false} alt="" /></span>
            <span className="pet-caption">{voiceStatus === "listening" ? "陪你中" : voiceStatus === "connecting" ? "连线中" : "小妆伴"}</span>
          </button>
        </aside>
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
  effectProfile,
  effectsEnabled = true,
  onEffectHoldChange,
  intensity,
  look,
  teachingZone,
  mode,
  showMesh,
  brushDirection,
  landmarksRef,
  onQuality,
  gazeStatus = "unknown",
  showGazeGuide = false,
  onGaze,
  focusMode = "full",
  focusZone,
}: {
  camera: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  meshStatus: MeshStatus;
  onMeshStatus: (s: MeshStatus) => void;
  palette: string[];
  effectProfile: MakeupEffectProfile;
  effectsEnabled?: boolean;
  onEffectHoldChange?: (visible: boolean) => void;
  intensity: number;
  look: TemplateKey;
  teachingZone?: string;
  mode: "tryon" | "teach";
  showMesh: boolean;
  brushDirection?: string;
  landmarksRef?: React.RefObject<FaceLandmarks | null>;
  onQuality: (q: TrackingQuality) => void;
  gazeStatus?: GazeStatus;
  showGazeGuide?: boolean;
  onGaze?: (status: GazeStatus) => void;
  focusMode?: FocusMode;
  focusZone?: string;
}) {
  const fallback = !camera || meshStatus === "fallback";
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, videoRef]);
  return (
    <div
      className={`live-mirror ${camera && !fallback ? "camera-on" : ""} ${focusMode === "detail" ? `detail-focus focus-${focusZone ?? "base"}` : ""}`}
    >
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
        effectProfile={effectProfile}
        effectsEnabled={effectsEnabled}
        intensity={intensity}
        look={look}
        teachingZone={teachingZone}
        mode={mode}
        showMesh={showMesh}
        brushDirection={brushDirection}
        landmarksRef={landmarksRef}
        onStatus={onMeshStatus}
        onQuality={onQuality}
        onGaze={onGaze}
      />
      {camera && !fallback && showGazeGuide && gazeStatus === "down" && (
        <div className="eye-line-guide" role="status">
          <i aria-hidden="true" />
          视线稍移到屏幕顶端镜头旁，预览更接近对镜效果
        </div>
      )}
      {onEffectHoldChange && (
        <button
          className="effect-compare-hold"
          onPointerDown={(event) => { event.preventDefault(); onEffectHoldChange(false); }}
          onPointerUp={() => onEffectHoldChange(true)}
          onPointerCancel={() => onEffectHoldChange(true)}
          onPointerLeave={(event) => { if (event.buttons === 1) onEffectHoldChange(true); }}
          aria-label="按住查看无特效原始画面"
        >
          {effectsEnabled ? "按住查看无特效" : "松开恢复妆效"}
        </button>
      )}
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
      <img className="demo-ai-model" src="/editorial/tryon-ai-model.png" alt="AI 妆容预览模特" />
      <svg className="makeup-topology" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <g>
          <polygon points="10,41 33,31 50,45" />
          <polygon points="50,45 67,31 90,41" />
          <polygon points="10,41 31,55 50,45" />
          <polygon points="50,45 69,55 90,41" />
          <polygon points="31,55 50,45 50,71" />
          <polygon points="50,45 69,55 50,71" />
          <polygon points="10,59 41,67 31,83" />
          <polygon points="90,59 59,67 69,83" />
          <polygon points="31,83 50,71 69,83" />
          <polygon points="31,83 50,100 69,83" />
        </g>
      </svg>
      <div className="mirror-caption">
        <span>AI MAKEUP MAP</span>
        <b>{look === "contour" ? "轮廓与光影" : "完整妆容解析"}</b>
      </div>
    </div>
  );
}
