import { AudioSynchronizer } from "./audio-sync.js";
import { classifyFile, fileToEmbeddedAsset, validateIncomingFiles } from "./core/asset-manager.js";
import { createHeuristicSuggestions } from "./core/ai-assist.js";
import { normalizeCue, sortCues } from "./core/cue-engine.js";
import { createDemoProject } from "./core/demo-project.js";
import {
  HOTKEY_LAYOUTS, SETTINGS_KEY, addBank, addImagesToBanks, adjacentBankId, createDirectorState,
  defaultDirectorPreferences, hotkeyLabel, moveBankAsset, normalizeDirectorState, normalizePreferences, removeFromBank
} from "./core/director-model.js";
import { EFFECTS, effectStateAt, normalizeEffectCue, sortEffectCues } from "./core/effects.js";
import { cueAtTime, formatTime } from "./core/player-logic.js";
import { createEmptyProject, parseProject, serializeProject, validateProject } from "./core/project-serializer.js";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  "audio", "message", "mode-player", "mode-director", "new-project", "load-demo", "open-project", "save-project", "settings-open", "settings-open-inline",
  "project-input", "audio-input", "image-input", "stage", "stage-empty", "preview-image", "cue-label", "play", "restart", "seek", "current-time", "total-time", "volume",
  "player-title", "player-audio", "player-images", "player-cues", "player-cue-list", "edit-project", "project-title", "choose-audio", "choose-images", "audio-name",
  "image-count", "add-cue", "cue-list", "effect-cue-list", "test-project", "grid-images", "grid-effects", "bank-previous", "bank-next", "bank-name", "bank-tabs", "hotkey-grid", "add-bank", "unassigned-list",
  "ai-mood", "ai-generate", "ai-accept-all", "ai-reject-all", "ai-suggestions", "settings-dialog", "hotkey-layout", "hotkey-settings-grid", "bind-bank-previous", "bind-bank-next",
  "visual-feedback", "reset-settings", "binding-help"
].map((id) => [id.replaceAll("-", "_"), $(id)]));

let project = createEmptyProject();
let mode = "player";
let selectedImageId = null;
let displayedCueId = null;
let preferences = loadPreferences();
let suggestions = [];
let bindingTarget = null;
let dragSource = null;

const images = () => project.assets.filter((asset) => asset.kind === "image");
const imageIds = () => images().map((asset) => asset.id);
const audioAsset = () => project.assets.find((asset) => asset.id === project.transport.audioAssetId) || null;
const assetById = (id) => project.assets.find((asset) => asset.id === id) || null;
const duration = () => Number.isFinite(ui.audio.duration) ? ui.audio.duration : Number(project.timeline.durationSeconds) || 0;
const director = () => project.settings.director;
const activeBank = () => director().banks.find((bank) => bank.id === director().activeBankId) || director().banks[0];

function loadPreferences() {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
  catch { return defaultDirectorPreferences(); }
}

function savePreferences() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences)); }
  catch { setMessage("Hotkey settings could not be saved in this browser. Check private-browsing or storage restrictions.", "error"); }
}

function ensureProjectExtensions() {
  project.timeline.effectCues ||= [];
  project.settings ||= {};
  project.settings.director = normalizeDirectorState(project.settings.director, imageIds());
}

function setMessage(text, kind = "") {
  ui.message.textContent = text;
  ui.message.className = `message ${kind}`.trim();
  ui.message.setAttribute("role", kind === "error" ? "alert" : "status");
}

function safeFilename(value) {
  return String(value || "dreamcue-project").trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "dreamcue-project";
}

function markChanged() { project.metadata.updatedAt = new Date().toISOString(); }

function setMode(nextMode) {
  mode = nextMode;
  ui.mode_player.classList.toggle("active", mode === "player");
  ui.mode_director.classList.toggle("active", mode === "director");
  document.querySelectorAll("[data-mode]").forEach((element) => { element.hidden = element.dataset.mode !== mode; });
  render();
}

