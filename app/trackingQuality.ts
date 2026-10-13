export type Point3D = { x: number; y: number; z?: number };
export type TrackingQuality =
  | "ready"
  | "closer"
  | "farther"
  | "center"
  | "waiting";

export function trackingQuality(points: Point3D[]): TrackingQuality {
  if (!points[1] || !points[234] || !points[454]) return "waiting";
  const width = Math.abs(points[454].x - points[234].x);
  if (width < 0.22) return "closer";
  if (width > 0.75) return "farther";
  if (points[1].x < 0.3 || points[1].x > 0.7) return "center";
  return "ready";
}
