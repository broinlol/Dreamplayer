import test from "node:test";
import assert from "node:assert/strict";
import { createDemoProject } from "../src/core/demo-project.js";
import { parseProject, playbackFingerprint, serializeProject, validateProject } from "../src/core/project-serializer.js";

test("demo is a valid self-contained project", async () => {
  const project = await createDemoProject();
  assert.equal(validateProject(project), project);
  assert.equal(project.assets.filter(({ kind }) => kind === "image").length, 5);
  assert.equal(project.timeline.cues.length, 5);
  assert.ok(project.assets.every(({ dataUrl, sha256 }) => dataUrl.startsWith("data:") && sha256.length === 64));
});

test("save/open roundtrip preserves the playback fingerprint", async () => {
  const source = await createDemoProject();
  source.timeline.directionRegions.push({ id:"region-test", start:2, duration:4, label:"Test", status:"open", allowedModes:["cooperative"], brief:"Vorschlag" });
  const before = await playbackFingerprint(source);
  const restored = parseProject(serializeProject(source));
  const after = await playbackFingerprint(restored);
  assert.equal(after, before);
  assert.deepEqual(restored.timeline.cues, source.timeline.cues);
  assert.deepEqual(restored.timeline.directionRegions, source.timeline.directionRegions);
});

test("unknown cue references are rejected", async () => {
  const source = await createDemoProject();
  source.timeline.cues[0].assetId = "missing-image";
  assert.throws(() => validateProject(source), /missing image/);
});

test("projects may contain more than five images and reuse them across cues", async () => {
  const source = await createDemoProject();
  const template = source.assets.find(({ kind }) => kind === "image");
  for (let index = 6; index <= 8; index += 1) source.assets.push({ ...structuredClone(template), id:`image-extra-${index}`, name:`extra-${index}.svg` });
  source.timeline.cues.push({ ...structuredClone(source.timeline.cues[0]), id:"cue-repeat", at:2, duration:1 });
  assert.doesNotThrow(() => validateProject(source));
  assert.equal(source.assets.filter(({ kind }) => kind === "image").length, 8);
  assert.equal(source.timeline.cues.filter(({ assetId }) => assetId === source.timeline.cues[0].assetId).length, 2);
});

test("a project with one image and one song stays valid", async () => {
  const source = await createDemoProject();
  const audio = source.assets.find(({ kind }) => kind === "audio");
  const image = source.assets.find(({ kind }) => kind === "image");
  source.assets = [audio, image];
  source.timeline.cues = [{ id:"cue-1", at:0, assetId:image.id }];
  assert.doesNotThrow(() => validateProject(source));
});

test("a missing audio file is reported clearly", async () => {
  const source = await createDemoProject();
  source.transport.audioAssetId = "missing-audio";
  assert.throws(() => validateProject(source), /audio file is missing/);
});

test("invalid JSON is rejected clearly", () => {
  assert.throws(() => parseProject("not json"), /JSON could not be read/);
});

test("banks and effect cues survive export and import separately", async () => {
  const source = await createDemoProject();
  source.timeline.effectCues = [{ id:"effect-1", at:2, effect:{ type:"zoom-in" } }];
  source.settings.director = { activeBankId:"live", gridMode:"effects", banks:[{ id:"live", name:"Live", assetIds:["image-demo-1"] }] };
  const restored = parseProject(serializeProject(source));
  assert.equal(restored.timeline.effectCues[0].effect.type, "zoom-in");
  assert.equal(restored.settings.director.banks[0].assetIds[0], "image-demo-1");
  assert.equal(restored.timeline.cues.length, source.timeline.cues.length);
});

test("long filenames survive a full project roundtrip without truncating data", async () => {
  const source = await createDemoProject();
  const image = source.assets.find(({ kind }) => kind === "image");
  image.name = `${"very-long-scene-name-".repeat(12)}final.svg`;
  const restored = parseProject(serializeProject(source));
  assert.equal(restored.assets.find(({ id }) => id === image.id).name, image.name);
});