function showCueAt(time) {
  const cue = cueAtTime(project.timeline.cues, time);
  const asset = cue && assetById(cue.assetId);
  const effect = effectStateAt(project.timeline.effectCues || [], time);
  ui.preview_image.style.transform = `translate(${effect.x}%, ${effect.y}%) scale(${effect.scale})`;
  if (!cue || !asset) {
    displayedCueId = null; ui.preview_image.removeAttribute("src"); ui.stage_empty.hidden = false; ui.cue_label.textContent = "No cue"; return;
  }
  if (displayedCueId !== cue.id) {
    ui.preview_image.src = asset.dataUrl; ui.preview_image.alt = "Current cue visual"; ui.preview_image.title = asset.name; displayedCueId = cue.id;
  }
  ui.stage_empty.hidden = true;
  ui.cue_label.textContent = `${formatTime(cue.at)} · ${cue.source === "ai" ? "AI Assist" : "Live"}`;
  ui.cue_label.title = asset.name;
}

const sync = new AudioSynchronizer(ui.audio, {
  onTime(time, audioDuration) {
    const total = audioDuration || duration();
    ui.seek.max = String(total); ui.seek.value = String(Math.min(time, total || time));
    ui.current_time.textContent = formatTime(time); ui.total_time.textContent = formatTime(total); showCueAt(time);
  },
  onState(state) { ui.play.textContent = state === "playing" ? "❚❚" : "▶"; },
  onError(message) { setMessage(message, "error"); }
});

function loadAudio() {
  const asset = audioAsset(); displayedCueId = null;
  sync.load(asset?.dataUrl || "", project.transport.volume ?? 0.85); ui.volume.value = String(project.transport.volume ?? 0.85);
}

function nextCueId(prefix = "cue") {
  let index = 1; while ([...project.timeline.cues, ...(project.timeline.effectCues || [])].some((cue) => cue.id === `${prefix}-${index}`)) index += 1; return `${prefix}-${index}`;
}

function addImageCue(assetId = selectedImageId, at = ui.audio.currentTime || 0, source = "human") {
  const image = assetById(assetId) || images()[0];
  if (!image || image.kind !== "image") { setMessage("Choose or import at least one image before creating a cue.", "error"); return null; }
  const cue = normalizeCue({ id:nextCueId(), at, duration:4, assetId:image.id, source, transition:{ fadeMs:0 }, transform:{ scale:1 } });
  project.timeline.cues.push(cue); project.timeline.cues = sortCues(project.timeline.cues); selectedImageId = image.id; markChanged();
  renderCueEditor(); renderPlayerSummary(); showCueAt(ui.audio.currentTime);
  if (source === "human") setMessage(`Live image cue added at ${formatTime(cue.at)}. Playback continues.`, "ok");
  return cue;
}

function addEffectCue(type, at = ui.audio.currentTime || 0) {
  const effect = EFFECTS.find((item) => item?.type === type);
  if (!effect) return;
  const cue = normalizeEffectCue({ id:nextCueId("effect"), at, effect:{ type }, source:"human" });
  project.timeline.effectCues.push(cue); project.timeline.effectCues = sortEffectCues(project.timeline.effectCues); markChanged();
  renderEffectCues(); renderPlayerSummary(); showCueAt(ui.audio.currentTime);
  setMessage(`${effect.label} added at ${formatTime(cue.at)}. Playback continues.`, "ok");
}

function flashGridCell(index) {
  if (!preferences.visualFeedback) return;
  const cells = ui.hotkey_grid.querySelectorAll(".hotkey-cell");
  const cell = cells[index]; if (!cell) return;
  cell.classList.add("fired"); setTimeout(() => cell.classList.remove("fired"), 160);
}

function triggerGridSlot(index) {
  if (director().gridMode === "effects") {
    if (!EFFECTS[index]) return; addEffectCue(EFFECTS[index].type);
  } else {
    const assetId = activeBank()?.assetIds[index]; if (!assetId) return;
    addImageCue(assetId); selectedImageId = assetId;
  }
  flashGridCell(index); renderHotkeyGrid();
}

function setActiveBank(bankId) {
  if (!director().banks.some((bank) => bank.id === bankId)) return;
  director().activeBankId = bankId; markChanged(); renderBanks(); renderHotkeyGrid(); renderUnassigned();
}

function changeBank(direction) {
  const next = adjacentBankId(director(), direction); if (next) setActiveBank(next);
}

