import { computed } from "vue";

import { flushSave, touchSave, useSave } from "./useSave.js";

/** 错题本：记录、查询、标记掌握（数据存于统一存档 mistakes 字段） */
export function useMistakes() {
  const { save } = useSave();

  const book = computed(() => save.value.mistakes);

  function record(char, code, actual) {
    const entry = save.value.mistakes[char] ?? {
      code,
      count: 0,
      lastWrongInputs: [],
      lastAt: 0,
      mastered: false,
    };
    entry.code = code;
    entry.count += 1;
    entry.lastWrongInputs = [actual, ...entry.lastWrongInputs].slice(0, 5);
    entry.lastAt = Date.now();
    entry.mastered = false;
    save.value.mistakes[char] = entry;
    touchSave();
  }

  function markMastered(char) {
    const entry = save.value.mistakes[char];
    if (entry && !entry.mastered) {
      entry.mastered = true;
      touchSave();
    }
  }

  /** 未掌握（默认出现）的错题列表 */
  function pending() {
    return Object.entries(save.value.mistakes).filter(([, entry]) => !entry.mastered);
  }

  function clear(char) {
    if (save.value.mistakes[char]) {
      delete save.value.mistakes[char];
      touchSave();
    }
  }

  function reset() {
    save.value.mistakes = {};
    flushSave();
  }

  return { book, record, markMastered, pending, clear, reset };
}
