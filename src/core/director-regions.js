const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizeDirectionRegion(region, index = 0) {
  return {
    id: String(region.id || `region-${index + 1}`),
    start: Math.max(0, finite(region.start)),
    duration: clamp(finite(region.duration, 8), 0.25, 24 * 60 * 60),
    label: String(region.label || `Direction region ${index + 1}`),
    status: ["open", "planned", "applied"].includes(region.status) ? region.status : "open",
    allowedModes: [...new Set(Array.isArray(region.allowedModes) ? region.allowedModes : ["automatic", "cooperative"])]
      .filter((mode) => ["automatic", "cooperative"].includes(mode)),
    brief: String(region.brief || "")
  };
}

export function sortDirectionRegions(regions = []) {
  return regions.map(normalizeDirectionRegion).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function createDirectionRegion(start, timelineDuration, index = 0) {
  const safeStart = Math.max(0, finite(start));
  const remaining = Math.max(0.25, finite(timelineDuration, safeStart + 8) - safeStart);
  return normalizeDirectionRegion({ start:safeStart, duration:Math.min(8, remaining) }, index);
}
