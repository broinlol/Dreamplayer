export function createHeuristicSuggestions(imageIds, durationSeconds, mood = "") {
  const ids = [...imageIds];
  const words = String(mood).toLocaleLowerCase("de");
  if (/calm|soft|dream|night|ruhig|sanft|nacht/.test(words)) ids.sort();
  if (/wild|fast|energy|chaos|schnell|energie/.test(words)) ids.reverse();
  const duration = Math.max(ids.length * 2, Number(durationSeconds) || ids.length * 4);
  return ids.map((assetId, index) => ({
    id:`suggestion-${Date.now()}-${index + 1}`,
    at:Number((index * duration / Math.max(1, ids.length)).toFixed(2)),
    assetId,
    status:"pending"
  }));
}
