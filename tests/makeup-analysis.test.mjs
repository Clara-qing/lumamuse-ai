import assert from "node:assert/strict";
import test from "node:test";
import { extractReferenceAnalysis } from "../app/makeupAnalysis.ts";

test("extracts a warm low-contrast daily palette", () => {
  const pixels = Array.from({ length: 40 }, (_, i) => [
    180 + (i % 8),
    112 + (i % 6),
    91 + (i % 5),
  ]);
  const result = extractReferenceAnalysis(pixels);
  assert.equal(result.temperature, "偏暖");
  assert.equal(result.suggestedTemplate, "daily");
  assert.equal(result.palette.length, 3);
});

test("detects a dark high-contrast smoky reference", () => {
  const pixels = [
    ...Array(20).fill([32, 27, 36]),
    ...Array(20).fill([205, 185, 198]),
    ...Array(20).fill([105, 82, 100]),
  ];
  const result = extractReferenceAnalysis(pixels);
  assert.equal(result.contrast, "强对比");
  assert.equal(result.suggestedTemplate, "smoky");
  assert.ok(result.suggestedIntensity >= 60);
});

test("returns a safe fallback for an empty sample", () => {
  const result = extractReferenceAnalysis([]);
  assert.deepEqual(result.palette, ["#b97872", "#6f4543", "#e7c0ad"]);
  assert.equal(result.fallback, true);
});
