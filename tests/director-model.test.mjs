import test from "node:test";
import assert from "node:assert/strict";
import { addImagesToBanks, createDirectorState, defaultDirectorPreferences, moveBankAsset, normalizeDirectorState, removeFromBank } from "../src/core/director-model.js";

test("image banks contain at most nine images and grow as needed", () => {
  const ids = Array.from({ length:20 }, (_, index) => `image-${index + 1}`);
  const state = createDirectorState(ids);
  assert.deepEqual(state.banks.map((bank) => bank.assetIds.length), [9, 9, 2]);
  assert.equal(new Set(state.banks.flatMap((bank) => bank.assetIds)).size, 20);
});

test("removing from a bank preserves the source image id for reassignment", () => {
  const state = createDirectorState(["a", "b"]);
  const removed = removeFromBank(state, state.activeBankId, "a");
  assert.deepEqual(removed.banks[0].assetIds, ["b"]);
  const restored = addImagesToBanks(removed, ["a"]);
  assert.ok(restored.banks.flatMap((bank) => bank.assetIds).includes("a"));
});

test("drag model swaps images within and between banks", () => {
  const state = createDirectorState(Array.from({ length:10 }, (_, index) => `i${index}`));
  const moved = moveBankAsset(state, state.banks[0].id, 0, state.banks[1].id, 0);
  assert.equal(moved.banks[1].assetIds[0], "i0");
  assert.equal(moved.banks[0].assetIds[0], "i9");
});

test("old projects receive banks and requested default bank hotkeys", () => {
  const state = normalizeDirectorState(undefined, ["a"]);
  const preferences = defaultDirectorPreferences();
  assert.equal(state.banks[0].assetIds[0], "a");
  assert.equal(preferences.previousBankHotkey, "NumpadAdd");
  assert.equal(preferences.nextBankHotkey, "NumpadSubtract");
});

