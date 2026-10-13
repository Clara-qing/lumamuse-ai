import assert from "node:assert/strict";
import test from "node:test";
import { trackingQuality } from "../app/trackingQuality.ts";

function face(left = 0.2, right = 0.8, nose = 0.5) {
  const p = Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  p[1] = { x: nose, y: 0.5, z: -0.1 };
  p[234] = { x: left, y: 0.5, z: 0 };
  p[454] = { x: right, y: 0.5, z: 0 };
  return p;
}
test("accepts a centered face at usable scale", () =>
  assert.equal(trackingQuality(face()), "ready"));
test("asks a small face to move closer", () =>
  assert.equal(trackingQuality(face(0.4, 0.58, 0.5)), "closer"));
test("asks an oversized face to move farther", () =>
  assert.equal(trackingQuality(face(0.05, 0.88, 0.5)), "farther"));
test("asks an off-center face to recenter", () =>
  assert.equal(trackingQuality(face(0.1, 0.5, 0.2)), "center"));
test("prioritizes distance before centering", () =>
  assert.equal(trackingQuality(face(0.4, 0.58, 0.15)), "closer"));
test("waits when required landmarks are absent", () =>
  assert.equal(trackingQuality([]), "waiting"));