function addAssetToActiveBank(assetId) {
  const assigned = new Set(director().banks.flatMap((bank) => bank.assetIds));
  if (assigned.has(assetId)) return;
  let bank = activeBank();
  if (bank.assetIds.length >= 9) {
    project.settings.director = addBank(director()); bank = activeBank();
  }
  bank.assetIds.push(assetId); selectedImageId = assetId; markChanged(); renderDirector();
}

function renderBanks() {
  ui.bank_tabs.replaceChildren();
  const bank = activeBank(); ui.bank_name.textContent = bank?.name || "No bank"; ui.bank_name.title = bank?.name || "";
  const effects = director().gridMode === "effects";
  ui.bank_previous.disabled = effects; ui.bank_next.disabled = effects;
  for (const item of director().banks) {
    const button = document.createElement("button"); button.className = `bank-tab${item.id === bank?.id ? " active" : ""}`; button.textContent = item.name; button.title = `${item.name} · ${item.assetIds.length}/9 images`;
    button.addEventListener("click", () => setActiveBank(item.id));
    button.addEventListener("dragover", (event) => { event.preventDefault(); button.classList.add("drag-target"); });
    button.addEventListener("dragleave", () => button.classList.remove("drag-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault(); button.classList.remove("drag-target");
      if (!dragSource || item.assetIds.length >= 9) return;
      project.settings.director = moveBankAsset(director(), dragSource.bankId, dragSource.index, item.id, item.assetIds.length);
      markChanged(); renderDirector();
    });
    ui.bank_tabs.append(button);
  }
}

function renderHotkeyGrid() {
  ui.hotkey_grid.replaceChildren();
  const effectsMode = director().gridMode === "effects";
  ui.grid_images.classList.toggle("active", !effectsMode); ui.grid_effects.classList.toggle("active", effectsMode);
  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement("div"); cell.className = "hotkey-cell"; cell.tabIndex = 0; cell.setAttribute("role", "button");
    const key = document.createElement("span"); key.className = "key-label"; key.textContent = hotkeyLabel(preferences.slotHotkeys[index]);
    if (effectsMode) {
      const effect = EFFECTS[index]; cell.classList.add("effect-cell");
      if (effect) {
        const symbol = document.createElement("span"); symbol.className = "effect-symbol"; symbol.textContent = effect.symbol;
        const name = document.createElement("span"); name.className = "effect-name"; name.textContent = effect.label;
        cell.title = `${effect.label} · ${hotkeyLabel(preferences.slotHotkeys[index])}`; cell.append(symbol, name, key);
      } else { cell.classList.add("empty"); cell.removeAttribute("role"); cell.tabIndex = -1; cell.append(key); }
    } else {
      const assetId = activeBank()?.assetIds[index]; const asset = assetById(assetId);
      if (asset) {
        const image = document.createElement("img"); image.src = asset.dataUrl; image.alt = "";
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-slot"; remove.textContent = "×"; remove.title = `Remove ${asset.name} from this bank`;
        remove.addEventListener("click", (event) => { event.stopPropagation(); project.settings.director = removeFromBank(director(), activeBank().id, asset.id); markChanged(); renderDirector(); setMessage("Image removed from this bank. The original asset and existing cues were preserved.", "ok"); });
        cell.title = `${asset.name}\n${asset.mime} · ${asset.size} bytes`; cell.draggable = true;
        cell.addEventListener("dragstart", (event) => { dragSource = { bankId:activeBank().id, index }; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", asset.id); });
        cell.append(image, key, remove);
      } else { cell.classList.add("empty"); cell.title = "Empty image slot"; cell.append(key); }
      cell.addEventListener("dragover", (event) => event.preventDefault());
      cell.addEventListener("drop", (event) => { event.preventDefault(); if (!dragSource) return; project.settings.director = moveBankAsset(director(), dragSource.bankId, dragSource.index, activeBank().id, index); markChanged(); renderDirector(); });
    }
    cell.addEventListener("click", () => triggerGridSlot(index));
    cell.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); triggerGridSlot(index); } });
    ui.hotkey_grid.append(cell);
  }
}

