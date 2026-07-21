import { sortCues } from "./cue-engine.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// A cue is a switch point: the latest enabled cue remains visible until the next one.
// Legacy duration fields stay untouched for round-trip compatibility.
export function cueAtTime(cues, seconds) {
  const time = Math.max(0, finite(seconds));
  let current = null;
  for (const cue of sortCues(cues)) {
    if (cue.at > time) break;
    if (cue.enabled && (!current || cue.at > current.at || current.source === "ai" || cue.source !== "ai")) current = cue;
  }
  return current;
}

export function clampSeek(seconds, durationSeconds) {
  return Math.min(Math.max(0, finite(durationSeconds)), Math.max(0, finite(seconds)));
}

export function formatTime(seconds) {
  const safe = Math.max(0, finite(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
