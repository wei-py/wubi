import assert from "node:assert/strict";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useMistakes } from "../src/composables/useMistakes.js";
import { useSave } from "../src/composables/useSave.js";

test("错题变更立即保存，新会话恢复次数、最近输入和掌握状态", (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    setActivePinia(undefined);
  });

  function reopen() {
    setActivePinia(createPinia());
    return useMistakes();
  }

  let mistakes = reopen();
  const before = Date.now();
  for (const input of ["a", "b", "c", "d", "e", "f"]) {
    mistakes.record("五", "gghg", input);
  }
  // No timer advancement or exit event: a fresh store reads only persisted data.
  mistakes = reopen();
  assert.deepEqual(mistakes.book.value["五"], {
    code: "gghg",
    count: 6,
    lastWrongInputs: ["f", "e", "d", "c", "b"],
    lastAt: mistakes.book.value["五"].lastAt,
    mastered: false,
  });
  assert.ok(mistakes.book.value["五"].lastAt >= before);

  mistakes.markMastered("五");
  mistakes = reopen();
  assert.equal(mistakes.book.value["五"].mastered, true);
  assert.deepEqual(mistakes.pending(), []);

  mistakes.record("五", "gg", "x");
  mistakes = reopen();
  assert.equal(mistakes.book.value["五"].count, 7);
  assert.equal(mistakes.book.value["五"].code, "gg");
  assert.equal(mistakes.book.value["五"].mastered, false);
  assert.deepEqual(mistakes.book.value["五"].lastWrongInputs, ["x", "f", "e", "d", "c"]);

  const backup = useSave().exportSave();
  mistakes.clear("五");
  mistakes = reopen();
  assert.deepEqual(mistakes.book.value, {});

  assert.equal(useSave().importSave(backup).ok, true);
  mistakes = reopen();
  assert.equal(mistakes.book.value["五"].count, 7);
  mistakes.reset();
  assert.deepEqual(reopen().book.value, {});
});