function renderUnassigned() {
  ui.unassigned_list.replaceChildren(); ui.image_count.textContent = String(images().length);
  const assigned = new Set(director().banks.flatMap((bank) => bank.assetIds));
  const free = images().filter((asset) => !assigned.has(asset.id));
  if (!free.length) {
    const note = document.createElement("p"); note.className = "hint"; note.textContent = "All images are assigned to a bank."; ui.unassigned_list.append(note); return;
  }
  for (const asset of free) {
    const button = document.createElement("button"); button.className = "pool-item"; button.title = `${asset.name}\n${asset.mime} · ${asset.size} bytes`;
    const image = document.createElement("img"); image.src = asset.dataUrl; image.alt = "";
    const mark = document.createElement("span"); mark.className = "add-mark"; mark.textContent = "+";
    button.append(image, mark); button.addEventListener("click", () => addAssetToActiveBank(asset.id)); ui.unassigned_list.append(button);
  }
}

function renderDirector() { renderBanks(); renderHotkeyGrid(); renderUnassigned(); }

function cueThumbnailButton(cue) {
  const asset = assetById(cue.assetId);
  const button = document.createElement("button"); button.className = "cue-seek-thumb"; button.title = `${asset?.name || "Missing image"} · seek to ${formatTime(cue.at)}`;
  if (asset) { const image = document.createElement("img"); image.src = asset.dataUrl; image.alt = ""; button.append(image); }
  button.addEventListener("click", () => sync.seek(cue.at)); return button;
}

function renderCueEditor() {
  ui.cue_list.replaceChildren();
  const sorted = sortCues(project.timeline.cues);
  if (!sorted.length) { const empty = document.createElement("p"); empty.className = "hint"; empty.textContent = "No image cues yet. Play the track and trigger an image from the live pad."; ui.cue_list.append(empty); return; }
  for (const cue of sorted) {
    const row = document.createElement("div"); row.className = "cue-row";
    const thumb = cueThumbnailButton(cue);
    const time = document.createElement("button"); time.className = "cue-time"; time.textContent = formatTime(cue.at); time.title = `Seek to ${cue.at.toFixed(2)} seconds`; time.addEventListener("click", () => sync.seek(cue.at));
    const edit = document.createElement("div"); edit.className = "cue-edit";
    const exact = document.createElement("input"); exact.type = "number"; exact.min = "0"; exact.step = "0.01"; exact.value = String(cue.at); exact.title = "Edit cue time in seconds"; exact.setAttribute("aria-label", "Edit cue time in seconds");
    const replace = document.createElement("button"); replace.textContent = "Use selected image"; replace.title = `Current image: ${assetById(cue.assetId)?.name || "Missing"}`;
    exact.addEventListener("change", () => { cue.at = Math.max(0, Number(exact.value) || 0); project.timeline.cues = sortCues(project.timeline.cues); markChanged(); renderCueEditor(); renderPlayerSummary(); showCueAt(ui.audio.currentTime); });
    replace.addEventListener("click", () => { const selected = assetById(selectedImageId); if (!selected) return; cue.assetId = selected.id; cue.source = "human"; markChanged(); renderCueEditor(); showCueAt(ui.audio.currentTime); });
    edit.append(exact, replace);
    const remove = document.createElement("button"); remove.className = "delete"; remove.textContent = "Delete"; remove.addEventListener("click", () => { project.timeline.cues = project.timeline.cues.filter((item) => item.id !== cue.id); markChanged(); renderCueEditor(); renderPlayerSummary(); showCueAt(ui.audio.currentTime); });
    row.append(thumb, time, edit, remove); ui.cue_list.append(row);
  }
}

function renderEffectCues() {
  ui.effect_cue_list.replaceChildren();
  const cues = sortEffectCues(project.timeline.effectCues || []);
  if (!cues.length) { const empty = document.createElement("p"); empty.className = "hint"; empty.textContent = "No effect cues yet. Switch the live pad to Effects to add one."; ui.effect_cue_list.append(empty); return; }
  for (const cue of cues) {
    const effect = EFFECTS.find((item) => item?.type === cue.effect.type);
    const row = document.createElement("div"); row.className = "effect-row";
    const time = document.createElement("button"); time.textContent = formatTime(cue.at); time.title = `Seek to ${cue.at.toFixed(2)} seconds`; time.addEventListener("click", () => sync.seek(cue.at));
    const label = document.createElement("span"); label.className = "effect-badge"; label.textContent = `${effect?.symbol || ""} ${effect?.label || cue.effect.type}`;
    const remove = document.createElement("button"); remove.className = "delete"; remove.textContent = "Delete"; remove.addEventListener("click", () => { project.timeline.effectCues = project.timeline.effectCues.filter((item) => item.id !== cue.id); markChanged(); renderEffectCues(); renderPlayerSummary(); showCueAt(ui.audio.currentTime); });
    row.append(time, label, remove); ui.effect_cue_list.append(row);
  }
}

