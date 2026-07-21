export const EFFECTS = [
  { type:"zoom-in", label:"Zoom in", symbol:"＋" },
  { type:"move-up", label:"Move up", symbol:"↑" },
  { type:"zoom-out", label:"Zoom out", symbol:"−" },
  { type:"move-left", label:"Move left", symbol:"←" },
  { type:"reset", label:"Reset", symbol:"●" },
  { type:"move-right", label:"Move right", symbol:"→" },
  null,
  { type:"move-down", label:"Move down", symbol:"↓" },
  null
];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeEffectCue(cue, index = 0) {
  const type = EFFECTS.find((effect) => effect?.type === cue?.effect?.type)?.type || "reset";
  return { id:String(cue?.id || `effect-${index + 1}`), at:Math.max(0, finite(cue?.at)), effect:{ type }, source:cue?.source === "ai" ? "ai" : "human" };
}

export function sortEffectCues(cues = []) {
  return cues.map(normalizeEffectCue).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function effectStateAt(cues, seconds) {
  const state = { scale:1, x:0, y:0 };
  for (const cue of sortEffectCues(cues)) {
    if (cue.at > Math.max(0, finite(seconds))) break;
    switch (cue.effect.type) {
      case "zoom-in": state.scale = Math.min(2.5, state.scale + 0.15); break;
      case "zoom-out": state.scale = Math.max(0.5, state.scale - 0.15); break;
      case "move-left": state.x = Math.max(-40, state.x - 8); break;
      case "move-right": state.x = Math.min(40, state.x + 8); break;
      case "move-up": state.y = Math.max(-40, state.y - 8); break;
      case "move-down": state.y = Math.min(40, state.y + 8); break;
      case "reset": Object.assign(state, { scale:1, x:0, y:0 }); break;
    }
  }
  return state;
}
