import { DEMO_CONFIG, LIMITS } from "./limits.js";
import { normalizeCue, sortCues } from "./cue-engine.js";
import { sortDirectionRegions } from "./director-regions.js";
import { normalizeDirectorState } from "./director-model.js";
import { sortEffectCues } from "./effects.js";

export const FORMAT = "dreamcue/0.1-draft";

export function createEmptyProject(title = "Untitled Dreamcue project") {
  return {
    format: FORMAT,
    container: "json-embedded-draft",
    metadata: {
      id: `project-${crypto.randomUUID?.() ?? Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    transport: { audioAssetId: null, volume: 0.85, endMode: "stop" },
    assets: [],
    timeline: { durationSeconds: 0, cues: [], effectCues: [], directionRegions: [] },
    generatorJobs: [],
    settings: { background: "#080a10", imageFit: "contain", demo: { maxImages: DEMO_CONFIG.maxImages } }
  };
}

function fail(message) { throw new Error(`Invalid Dreamcue project: ${message}`); }

export function validateProject(project) {
  if (!project || typeof project !== "object") fail("the project object is missing");
  if (project.format !== FORMAT) fail(`format ${project.format || "is missing"} is not supported`);
  if (!Array.isArray(project.assets)) fail("the asset list is missing");
  if (!Array.isArray(project.timeline?.cues)) fail("the timeline is missing");
  if (project.timeline.effectCues != null && !Array.isArray(project.timeline.effectCues)) fail("effect cues must be an array");
  if (project.timeline.directionRegions != null && !Array.isArray(project.timeline.directionRegions)) fail("direction regions must be an array");
  const ids = new Set();
  let totalBytes = 0;
  for (const asset of project.assets) {
    if (!asset.id || ids.has(asset.id)) fail(`duplicate or missing asset ID ${asset.id || ""}`);
    ids.add(asset.id);
    if (!["audio", "image"].includes(asset.kind)) fail(`asset type ${asset.kind} is not supported in this demo`);
    if (typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith("data:")) fail(`file ${asset.name || asset.id} is missing or is not embedded`);
    if (!/^[a-f0-9]{64}$/i.test(asset.sha256 || "")) fail(`checksum for ${asset.id} is missing`);
    const size = Number(asset.size) || 0;
    totalBytes += size;
    if (asset.kind === "image" && size > LIMITS.maxImageBytes) fail(`image ${asset.name} exceeds the file limit`);
    if (asset.kind === "audio" && size > LIMITS.maxAudioBytes) fail(`audio ${asset.name} exceeds the file limit`);
  }
  if (totalBytes > LIMITS.maxProjectBytes) fail("project media exceeds the 64 MiB raw-data limit");
  if (project.timeline.cues.length > LIMITS.maxCues) fail(`more than ${LIMITS.maxCues} image cues are not supported`);
  for (const cue of project.timeline.cues.map(normalizeCue)) {
    const target = project.assets.find((asset) => asset.id === cue.assetId);
    if (!target) fail(`cue ${cue.id} references a missing image (${cue.assetId})`);
    if (target.kind !== "image") fail(`cue ${cue.id} does not reference an image`);
  }
  if (project.transport.audioAssetId) {
    const audio = project.assets.find((asset) => asset.id === project.transport.audioAssetId);
    if (!audio) fail("the referenced audio file is missing");
    if (audio.kind !== "audio") fail("the audio reference does not point to an audio asset");
  }
  return project;
}

export function canonicalProject(project) {
  validateProject(project);
  const copy = structuredClone(project);
  copy.timeline.cues = sortCues(copy.timeline.cues);
  copy.timeline.effectCues = sortEffectCues(copy.timeline.effectCues || []);
  copy.timeline.directionRegions = sortDirectionRegions(copy.timeline.directionRegions || []);
  copy.timeline.durationSeconds = Math.max(0, Number(copy.timeline.durationSeconds) || 0);
  copy.transport.volume = Math.min(1, Math.max(0, Number(copy.transport.volume) || 0));
  copy.settings = { background: "#080a10", imageFit: "contain", demo: { maxImages: DEMO_CONFIG.maxImages }, ...(copy.settings || {}) };
  copy.settings.demo = { maxImages: DEMO_CONFIG.maxImages, ...(copy.settings.demo || {}) };
  copy.settings.demo.maxImages = Math.min(50, Math.max(1, Math.round(Number(copy.settings.demo.maxImages) || DEMO_CONFIG.maxImages)));
  copy.settings.imageFit = copy.settings.imageFit === "cover" ? "cover" : "contain";
  const imageIds = copy.assets.filter((asset) => asset.kind === "image").map((asset) => asset.id);
  copy.settings.director = normalizeDirectorState(copy.settings.director, imageIds);
  return copy;
}

export function serializeProject(project) {
  const copy = canonicalProject(project);
  copy.metadata.updatedAt = new Date().toISOString();
  return `${JSON.stringify(copy, null, 2)}\n`;
}

export function parseProject(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { fail("the JSON could not be read"); }
  return canonicalProject(parsed);
}

export function playbackManifest(project) {
  const copy = canonicalProject(project);
  return {
    format: copy.format,
    transport: copy.transport,
    assets: copy.assets.map(({ id, kind, sha256 }) => ({ id, kind, sha256 })),
    durationSeconds: copy.timeline.durationSeconds,
    cues: copy.timeline.cues,
    effectCues: copy.timeline.effectCues,
    directionRegions: copy.timeline.directionRegions,
    settings: copy.settings
  };
}

export async function playbackFingerprint(project) {
  const bytes = new TextEncoder().encode(JSON.stringify(playbackManifest(project)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
