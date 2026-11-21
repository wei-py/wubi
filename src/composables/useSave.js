import { defineStore, storeToRefs } from "pinia";
import { ref } from "vue";
import { readScheme } from "../schemes/catalog.js";

const RANK_ORDER = ["S", "A", "B", "C"];

// A scheme switch is applied by reloading the page; each scheme has its own save.
const KEY = `wubi-learning.save.${readScheme()}`;

function higherRank(a, b) {
  if (!a) return b;
  if (!b) return a;
  return RANK_ORDER.indexOf(a) <= RANK_ORDER.indexOf(b) ? a : b;
}

function emptySave() {
  return {
    version: 2,
    exportedAt: 0,
    progress: { levels: {} },
    mistakesByLevel: {},
    stats: {},
    typing: {},
    records: {},
  };
}

function saveData(data) {
  return {
    version: 2,
    exportedAt: data.exportedAt ?? 0,
    progress: { levels: data.progress?.levels ?? {} },
    // 旧错题没有来源关卡，只能单独保留，不能猜测或复制到各关。
    mistakesByLevel: data.mistakesByLevel ?? (
      Object.keys(data.mistakes ?? {}).length ? { legacy: data.mistakes } : {}
    ),
    stats: data.stats ?? {},
    typing: data.typing ?? {},
    records: data.records ?? {},
  };
}

export function loadSaveFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 2) return saveData(data);
  } catch {
    // A damaged save or unavailable browser storage starts a fresh session.
  }
  return emptySave();
}

const useSaveStore = defineStore("learning-save", () => {
  const save = ref(loadSaveFromStorage());
  let timer;

  function flushSave() {
    clearTimeout(timer);
    timer = undefined;
    try {
      localStorage.setItem(KEY, JSON.stringify(save.value));
    } catch {
      // Practice remains available when browser storage cannot be written.
    }
  }

  function touchSave() {
    clearTimeout(timer);
    timer = setTimeout(flushSave, 300);
  }

  // Persist pending results when leaving the page, not only after the debounce.
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushSave);
    window.addEventListener("pagehide", flushSave);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushSave();
      });
    }
  }

  function getLevelResult(id) {
    return save.value.progress.levels[id];
  }

  function isLevelPassed(id) {
    return save.value.progress.levels[id]?.passed ?? false;
  }

  function recordLevelResult(id, speed, accuracy, passed, timeouts, rank) {
    const prev = save.value.progress.levels[id];
    const better = !prev || speed > prev.bestSpeed;
    const bestRank = higherRank(prev?.rank, rank);
    save.value.progress.levels[id] = {
      passed: (prev?.passed ?? false) || passed,
      bestSpeed: better ? speed : prev.bestSpeed,
      bestAccuracy: better ? accuracy : prev.bestAccuracy,
      attempts: (prev?.attempts ?? 0) + 1,
      timeouts: (prev?.timeouts ?? 0) + timeouts,
      at: Date.now(),
      ...(bestRank ? { rank: bestRank } : {}),
    };
    touchSave();
  }

  function getTypingProgress(id) {
    return save.value.typing[id];
  }

  /** Save completed groups immediately; group progress never moves backwards. */
  function recordTypingGroup(id, groupIndex, speed) {
    const prev = save.value.typing[id] ?? { groupIndex: 0, groupBests: [] };
    const prevIndex = Number.isFinite(prev.groupIndex) ? prev.groupIndex : 0;
    const bests = [...(prev.groupBests ?? [])];
    const target = groupIndex - 1;
    if (target >= 0) {
      for (let i = bests.length; i < target; i++) bests[i] = 0;
      bests[target] = Math.max(bests[target] ?? 0, speed);
    }
    save.value.typing[id] = {
      ...prev,
      groupIndex: Math.max(prevIndex, groupIndex),
      groupBests: bests,
    };
    flushSave();
  }

  function reshuffleTyping(id, seed) {
    save.value.typing[id] = { groupIndex: 0, groupBests: [], shuffleSeed: seed };
    flushSave();
  }

  function recordEndlessBest(chars) {
    const records = save.value.records;
    records.endlessBestChars = Math.max(records.endlessBestChars ?? 0, chars);
    touchSave();
  }

  function getEndlessBest() {
    return save.value.records.endlessBestChars ?? 0;
  }

  function ensureCharStat(char) {
    const stat = save.value.stats[char] ?? { attempts: 0, errors: 0, totalMs: 0, lastAt: 0 };
    save.value.stats[char] = stat;
    return stat;
  }

  function getCharStat(char) {
    return save.value.stats[char];
  }

  function recordCharDone(char, ms) {
    const stat = ensureCharStat(char);
    stat.attempts += 1;
    stat.totalMs += Math.max(0, Math.round(ms));
    stat.lastAt = Date.now();
    touchSave();
  }

  function recordCharError(char) {
    const stat = ensureCharStat(char);
    stat.errors += 1;
    stat.lastAt = Date.now();
    touchSave();
  }

  function exportSave() {
    return JSON.stringify({ ...save.value, exportedAt: Date.now() }, null, 2);
  }

  function importSave(text) {
    try {
      const data = JSON.parse(text);
      if (data?.version !== 2) {
        return { ok: false, error: "存档版本不匹配（需要 version: 2）" };
      }
      save.value = saveData(data);
      flushSave();
      return { ok: true };
    } catch {
      return { ok: false, error: "存档解析失败" };
    }
  }

  function resetAll() {
    save.value = emptySave();
    flushSave();
  }

  return {
    save,
    flushSave,
    touchSave,
    getLevelResult,
    isLevelPassed,
    recordLevelResult,
    getTypingProgress,
    recordTypingGroup,
    reshuffleTyping,
    recordEndlessBest,
    getEndlessBest,
    getCharStat,
    recordCharDone,
    recordCharError,
    exportSave,
    importSave,
    resetAll,
  };
});

/** Keep the composable's ref API while all state and actions belong to Pinia. */
export function useSave() {
  const store = useSaveStore();
  const { save } = storeToRefs(store);
  return {
    save,
    getLevelResult: store.getLevelResult,
    isLevelPassed: store.isLevelPassed,
    recordLevelResult: store.recordLevelResult,
    getTypingProgress: store.getTypingProgress,
    recordTypingGroup: store.recordTypingGroup,
    reshuffleTyping: store.reshuffleTyping,
    recordEndlessBest: store.recordEndlessBest,
    getEndlessBest: store.getEndlessBest,
    getCharStat: store.getCharStat,
    recordCharDone: store.recordCharDone,
    recordCharError: store.recordCharError,
    exportSave: store.exportSave,
    importSave: store.importSave,
    resetAll: store.resetAll,
  };
}

export function flushSave() {
  useSaveStore().flushSave();
}

export function touchSave() {
  useSaveStore().touchSave();
}