function renderPlayerSummary() {
  const audio = audioAsset(); ui.player_title.textContent = project.metadata.title; ui.player_title.title = project.metadata.title;
  ui.player_audio.textContent = audio?.name || "Missing"; ui.player_audio.title = audio?.name || "No audio file";
  ui.player_images.textContent = String(images().length); ui.player_cues.textContent = `${project.timeline.cues.length} / ${(project.timeline.effectCues || []).length}`;
  ui.player_cue_list.replaceChildren();
  for (const cue of sortCues(project.timeline.cues)) {
    const item = document.createElement("li"); const asset = assetById(cue.assetId);
    const thumb = cueThumbnailButton(cue); const time = document.createElement("button"); time.className = "cue-time"; time.textContent = formatTime(cue.at); time.addEventListener("click", () => sync.seek(cue.at)); time.title = asset?.name || "Missing image";
    item.append(thumb, time); ui.player_cue_list.append(item);
  }
}

function renderSuggestions() {
  ui.ai_suggestions.replaceChildren();
  if (!suggestions.length) { const note = document.createElement("p"); note.className = "hint"; note.textContent = "No suggestions yet. Add images, then generate a local heuristic sequence."; ui.ai_suggestions.append(note); return; }
  for (const suggestion of suggestions) {
    const asset = assetById(suggestion.assetId); const row = document.createElement("div"); row.className = `suggestion-row${suggestion.status === "rejected" ? " rejected" : ""}`;
    const image = document.createElement("img"); image.src = asset?.dataUrl || ""; image.alt = ""; image.title = asset?.name || "Missing image";
    const time = document.createElement("input"); time.type = "number"; time.min = "0"; time.step = "0.01"; time.value = String(suggestion.at); time.title = "Edit suggested time"; time.setAttribute("aria-label", "Edit suggested time");
    const select = document.createElement("select"); select.title = "Choose a different suggested image"; select.setAttribute("aria-label", "Choose suggested image");
    for (const candidate of images()) { const option = new Option(candidate.name, candidate.id); option.selected = candidate.id === suggestion.assetId; option.title = candidate.name; select.append(option); }
    time.addEventListener("input", () => { suggestion.at = Math.max(0, Number(time.value) || 0); }); select.addEventListener("change", () => { suggestion.assetId = select.value; renderSuggestions(); });
    const actions = document.createElement("div"); actions.className = "suggestion-actions";
    const accept = document.createElement("button"); accept.textContent = "✓"; accept.title = "Accept suggestion"; accept.setAttribute("aria-label", "Accept suggestion"); accept.disabled = suggestion.status === "accepted";
    const reject = document.createElement("button"); reject.textContent = "×"; reject.title = "Reject suggestion"; reject.setAttribute("aria-label", "Reject suggestion");
    accept.addEventListener("click", () => acceptSuggestion(suggestion)); reject.addEventListener("click", () => { suggestion.status = "rejected"; renderSuggestions(); });
    actions.append(accept, reject); row.append(image, time, select, actions); ui.ai_suggestions.append(row);
  }
}

function acceptSuggestion(suggestion) {
  if (suggestion.status === "accepted" || suggestion.status === "rejected") return;
  addImageCue(suggestion.assetId, suggestion.at, "ai"); suggestion.status = "accepted"; renderSuggestions(); setMessage("AI Assist suggestion accepted. Human live cues keep priority.", "ok");
}

