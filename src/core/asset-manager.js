import { LIMITS } from "./limits.js";

const AUDIO_EXT = /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

export function classifyFile(file) {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  if (type.startsWith("audio/") || AUDIO_EXT.test(name)) return "audio";
  if (type.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  return null;
}

export function validateIncomingFiles(files, existingAssets = []) {
  const incoming = [...files].map((file) => ({ file, kind: classifyFile(file) })).filter(({ kind }) => kind);
  let total = existingAssets.reduce((sum, asset) => sum + (Number(asset.size) || 0), 0);
  for (const { file, kind } of incoming) {
    if (kind === "audio" && file.size > LIMITS.maxAudioBytes) throw new Error(`The audio file exceeds the ${formatBytes(LIMITS.maxAudioBytes)} limit.`);
    if (kind === "image" && file.size > LIMITS.maxImageBytes) throw new Error(`${file.name} exceeds the ${formatBytes(LIMITS.maxImageBytes)} image limit.`);
    total += file.size;
  }
  if (total > LIMITS.maxProjectBytes) throw new Error(`Project media exceeds the ${formatBytes(LIMITS.maxProjectBytes)} raw-data limit.`);
  return { incoming, totalBytes: total, warning: total > LIMITS.warningProjectBytes };
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB"];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function bytesToDataUrl(bytes, mime) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunk)));
  }
  return `data:${mime || "application/octet-stream"};base64,${btoa(binary)}`;
}

export async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function readFileBytes(file, { signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal?.addEventListener("abort", abort, { once: true });
    reader.onprogress = (event) => onProgress?.(event.loaded, event.total || file.size);
    reader.onerror = () => reject(reader.error || new Error(`File ${file.name} could not be read. Check that it is accessible and try again.`));
    reader.onabort = () => reject(new DOMException("Import cancelled", "AbortError"));
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onloadend = () => signal?.removeEventListener("abort", abort);
    reader.readAsArrayBuffer(file);
  });
}

export async function fileToEmbeddedAsset(file, kind, options = {}) {
  const bytes = await readFileBytes(file, options);
  const sha256 = await sha256Bytes(bytes);
  const mime = file.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg");
  return {
    id: `${kind}-${sha256.slice(0, 16)}`,
    kind,
    name: file.name,
    mime,
    size: file.size,
    sha256,
    dataUrl: bytesToDataUrl(bytes, mime),
    tags: [],
    role: kind === "audio" ? "soundtrack" : "scene"
  };
}
