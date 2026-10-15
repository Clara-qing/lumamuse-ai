import assert from "node:assert/strict";
import test from "node:test";
import { smoothLandmarks } from "../app/faceSmoothing.ts";

test("uses the current landmarks unchanged without history", () => {
  const frame = [{ x: 0.2, y: 0.3, z: -0.1 }];
  assert.equal(smoothLandmarks(null, frame), frame);
});

test("damps small position changes while retaining current landmark data", () => {
  const result = smoothLandmarks(
    [{ x: 0.2, y: 0.4, z: 0, visibility: 0.9 }],
    [{ x: 0.3, y: 0.6, z: -0.1, visibility: 0.8 }],
    0.7,
  );
  assert.equal(result[0].visibility, 0.8);
  assert.ok(Math.abs(result[0].x - 0.27) < 1e-9);
  assert.ok(Math.abs(result[0].y - 0.54) < 1e-9);
  assert.ok(Math.abs(result[0].z - -0.07) < 1e-9);
});
