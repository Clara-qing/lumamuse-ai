export type RGB = [number, number, number];

export type ReferenceAnalysis = {
  palette: [string, string, string];
  temperature: "偏暖" | "中性" | "偏冷";
  saturation: "低饱和" | "中饱和" | "高饱和";
  contrast: "柔和" | "中等" | "强对比";
  suggestedTemplate: "daily" | "smoky";
  suggestedIntensity: number;
  fallback: boolean;
};

const luminance = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const distance = (a: RGB, b: RGB) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const hex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

export function extractReferenceAnalysis(pixels: RGB[]): ReferenceAnalysis {
  const usable = pixels.filter(([r, g, b]) => {
    const l = luminance([r, g, b]);
    return l > 22 && l < 242 && Math.max(r, g, b) - Math.min(r, g, b) > 7;
  });
  const source = usable.length >= 12 ? usable : pixels;
  if (!source.length)
    return {
      palette: ["#b97872", "#6f4543", "#e7c0ad"],
      temperature: "中性",
      saturation: "低饱和",
      contrast: "柔和",
      suggestedTemplate: "daily",
      suggestedIntensity: 55,
      fallback: true,
    };
  const sorted = [...source].sort((a, b) => luminance(a) - luminance(b));
  let centers: RGB[] = [
    sorted[Math.floor(sorted.length * 0.15)],
    sorted[Math.floor(sorted.length * 0.5)],
    sorted[Math.floor(sorted.length * 0.85)],
  ].map((x) => [...x] as RGB);
  for (let round = 0; round < 7; round++) {
    const groups: RGB[][] = [[], [], []];
    source.forEach((p) => {
      let best = 0;
      for (let i = 1; i < 3; i++)
        if (distance(p, centers[i]) < distance(p, centers[best])) best = i;
      groups[best].push(p);
    });
    centers = centers.map((old, i) =>
      groups[i].length
        ? (groups[i]
            .reduce<RGB>(
              (s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]],
              [0, 0, 0],
            )
            .map((v) => v / groups[i].length) as RGB)
        : old,
    );
  }
  centers.sort((a, b) => luminance(a) - luminance(b));
  const meanSat =
    source.reduce((s, p) => s + (Math.max(...p) - Math.min(...p)), 0) /
    source.length;
  const warmth = source.reduce((s, [r, , b]) => s + r - b, 0) / source.length;
  const spread = luminance(centers[2]) - luminance(centers[0]);
  const saturation =
    meanSat < 35 ? "低饱和" : meanSat < 75 ? "中饱和" : "高饱和";
  const contrast = spread < 55 ? "柔和" : spread < 115 ? "中等" : "强对比";
  const suggestedTemplate =
    spread > 105 && luminance(centers[0]) < 75 ? "smoky" : "daily";
  return {
    palette: [hex(centers[1]), hex(centers[0]), hex(centers[2])],
    temperature: warmth > 12 ? "偏暖" : warmth < 2 ? "偏冷" : "中性",
    saturation,
    contrast,
    suggestedTemplate,
    suggestedIntensity: Math.round(
      Math.max(35, Math.min(78, 42 + spread * 0.22 + meanSat * 0.08)),
    ),
    fallback: false,
  };
}
