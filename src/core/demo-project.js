import { bytesToDataUrl, sha256Bytes } from "./asset-manager.js";
import { distributeImageCues } from "./cue-engine.js";
import { FORMAT } from "./project-serializer.js";
import { DEMO_CONFIG } from "./limits.js";

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function demoWav(seconds = 18, sampleRate = 11025) {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, "RIFF"); view.setUint32(4, bytes.length - 8, true); writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeAscii(view, 36, "data"); view.setUint32(40, samples * 2, true);
  const notes = [110, 146.83, 164.81, 130.81];
  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const section = Math.min(3, Math.floor(time / (seconds / 4)));
    const beat = time % .5;
    const envelope = Math.min(1, time * 3, (seconds - time) * 2) * (0.7 + Math.exp(-beat * 15) * 0.3);
    const tone = Math.sin(2 * Math.PI * notes[section] * time) * .18 + Math.sin(2 * Math.PI * notes[section] * 2 * time) * .05;
    view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, tone * envelope)) * 32767), true);
  }
  return bytes;
}

function svgBytes(index) {
  const palettes = [
    ["#07121f", "#2e6f95", "#d7eef7"],
    ["#170b25", "#7b2f73", "#f6c6ea"],
    ["#1b0c09", "#aa3322", "#ffbf73"],
    ["#061712", "#1d8068", "#c6f6df"],
    ["#191406", "#b28a25", "#fff0a8"]
  ];
  const [dark, color, light] = palettes[index];
  const labels = ["NIGHT ROOM", "ECHO", "RED WEATHER", "AFTERGLOW", "DAYBREAK"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><radialGradient id="g"><stop stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="${260 + index * 230}" cy="${220 + index * 55}" r="190" fill="none" stroke="${light}" stroke-opacity=".45" stroke-width="3"/><path d="M0 ${520-index*40} Q 320 ${360+index*25} 640 ${500-index*30} T1280 ${430+index*20}" fill="none" stroke="${light}" stroke-opacity=".6" stroke-width="5"/><text x="70" y="650" fill="${light}" font-family="system-ui" font-size="38" letter-spacing="12">${labels[index]}</text></svg>`;
  return new TextEncoder().encode(svg);
}

async function assetFromBytes({ id, kind, name, mime, bytes, role }) {
  return { id, kind, name, mime, size: bytes.length, sha256: await sha256Bytes(bytes), dataUrl: bytesToDataUrl(bytes, mime), tags: ["demo"], role };
}

export async function createDemoProject() {
  const audioBytes = demoWav();
  const audio = await assetFromBytes({ id: "audio-demo", kind: "audio", name: "dreamcue-demo.wav", mime: "audio/wav", bytes: audioBytes, role: "soundtrack" });
  const images = [];
  for (let index = 0; index < 5; index += 1) {
    images.push(await assetFromBytes({ id: `image-demo-${index + 1}`, kind: "image", name: `scene-${index + 1}.svg`, mime: "image/svg+xml", bytes: svgBytes(index), role: "scene" }));
  }
  return {
    format: FORMAT,
    container: "json-embedded-draft",
    metadata: { id: "dreamcue-demo", title: "Dreamcue – Night Storm Demo", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
    transport: { audioAssetId: audio.id, volume: 0.78, endMode: "stop" },
    assets: [audio, ...images],
    timeline: { durationSeconds: 18, cues: distributeImageCues(images.slice(0, DEMO_CONFIG.maxImages).map(({ id }) => id), 18), directionRegions: [] },
    generatorJobs: [],
    settings: { background: "#080a10", imageFit: "contain", demo: { maxImages: DEMO_CONFIG.maxImages } }
  };
}
