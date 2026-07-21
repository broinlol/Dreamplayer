import test from "node:test";
import assert from "node:assert/strict";
import { bytesToDataUrl, classifyFile, formatBytes, sha256Bytes, validateIncomingFiles } from "../src/core/asset-manager.js";

test("media classification accepts MIME and common extensions", () => {
  assert.equal(classifyFile({ name:"track.WAV", type:"" }), "audio");
  assert.equal(classifyFile({ name:"frame.bin", type:"image/webp" }), "image");
  assert.equal(classifyFile({ name:"notes.txt", type:"text/plain" }), null);
});

test("image count is not globally capped", () => {
  const existing = Array.from({ length:5 }, (_, index) => ({ id:`i${index}`, kind:"image", size:1 }));
  const result = validateIncomingFiles([{ name:"six.png", type:"image/png", size:1 }], existing);
  assert.equal(result.incoming.length, 1);
});

test("binary helpers are deterministic", async () => {
  const bytes = new TextEncoder().encode("dreamcue");
  assert.equal(formatBytes(1024), "1.0 KiB");
  assert.equal(bytesToDataUrl(bytes, "text/plain"), "data:text/plain;base64,ZHJlYW1jdWU=");
  assert.equal(await sha256Bytes(bytes), "377d9a21369520313fe86320dee0f733d9b917a0c9200b015a92203bc43accdf");
});
