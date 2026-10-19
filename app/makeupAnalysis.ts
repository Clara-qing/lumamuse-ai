export type RGB = [number, number, number];

export type MakeupEffectProfile = {
  eyeBase: string;
  eyeOuter: string;
  lowerEye: string;
  cheek: string;
  lip: string;
  contour: string;
  eyeOpacity: number;
  cheekOpacity: number;
  lipOpacity: number;
  source: "reference-regions" | "palette";
};

export type ReferenceAnalysis = {
  palette: [string, string, string];
  temperature: "偏暖" | "中性" | "偏冷";
  saturation: "低饱和" | "中饱和" | "高饱和";
  contrast: "柔和" | "中等" | "强对比";
  suggestedTemplate: "daily" | "smoky";
  suggestedIntensity: number;
  fallback: boolean;
  effectProfile: MakeupEffectProfile;
};

export type ReferenceLandmark = { x: number; y: number };

const luminance = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const distance = (a: RGB, b: RGB) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const hex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const average = (pixels: RGB[]): RGB =>
  pixels.length
    ? (pixels.reduce<RGB>((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
        .map((value) => value / pixels.length) as RGB)
    : [0, 0, 0];

export function profileFromPalette(
  palette: [string, string, string],
  suggestedIntensity: number,
): MakeupEffectProfile {
  const strength = Math.max(0.35, Math.min(0.78, suggestedIntensity / 100));
  return {
    eyeBase: palette[0],
    eyeOuter: palette[1],
    lowerEye: palette[1],
    cheek: palette[0],
    lip: palette[1],
    contour: palette[1],
    eyeOpacity: strength,
    cheekOpacity: strength * 0.62,
    lipOpacity: strength * 0.78,
    source: "palette",
  };
}

export function extractReferenceAnalysis(pixels: RGB[]): ReferenceAnalysis {
  const usable = pixels.filter(([r, g, b]) => {
    const l = luminance([r, g, b]);
    return l > 22 && l < 242 && Math.max(r, g, b) - Math.min(r, g, b) > 7;
  });
  const source = usable.length >= 12 ? usable : pixels;
  if (!source.length) {
    const palette: [string, string, string] = ["#b97872", "#6f4543", "#e7c0ad"];
    return {
      palette,
      temperature: "中性",
      saturation: "低饱和",
      contrast: "柔和",
      suggestedTemplate: "daily",
      suggestedIntensity: 55,
      fallback: true,
      effectProfile: profileFromPalette(palette, 55),
    };
  }
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
  const palette: [string, string, string] = [hex(centers[1]), hex(centers[0]), hex(centers[2])];
  const suggestedIntensity = Math.round(
    Math.max(35, Math.min(78, 42 + spread * 0.22 + meanSat * 0.08)),
  );
  return {
    palette,
    temperature: warmth > 12 ? "偏暖" : warmth < 2 ? "偏冷" : "中性",
    saturation,
    contrast,
    suggestedTemplate,
    suggestedIntensity,
    fallback: false,
    effectProfile: profileFromPalette(palette, suggestedIntensity),
  };
}

const LEFT_EYE_BAND = [33, 246, 161, 160, 159, 158, 157, 173, 133, 107, 66, 105, 63, 70];
const RIGHT_EYE_BAND = [362, 398, 384, 385, 386, 387, 388, 466, 263, 336, 296, 334, 293, 300];
const LEFT_EYE_OUTER = [33, 246, 161, 160, 159, 105, 63, 70];
const RIGHT_EYE_OUTER = [362, 398, 384, 385, 386, 334, 293, 300];
const LEFT_CHEEK = [50, 101, 205, 187, 123, 116];
const RIGHT_CHEEK = [280, 330, 425, 411, 352, 345];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

function pointInPolygon(x: number, y: number, polygon: ReferenceLandmark[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index], b = polygon[previous];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function sampleRegion(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: ReferenceLandmark[],
  ids: number[],
): RGB[] {
  const polygon = ids.map((id) => landmarks[id]).filter(Boolean);
  if (polygon.length < 3) return [];
  const minX = Math.max(0, Math.floor(Math.min(...polygon.map((point) => point.x)) * width));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...polygon.map((point) => point.x)) * width));
  const minY = Math.max(0, Math.floor(Math.min(...polygon.map((point) => point.y)) * height));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...polygon.map((point) => point.y)) * height));
  const samples: RGB[] = [];
  for (let y = minY; y <= maxY; y += 2) for (let x = minX; x <= maxX; x += 2) {
    if (!pointInPolygon(x / width, y / height, polygon)) continue;
    const offset = (y * width + x) * 4;
    if (pixels[offset + 3] > 180) samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
  }
  return samples;
}

