export const BANK_SIZE = 9;
export const SETTINGS_KEY = "dreamcue.director.settings.v2";

export const HOTKEY_LAYOUTS = {
  numpad: ["Numpad7", "Numpad8", "Numpad9", "Numpad4", "Numpad5", "Numpad6", "Numpad1", "Numpad2", "Numpad3"],
  letters: ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyY", "KeyX", "KeyC"]
};

export function defaultDirectorPreferences(layout = "numpad") {
  return {
    layout,
    slotHotkeys: [...HOTKEY_LAYOUTS[layout]],
    previousBankHotkey: "NumpadAdd",
    nextBankHotkey: "NumpadSubtract",
    visualFeedback: true
  };
}

export function normalizePreferences(value = {}) {
  const layout = value.layout === "letters" ? "letters" : "numpad";
  const fallback = defaultDirectorPreferences(layout);
  const slots = Array.isArray(value.slotHotkeys) ? value.slotHotkeys.slice(0, BANK_SIZE).map(String) : [];
  while (slots.length < BANK_SIZE) slots.push(fallback.slotHotkeys[slots.length]);
  return {
    layout,
    slotHotkeys: slots,
    previousBankHotkey: String(value.previousBankHotkey || fallback.previousBankHotkey),
    nextBankHotkey: String(value.nextBankHotkey || fallback.nextBankHotkey),
    visualFeedback: value.visualFeedback !== false
  };
}

export function hotkeyLabel(code) {
  return String(code || "—")
    .replace(/^Numpad/, "Num ")
    .replace(/^Key/, "")
    .replace("Add", "+")
    .replace("Subtract", "−")
    .replace(/^Digit/, "");
}

export function createDirectorState(imageIds = []) {
  const banks = [];
  for (let offset = 0; offset < imageIds.length || offset === 0; offset += BANK_SIZE) {
    banks.push({ id:`bank-${banks.length + 1}`, name:`Bank ${banks.length + 1}`, assetIds:imageIds.slice(offset, offset + BANK_SIZE) });
  }
  return { activeBankId:banks[0].id, gridMode:"images", banks };
}

export function normalizeDirectorState(value, validImageIds = []) {
  if (!value?.banks?.length) return createDirectorState(validImageIds);
  const valid = new Set(validImageIds);
  const used = new Set();
  const banks = value.banks.map((bank, index) => ({
    id:String(bank.id || `bank-${index + 1}`),
    name:String(bank.name || `Bank ${index + 1}`),
    assetIds:(Array.isArray(bank.assetIds) ? bank.assetIds : []).slice(0, BANK_SIZE).map((id) => {
      const key = String(id || "");
      if (!valid.has(key) || used.has(key)) return null;
      used.add(key); return key;
    }).filter(Boolean)
  }));
  const activeBankId = banks.some((bank) => bank.id === value.activeBankId) ? value.activeBankId : banks[0].id;
  return { activeBankId, gridMode:value.gridMode === "effects" ? "effects" : "images", banks };
}

export function addImagesToBanks(state, assetIds) {
  const copy = structuredClone(state);
  const assigned = new Set(copy.banks.flatMap((bank) => bank.assetIds));
  for (const assetId of assetIds.filter((id) => !assigned.has(id))) {
    let bank = copy.banks.find((item) => item.assetIds.length < BANK_SIZE);
    if (!bank) {
      bank = { id:`bank-${Date.now()}-${copy.banks.length + 1}`, name:`Bank ${copy.banks.length + 1}`, assetIds:[] };
      copy.banks.push(bank);
    }
    bank.assetIds.push(assetId); assigned.add(assetId);
  }
  return copy;
}

export function addBank(state) {
  const copy = structuredClone(state);
  const bank = { id:`bank-${Date.now()}-${copy.banks.length + 1}`, name:`Bank ${copy.banks.length + 1}`, assetIds:[] };
  copy.banks.push(bank); copy.activeBankId = bank.id; return copy;
}

export function removeFromBank(state, bankId, assetId) {
  const copy = structuredClone(state);
  const bank = copy.banks.find((item) => item.id === bankId);
  if (bank) bank.assetIds = bank.assetIds.filter((id) => id !== assetId);
  return copy;
}

export function moveBankAsset(state, sourceBankId, sourceIndex, targetBankId, targetIndex) {
  const copy = structuredClone(state);
  const source = copy.banks.find((bank) => bank.id === sourceBankId);
  const target = copy.banks.find((bank) => bank.id === targetBankId);
  if (!source || !target || sourceIndex < 0 || sourceIndex >= source.assetIds.length || targetIndex < 0 || targetIndex >= BANK_SIZE) return copy;
  const moving = source.assetIds[sourceIndex];
  const targetAsset = target.assetIds[targetIndex];
  source.assetIds.splice(sourceIndex, 1);
  if (source === target) {
    const adjusted = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    source.assetIds.splice(Math.min(adjusted, source.assetIds.length), 0, moving);
  } else {
    if (targetAsset) {
      target.assetIds.splice(targetIndex, 1, moving);
      source.assetIds.splice(Math.min(sourceIndex, source.assetIds.length), 0, targetAsset);
    } else target.assetIds.splice(Math.min(targetIndex, target.assetIds.length), 0, moving);
  }
  return copy;
}

export function adjacentBankId(state, direction) {
  const index = state.banks.findIndex((bank) => bank.id === state.activeBankId);
  const next = (Math.max(0, index) + direction + state.banks.length) % state.banks.length;
  return state.banks[next]?.id || null;
}
