import { computed, toValue } from "vue";

import { flushSave, useSave } from "./useSave.js";

/** 每关独立的错题本；所有变更立即保存。 */
export function useMistakes(levelId) {
  const { save } = useSave();
  const book = computed(() => save.value.mistakesByLevel[toValue(levelId)] ?? {});

  function createEntry(code) {
    return { code, count: 0, lastWrongInputs: [], lastAt: Date.now(), mastered: false };
  }

  function put(char, entry) {
    const id = toValue(levelId);
    save.value.mistakesByLevel[id] ??= {};
    save.value.mistakesByLevel[id][char] = entry;
    flushSave();
  }

  /** 主动收藏不虚增错误次数；重复添加只恢复待复习状态。 */
  function add(char, code) {
    const entry = book.value[char];
    if (entry && !entry.mastered) return false;
    put(char, entry ? { ...entry, mastered: false } : createEntry(code));
    return true;
  }

  function record(char, code, actual) {
    const entry = book.value[char] ?? createEntry(code);
    entry.code = code;
    entry.count += 1;
    entry.lastWrongInputs = [actual, ...entry.lastWrongInputs].slice(0, 5);
    entry.lastAt = Date.now();
    entry.mastered = false;
    put(char, entry);
  }

  function markMastered(char) {
    const entry = book.value[char];
    if (entry && !entry.mastered) {
      entry.mastered = true;
      flushSave();
    }
  }

  function pending() {
    return Object.entries(book.value).filter(([, entry]) => !entry.mastered);
  }

  function clear(char) {
    if (book.value[char]) {
      delete book.value[char];
      flushSave();
    }
  }

  function reset() {
    delete save.value.mistakesByLevel[toValue(levelId)];
    flushSave();
  }

  return { book, add, record, markMastered, pending, clear, reset };
}
