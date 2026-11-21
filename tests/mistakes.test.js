import assert from "node:assert/strict";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { useMistakes } from "../src/composables/useMistakes.js";
import { useSave } from "../src/composables/useSave.js";

test("每关错题独立立即保存，手动增删、掌握状态和旧档恢复互不串关", (t) => {
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
    return useMistakes("s2-short1-full");
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
  const other = () => useMistakes("s2-short1-mix");
  assert.deepEqual(other().book.value, {});
  assert.equal(other().add("五", "gg"), true);
  assert.equal(other().add("五", "gg"), false);
  mistakes = reopen();
  assert.equal(other().book.value["五"].count, 0);
  assert.deepEqual(other().book.value["五"].lastWrongInputs, []);
  assert.equal(mistakes.book.value["五"].count, 6);

  mistakes.markMastered("五");
  mistakes = reopen();
  assert.equal(mistakes.book.value["五"].mastered, true);
  assert.deepEqual(mistakes.pending(), []);
  assert.equal(other().book.value["五"].mastered, false);
  other().markMastered("五");
  assert.equal(other().add("五", "gg"), true);
  assert.equal(other().book.value["五"].mastered, false);
  assert.equal(other().book.value["五"].count, 0);

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
  assert.equal(other().book.value["五"].code, "gg");

  assert.equal(useSave().importSave(backup).ok, true);
  mistakes = reopen();
  assert.equal(mistakes.book.value["五"].count, 7);
  mistakes.reset();
  assert.deepEqual(reopen().book.value, {});
  assert.equal(other().book.value["五"].count, 0);
  other().reset();
  assert.deepEqual(useMistakes("s2-short1-mix").book.value, {});

  const oldEntry = { code: "gghg", count: 2, lastWrongInputs: ["x"], lastAt: 10, mastered: false };
  assert.equal(useSave().importSave(JSON.stringify({
    version: 2, mistakes: { 五: oldEntry },
  })).ok, true);
  mistakes = reopen();
  assert.deepEqual(mistakes.book.value, {});
  assert.deepEqual(other().book.value, {});
  assert.deepEqual(useMistakes("legacy").book.value["五"], oldEntry);
  assert.deepEqual(JSON.parse(useSave().exportSave()).mistakesByLevel.legacy["五"], oldEntry);
});
