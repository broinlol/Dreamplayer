import test from "node:test";
import assert from "node:assert/strict";
import { activeCueAt, distributeImageCues, nextCueAfter, normalizeCue, sortCues } from "../src/core/cue-engine.js";

test("activeCueAt reconstructs state deterministically after arbitrary seeks", () => {
  const cues = [
    { id:"late", at:8, assetId:"c" },
    { id:"first", at:0, assetId:"a" },
    { id:"off", at:4, assetId:"b", enabled:false },
    { id:"middle", at:4, assetId:"b" }
  ];
  assert.equal(activeCueAt(cues, 0).id, "first");
  assert.equal(activeCueAt(cues, 7.99).id, "middle");
  assert.equal(activeCueAt(cues, 9).id, "late");
  assert.equal(activeCueAt(cues, 1).id, "first");
  assert.equal(nextCueAfter(cues, 4).id, "late");
});

test("normalization clamps visual and timing parameters", () => {
  const cue = normalizeCue({ at:-4, transform:{ scale:20, panX:-200, panY:300, rotation:900 }, transition:{ fadeMs:9999 } });
  assert.deepEqual([cue.at, cue.transform.scale, cue.transform.panX, cue.transform.panY, cue.transform.rotation, cue.transition.fadeMs], [0, 3, -100, 100, 180, 5000]);
});

test("equal-time cues sort stably by explicit id", () => {
  assert.deepEqual(sortCues([{ id:"z", at:2 }, { id:"a", at:2 }]).map(({ id }) => id), ["a", "z"]);
});

test("image distribution creates a duration block for every image", () => {
  const cues = distributeImageCues(["a", "b", "c", "d", "e", "f"], 20);
  assert.equal(cues.length, 6);
  assert.equal(cues[0].duration, 20 / 6);
  assert.equal(cues[5].at, 100 / 6);
  assert.equal(cues[0].transition.fadeMs, 0);
});

test("cue duration creates a real active interval", () => {
  const cues = [{ id:"short", at:2, duration:1, assetId:"a" }];
  assert.equal(activeCueAt(cues, 2.999).id, "short");
  assert.equal(activeCueAt(cues, 3), null);
});
