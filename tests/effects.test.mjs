import test from "node:test";
import assert from "node:assert/strict";
import { effectStateAt, sortEffectCues } from "../src/core/effects.js";

test("effect cues reconstruct transforms after arbitrary seeks", () => {
  const cues = [
    { id:"right", at:3, effect:{ type:"move-right" } },
    { id:"zoom", at:1, effect:{ type:"zoom-in" } },
    { id:"reset", at:5, effect:{ type:"reset" } }
  ];
  assert.deepEqual(effectStateAt(cues, 0), { scale:1, x:0, y:0 });
  assert.deepEqual(effectStateAt(cues, 4), { scale:1.15, x:8, y:0 });
  assert.deepEqual(effectStateAt(cues, 6), { scale:1, x:0, y:0 });
  assert.deepEqual(effectStateAt(cues, 2), { scale:1.15, x:0, y:0 });
});

test("effect cues remain separate and chronological", () => {
  assert.deepEqual(sortEffectCues([{ id:"b", at:4, effect:{ type:"zoom-out" } }, { id:"a", at:1, effect:{ type:"zoom-in" } }]).map((cue) => cue.id), ["a", "b"]);
});

test("rapid repeated effects remain inside safe visual bounds", () => {
  const cues = Array.from({ length:100 }, (_, index) => ({ id:`z${index}`, at:index / 100, effect:{ type:"zoom-in" } }));
  assert.equal(effectStateAt(cues, 2).scale, 2.5);
});
