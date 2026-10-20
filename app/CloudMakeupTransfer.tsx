"use client";

import { ChangeEvent, useEffect, useState } from "react";

type Props = {
  referenceFile: File | null;
  referenceUrl: string | null;
  onBack: () => void;
  onUseAsGoal: () => void;
};

function dataUriFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("图片读取失败，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

export default function CloudMakeupTransfer({ referenceFile, referenceUrl, onBack, onUseAsGoal }: Props) {
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [fallbackReference, setFallbackReference] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [fallbackPreview, setFallbackPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activeReference = referenceFile ?? fallbackReference;
  const activeReferencePreview = referenceUrl ?? fallbackPreview;

  useEffect(() => () => {
    if (facePreview) URL.revokeObjectURL(facePreview);
    if (fallbackPreview) URL.revokeObjectURL(fallbackPreview);
  }, [facePreview, fallbackPreview]);

  function chooseFace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (facePreview) URL.revokeObjectURL(facePreview);
    setFaceFile(file);
    setFacePreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  }
  function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (fallbackPreview) URL.revokeObjectURL(fallbackPreview);
    setFallbackReference(file);
    setFallbackPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  }
  async function generate() {
    if (!faceFile || !activeReference || !consent) return;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const [faceImage, referenceImage] = await Promise.all([
        dataUriFromFile(faceFile),
        dataUriFromFile(activeReference),
      ]);
      const response = await fetch("/api/makeup-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImage, referenceImage, consent: true }),
      });
      const payload = await response.json().catch(() => ({})) as { image?: string; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error || "生成失败，请稍后重试。");
      setResult(payload.image);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "生成失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return <section className="cloud-transfer">
    <div className="section-head">
      <div><p className="kicker">PHOTO TRY-ON · 云端预览</p><h2>先生成一张真实感试妆图</h2></div>
      <p>这不是实时滤镜：服务会基于两张图片生成一张静态预览，用来判断妆容方向是否值得跟练。</p>
    </div>
    <div className="transfer-grid">
      <div className="transfer-inputs">
        <label className="transfer-upload">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFace} />
          {facePreview ? <img src={facePreview} alt="待试妆的正脸照" /> : <><b>上传你的清晰正脸照</b><span>正脸、无遮挡、自然光优先</span></>}
        </label>
        <label className="transfer-upload">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} />
          {activeReferencePreview ? <img src={activeReferencePreview} alt="参考妆容图" /> : <><b>上传参考妆容图</b><span>清晰完整成妆、尽量正脸</span></>}
          {referenceFile && <em>已使用刚才导入的参考图；需要换图可在此选择。</em>}
        </label>
      </div>
      <div className="transfer-action">
        <div className="transfer-rule"><b>生成边界</b><span>仅生成静态效果图；不会被用于实时贴脸、五官评分或训练模型。</span></div>
        <label className="transfer-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>我同意仅为本次生成，将我的正脸照和参考妆容图发送至阿里云百炼图像服务。MirrorMate 服务端不持久化保存输入；调用可能产生费用。</span>
        </label>
        <button className="primary" disabled={!faceFile || !activeReference || !consent || busy} onClick={generate}>
          {busy ? "正在生成真实感预览…" : "生成试妆预览"}
        </button>
        {error && <p className="transfer-error" role="alert">{error}</p>}
        {result && <div className="transfer-result"><img src={result} alt="AI 生成的静态试妆预览" /><b>静态预览已生成</b><span>请只把它当作妆效方向参考。身份或背景被改动、细节失真时，不应继续作为教学目标。</span><button className="primary" onClick={onUseAsGoal}>用这个方向进入本地跟练</button></div>}
      </div>
    </div>
    <button className="secondary" onClick={onBack}>返回设计页</button>
  </section>;
}