function renderSettings() {
  ui.hotkey_layout.value = preferences.layout; ui.visual_feedback.checked = preferences.visualFeedback;
  ui.hotkey_settings_grid.replaceChildren();
  preferences.slotHotkeys.forEach((code, index) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `key-bind${bindingTarget?.type === "slot" && bindingTarget.index === index ? " binding" : ""}`; button.textContent = `${index + 1}: ${hotkeyLabel(code)}`;
    button.addEventListener("click", () => { bindingTarget = { type:"slot", index }; renderSettings(); }); ui.hotkey_settings_grid.append(button);
  });
  ui.bind_bank_previous.textContent = hotkeyLabel(preferences.previousBankHotkey); ui.bind_bank_next.textContent = hotkeyLabel(preferences.nextBankHotkey);
  ui.bind_bank_previous.classList.toggle("binding", bindingTarget?.type === "previous"); ui.bind_bank_next.classList.toggle("binding", bindingTarget?.type === "next");
  ui.binding_help.textContent = bindingTarget ? "Press the new key now. Press Escape to cancel." : "Select a binding, then press the key you want to use.";
}

function render() {
  ensureProjectExtensions(); ui.project_title.value = project.metadata.title;
  const audio = audioAsset(); ui.audio_name.textContent = audio?.name || "No audio file"; ui.audio_name.title = audio?.name || "No audio file";
  renderDirector(); renderCueEditor(); renderEffectCues(); renderPlayerSummary(); renderSuggestions(); renderSettings(); showCueAt(ui.audio.currentTime || 0);
}

async function openProject(nextProject, message) {
  validateProject(nextProject); project = nextProject; ensureProjectExtensions(); selectedImageId = images()[0]?.id || null; displayedCueId = null; suggestions = [];
  loadAudio(); render(); setMessage(message, "ok");
}

async function importFiles(fileList, expectedKind) {
  const files = [...fileList].filter((file) => classifyFile(file) === expectedKind);
  if (!files.length) throw new Error(expectedKind === "audio" ? "Choose a supported audio file (MP3, WAV, OGG, FLAC, or M4A)." : "Choose one or more supported images (PNG, JPEG, WebP, GIF, or SVG).");
  const base = expectedKind === "audio" ? project.assets.filter((asset) => asset.kind !== "audio") : project.assets;
  validateIncomingFiles(files, base); const imported = [];
  for (const file of files) imported.push(await fileToEmbeddedAsset(file, expectedKind));
  if (expectedKind === "audio") { project.assets = [...base, imported[0]]; project.transport.audioAssetId = imported[0].id; loadAudio(); }
  else {
    const map = new Map(project.assets.map((asset) => [asset.id, asset])); imported.forEach((asset) => map.set(asset.id, asset)); project.assets = [...map.values()];
    project.settings.director = addImagesToBanks(director(), imported.map((asset) => asset.id)); selectedImageId ||= imported[0]?.id;
  }
  markChanged(); render(); setMessage(`${imported.length} ${expectedKind === "audio" ? "audio file" : imported.length === 1 ? "image" : "images"} imported.`, "ok");
}

function openSettings() { bindingTarget = null; renderSettings(); ui.settings_dialog.showModal(); }

