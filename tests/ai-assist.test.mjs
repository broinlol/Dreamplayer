import test from "node:test";
import assert from "node:assert/strict";
import { createHeuristicSuggestions } from "../src/core/ai-assist.js";

test("AI Assist creates editable deterministic cue proposals without applying them", () => {
  const suggestions = createHeuristicSuggestions(["c", "a", "b"], 12, "ruhig nacht");
  assert.deepEqual(suggestions.map((item) => item.assetId), ["a", "b", "c"]);
  assert.deepEqual(suggestions.map((item) => item.at), [0, 4, 8]);
  assert.ok(suggestions.every((item) => item.status === "pending"));
});