function sampleSkinPatches(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: ReferenceLandmark[],
): RGB[] {
  // These are small, usually unpainted patches on the bridge and sides of the
  // nose. Sampling disks is more stable than treating a loose set of mesh
  // points as a polygon (which can self-intersect on different face shapes).
  const sampleIds = [6, 168, 197, 4, 5];
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const samples: RGB[] = [];
  sampleIds.forEach((id) => {
    const point = landmarks[id];
    if (!point) return;
    const centerX = Math.round(point.x * width);
    const centerY = Math.round(point.y * height);
    for (let y = centerY - radius; y <= centerY + radius; y += 2) for (let x = centerX - radius; x <= centerX + radius; x += 2) {
      if (x < 0 || x >= width || y < 0 || y >= height || (x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue;
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] > 180) samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    }
  });
  return samples;
}

function pigmentFromSkinDelta(region: RGB, skin: RGB, amount: number): RGB {
  // A neutral 128 value is visually neutral for soft-light. Encoding only the
  // delta from the reference's bare skin means we transfer "makeup pigment",
  // not the reference person's complexion, illumination, or facial shadow.
  return [
    clamp(128 + (region[0] - skin[0]) * amount),
    clamp(128 + (region[1] - skin[1]) * amount),
    clamp(128 + (region[2] - skin[2]) * amount),
  ];
}

/**
 * Converts a face-bearing reference image into region-specific makeup values.
 * It intentionally has no network dependency: caller provides pixels and the
 * 478-point face landmarks detected locally in the browser.
 */
export function refineReferenceAnalysisByLandmarks(
  base: ReferenceAnalysis,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: ReferenceLandmark[],
): ReferenceAnalysis {
  if (landmarks.length < 400) return base;
  const skin = average(sampleSkinPatches(pixels, width, height, landmarks));
  const leftEye = average(sampleRegion(pixels, width, height, landmarks, LEFT_EYE_BAND));
  const rightEye = average(sampleRegion(pixels, width, height, landmarks, RIGHT_EYE_BAND));
  const leftOuter = average(sampleRegion(pixels, width, height, landmarks, LEFT_EYE_OUTER));
  const rightOuter = average(sampleRegion(pixels, width, height, landmarks, RIGHT_EYE_OUTER));
  const leftCheek = average(sampleRegion(pixels, width, height, landmarks, LEFT_CHEEK));
  const rightCheek = average(sampleRegion(pixels, width, height, landmarks, RIGHT_CHEEK));
  const lips = average(sampleRegion(pixels, width, height, landmarks, LIPS));
  if (!skin.some(Boolean) || !leftEye.some(Boolean) || !rightEye.some(Boolean) || !lips.some(Boolean)) return base;
  const eye = average([leftEye, rightEye]);
  const outer = average([leftOuter, rightOuter]);
  const cheek = average([leftCheek, rightCheek]);
  const eyeDifference = Math.sqrt(distance(eye, skin));
  const lipDifference = Math.sqrt(distance(lips, skin));
  const cheekDifference = Math.sqrt(distance(cheek, skin));
  const eyeBase = pigmentFromSkinDelta(eye, skin, 1.55);
  const eyeOuter = pigmentFromSkinDelta(outer, skin, 1.75);
  const cheekColor = pigmentFromSkinDelta(cheek, skin, 1.4);
  const lipColor = pigmentFromSkinDelta(lips, skin, 1.25);
  const profile: MakeupEffectProfile = {
    eyeBase: hex(eyeBase),
    eyeOuter: hex(eyeOuter),
    lowerEye: hex(eyeOuter),
    cheek: hex(cheekColor),
    lip: hex(lipColor),
    contour: hex(eyeOuter),
    eyeOpacity: Math.max(0.38, Math.min(0.82, 0.34 + eyeDifference / 235)),
    cheekOpacity: Math.max(0.2, Math.min(0.58, 0.18 + cheekDifference / 340)),
    lipOpacity: Math.max(0.34, Math.min(0.8, 0.28 + lipDifference / 250)),
    source: "reference-regions",
  };
  return { ...base, palette: [profile.eyeBase, profile.eyeOuter, base.palette[2]], effectProfile: profile };
}
