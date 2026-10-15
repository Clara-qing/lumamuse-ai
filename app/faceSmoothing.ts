import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Exponential moving average for landmark positions. The current frame keeps
 * priority so deliberate head movement remains responsive, while micro-jitter
 * does not make an AR mask or direction arrow visibly vibrate.
 */
export function smoothLandmarks(
  previous: NormalizedLandmark[] | null,
  current: NormalizedLandmark[],
  currentWeight = 0.68,
): NormalizedLandmark[] {
  if (!previous || previous.length !== current.length) return current;
  const priorWeight = 1 - currentWeight;
  return current.map((point, index) => {
    const prior = previous[index];
    return {
      ...point,
      x: prior.x * priorWeight + point.x * currentWeight,
      y: prior.y * priorWeight + point.y * currentWeight,
      z: (prior.z ?? 0) * priorWeight + (point.z ?? 0) * currentWeight,
    };
  });
}
