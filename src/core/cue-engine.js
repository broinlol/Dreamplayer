const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizeCue(cue, index = 0) {
  return {
    id: String(cue.id || `cue-${index + 1}`),
    at: Math.max(0, finite(cue.at)),
    duration: clamp(finite(cue.duration, 4), 0.1, 24 * 60 * 60),
    assetId: String(cue.assetId || ""),
    source: cue.source === "ai" ? "ai" : "human",
    enabled: cue.enabled !== false,
    group: String(cue.group || "main"),
    transition: { fadeMs: clamp(finite(cue.transition?.fadeMs, 700), 0, 5000) },
    transform: {
      scale: clamp(finite(cue.transform?.scale, 1), 0.5, 3),
      panX: clamp(finite(cue.transform?.panX), -100, 100),
      panY: clamp(finite(cue.transform?.panY), -100, 100),
      rotation: clamp(finite(cue.transform?.rotation), -180, 180)
    }
  };
}

export function sortCues(cues) {
  return cues.map(normalizeCue).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function activeCueAt(cues, seconds) {
  const time = Math.max(0, finite(seconds));
  let active = null;
  for (const cue of sortCues(cues)) {
    if (cue.at > time) break;
    if (cue.enabled && time < cue.at + cue.duration) active = cue;
  }
  return active;
}

export function nextCueAfter(cues, seconds) {
  const time = Math.max(0, finite(seconds));
  return sortCues(cues).find((cue) => cue.enabled && cue.at > time) ?? null;
}

export function distributeImageCues(assetIds, durationSeconds) {
  const ids = assetIds.filter(Boolean);
  const duration = Math.max(ids.length * 2, finite(durationSeconds, ids.length * 4));
  const transforms = [
    { scale: 1.04, panX: 0, panY: 0 },
    { scale: 1.16, panX: -5, panY: 2 },
    { scale: 1.1, panX: 5, panY: -3 },
    { scale: 1.22, panX: -3, panY: -4 },
    { scale: 1.08, panX: 3, panY: 3 }
  ];
  return ids.map((assetId, index) => normalizeCue({
    id: `cue-${index + 1}`,
    at: index * duration / ids.length,
    duration: duration / ids.length,
    assetId,
    group: "main",
    enabled: true,
    transition: { fadeMs: index === 0 ? 0 : 900 },
    transform: transforms[index % transforms.length]
  }, index));
}

export function cueTimelineFraction(cue, durationSeconds) {
  const duration = Math.max(0.001, finite(durationSeconds, 1));
  return clamp(cue.at / duration, 0, 1);
}

export function cueDurationFraction(cue, durationSeconds) {
  const duration = Math.max(0.001, finite(durationSeconds, 1));
  return clamp(cue.duration / duration, 0, 1);
}
