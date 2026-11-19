import { computed } from "vue";

import { flushSave, useSave } from "./useSave.js";

/** 错题本：变更立即写入统一存档，不依赖防抖或页面退出事件。 */
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
    flushSave();
  }

  function markMastered(char) {
    const entry = save.value.mistakes[char];
    if (entry && !entry.mastered) {
      entry.mastered = true;
      flushSave();
    }
  }

  /** 未掌握（默认出现）的错题列表 */
  function pending() {
    return Object.entries(save.value.mistakes).filter(([, entry]) => !entry.mastered);
  }

  function clear(char) {
    if (save.value.mistakes[char]) {
      delete save.value.mistakes[char];
      flushSave();
    }
  }

  function reset() {
    save.value.mistakes = {};
    flushSave();
  }

  return { book, record, markMastered, pending, clear, reset };
}