function handleGlobalKeydown(event) {
  if (bindingTarget) {
    event.preventDefault();
    if (event.code === "Escape") bindingTarget = null;
    else if (bindingTarget.type === "slot") preferences.slotHotkeys[bindingTarget.index] = event.code;
    else if (bindingTarget.type === "previous") preferences.previousBankHotkey = event.code;
    else preferences.nextBankHotkey = event.code;
    bindingTarget = null; savePreferences(); renderSettings(); renderHotkeyGrid(); return;
  }
  if (mode !== "director" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
  const slot = preferences.slotHotkeys.indexOf(event.code);
  if (slot >= 0) { event.preventDefault(); triggerGridSlot(slot); return; }
  if (event.code === preferences.previousBankHotkey) { event.preventDefault(); changeBank(-1); }
  else if (event.code === preferences.nextBankHotkey) { event.preventDefault(); changeBank(1); }
}

ui.mode_player.addEventListener("click", () => setMode("player")); ui.mode_director.addEventListener("click", () => setMode("director"));
ui.edit_project.addEventListener("click", () => setMode("director")); ui.test_project.addEventListener("click", () => setMode("player"));
ui.new_project.addEventListener("click", () => openProject(createEmptyProject(), "New project created.")); ui.load_demo.addEventListener("click", async () => openProject(await createDemoProject(), "Demo loaded. Press Play, then open Tiny Director and trigger the live pad."));
ui.open_project.addEventListener("click", () => ui.project_input.click());
ui.project_input.addEventListener("change", async () => { try { const file = ui.project_input.files[0]; if (file) await openProject(parseProject(await file.text()), `${file.name} opened.`); } catch (error) { setMessage(`${error.message} Choose a valid .dreamcue file and try again.`, "error"); } finally { ui.project_input.value = ""; } });
ui.save_project.addEventListener("click", () => { try { const url = URL.createObjectURL(new Blob([serializeProject(project)], { type:"application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${safeFilename(project.metadata.title)}.dreamcue`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Dreamcue project saved to your Downloads folder.", "ok"); } catch (error) { setMessage(error.message, "error"); } });
ui.choose_audio.addEventListener("click", () => ui.audio_input.click()); ui.choose_images.addEventListener("click", () => ui.image_input.click());
ui.audio_input.addEventListener("change", async () => { try { await importFiles(ui.audio_input.files, "audio"); } catch (error) { setMessage(error.message, "error"); } finally { ui.audio_input.value = ""; } });
ui.image_input.addEventListener("change", async () => { try { await importFiles(ui.image_input.files, "image"); } catch (error) { setMessage(error.message, "error"); } finally { ui.image_input.value = ""; } });
ui.project_title.addEventListener("input", () => { project.metadata.title = ui.project_title.value; markChanged(); renderPlayerSummary(); }); ui.add_cue.addEventListener("click", () => addImageCue());
ui.play.addEventListener("click", async () => { try { await sync.toggle(); } catch (error) { setMessage(error.message, "error"); } }); ui.restart.addEventListener("click", () => { sync.restart(); setMessage("Playback stopped at the beginning.", "ok"); });
ui.seek.addEventListener("input", () => sync.seek(Number(ui.seek.value))); ui.volume.addEventListener("input", () => { ui.audio.volume = Number(ui.volume.value); project.transport.volume = ui.audio.volume; markChanged(); });
ui.grid_images.addEventListener("click", () => { director().gridMode = "images"; markChanged(); renderDirector(); }); ui.grid_effects.addEventListener("click", () => { director().gridMode = "effects"; markChanged(); renderDirector(); });
ui.bank_previous.addEventListener("click", () => changeBank(-1)); ui.bank_next.addEventListener("click", () => changeBank(1)); ui.add_bank.addEventListener("click", () => { project.settings.director = addBank(director()); markChanged(); renderDirector(); });
ui.ai_generate.addEventListener("click", () => { suggestions = createHeuristicSuggestions(imageIds(), duration(), ui.ai_mood.value); renderSuggestions(); setMessage(suggestions.length ? "Local heuristic suggestions generated. Nothing has been applied yet." : "Import images before generating suggestions.", suggestions.length ? "ok" : "error"); });
ui.ai_accept_all.addEventListener("click", () => { suggestions.filter((item) => item.status === "pending").forEach(acceptSuggestion); renderSuggestions(); }); ui.ai_reject_all.addEventListener("click", () => { suggestions.forEach((item) => { if (item.status === "pending") item.status = "rejected"; }); renderSuggestions(); });
ui.settings_open.addEventListener("click", openSettings); ui.settings_open_inline.addEventListener("click", openSettings);
ui.hotkey_layout.addEventListener("change", () => { preferences.layout = ui.hotkey_layout.value; preferences.slotHotkeys = [...HOTKEY_LAYOUTS[preferences.layout]]; savePreferences(); renderSettings(); renderHotkeyGrid(); });
ui.bind_bank_previous.addEventListener("click", () => { bindingTarget = { type:"previous" }; renderSettings(); }); ui.bind_bank_next.addEventListener("click", () => { bindingTarget = { type:"next" }; renderSettings(); });
ui.visual_feedback.addEventListener("change", () => { preferences.visualFeedback = ui.visual_feedback.checked; savePreferences(); }); ui.reset_settings.addEventListener("click", () => { preferences = defaultDirectorPreferences(); bindingTarget = null; savePreferences(); renderSettings(); renderHotkeyGrid(); });
ui.settings_dialog.addEventListener("close", () => { bindingTarget = null; renderSettings(); }); window.addEventListener("keydown", handleGlobalKeydown);

ensureProjectExtensions(); loadAudio(); render();
