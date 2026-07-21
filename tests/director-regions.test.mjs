import test from "node:test";
import assert from "node:assert/strict";
import { createDirectionRegion, normalizeDirectionRegion, sortDirectionRegions } from "../src/core/director-regions.js";

test("direction regions prepare bounded automatic and cooperative work", () => {
  const region = createDirectionRegion(12, 15, 0);
  assert.equal(region.start, 12);
  assert.equal(region.duration, 3);
  assert.deepEqual(region.allowedModes, ["automatic", "cooperative"]);
});

test("direction regions normalize and sort deterministically", () => {
  const regions = sortDirectionRegions([{ id:"b", start:8 }, { id:"a", start:2, status:"unknown", allowedModes:["cooperative", "nope"] }]);
  assert.deepEqual(regions.map(({ id }) => id), ["a", "b"]);
  assert.equal(regions[0].status, "open");
  assert.deepEqual(regions[0].allowedModes, ["cooperative"]);
  assert.equal(normalizeDirectionRegion({ duration:0 }).duration, .25);
});
