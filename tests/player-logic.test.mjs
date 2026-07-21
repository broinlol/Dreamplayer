import test from "node:test";
import assert from "node:assert/strict";
import { clampSeek, cueAtTime, formatTime } from "../src/core/player-logic.js";

const cues = [
  { id:"c3", at:8, assetId:"three" },
  { id:"c1", at:0, assetId:"one" },
  { id:"off", at:3, assetId:"off", enabled:false },
  { id:"c2", at:4, assetId:"two" }
];

test("cue switching is deterministic when seeking forward and backward", () => {
  assert.equal(cueAtTime(cues, 0).assetId, "one");
  assert.equal(cueAtTime(cues, 7.99).assetId, "two");
  assert.equal(cueAtTime(cues, 9).assetId, "three");
  assert.equal(cueAtTime(cues, 1).assetId, "one");
});

test("latest image persists until the next cue even beyond legacy duration", () => {
  assert.equal(cueAtTime([{ id:"only", at:0, duration:0.1, assetId:"image" }], 120).assetId, "image");
});

test("human live cues override AI suggestions at the same time", () => {
  const sameTime = [
    { id:"human", at:4, assetId:"live", source:"human" },
    { id:"ai", at:4, assetId:"suggested", source:"ai" }
  ];
  assert.equal(cueAtTime(sameTime, 4).assetId, "live");
});

test("seek and display helpers handle boundaries", () => {
  assert.equal(clampSeek(-4, 10), 0);
  assert.equal(clampSeek(14, 10), 10);
  assert.equal(formatTime(65.8), "01:05");
});
