import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { flushSave, useSave } from "../src/composables/useSave.js";
import { createSession, feedKey } from "../src/engine/judge.js";
import {
  createTypingSession,
  feedBackspace,
  feedChar,
  startTyping,
  typingStats,
} from "../src/engine/typing.js";

const chars = JSON.parse(
  readFileSync(new URL("../src/data/generated/wubi86/chars.json", import.meta.url), "utf8"),
);
const scheme = {
  id: "wubi86",
  code: (char) => chars[char]?.code ?? null,
  shorts: (char) => chars[char]?.short ?? [],
  hint: () => [],
};
function enter(session, keys) {
  for (const key of keys) session = feedKey(session, key).session;
  return session;
}

test("非全码前缀的一级简码仍可用空格提交", () => {
  const session = enter(createSession(["有"], scheme, 0), ["e", " "]);
  assert.equal(session.finished, true);
  assert.equal(session.correctChars, 1);
});

test("强制全码训练拒绝简码，但仍接受完整编码", () => {
  let session = enter(createSession(["有"], scheme, 0, { requireFull: true }), ["e", " "]);
  assert.equal(session.finished, false);
  assert.equal(session.input, "");
  session = enter(session, [...chars.有.code]);
  assert.equal(session.correctChars, 1);
});

test("错误编码不吞掉已正确输入的前缀", () => {
  const session = enter(createSession(["我"], scheme, 0), ["t", "z"]);
  assert.equal(session.input, "t");
  assert.equal(session.cursor, 0);
  assert.equal(session.totalKeys, 2);
  assert.equal(session.correctKeys, 1);
});

test("连续错键始终停留当前字，直到正确编码完成才推进一次", () => {
  let session = createSession(["我", "有"], scheme, 0);
  for (const key of ["z", "x", "z"]) {
    session = feedKey(session, key).session;
    assert.equal(session.cursor, 0);
    assert.equal(session.correctChars, 0);
  }
  session = enter(session, [...chars.我.code]);
  assert.equal(session.cursor, 1);
  assert.equal(session.correctChars, 1);
  assert.equal(session.totalKeys, 3 + chars.我.code.length);
});

test("跟打错字不前进，退格只清除错字槽，不撤销已完成文字", () => {
  let session = startTyping(createTypingSession(["你", "好"]), 0);
  session = feedChar(session, "你", 1000).session;
  session = feedChar(session, "号", 2000).session;
  assert.equal(session.pos, 1);
  session = feedBackspace(session, 2500).session;
  assert.equal(session.pos, 1);
  assert.equal(session.errorSlot, null);
  session = feedChar(session, "好", 3000).session;
  assert.equal(session.pos, 2);
  assert.ok(Math.abs(typingStats(session, 9000).accuracy - 2 / 3) < Number.EPSILON);
});

test("计时从首个物理按键开始，完成后速度与耗时冻结", () => {
  let session = startTyping(createTypingSession(["你", "好"]), 1000);
  session = feedChar(session, "你", 3000).session;
  session = feedChar(session, "好", 5000).session;
  assert.equal(typingStats(session, 5000).speed, 30);
  assert.equal(typingStats(session, 99000).elapsedMs, 4000);
  assert.equal(typingStats(session, 99000).speed, 30);
});

test("跳到末组与回练首组，成绩仅记录真正完成的分组", () => {
  setActivePinia(createPinia());
  const store = useSave();
  store.recordTypingGroup("s4-common-1", 70, 40);
  store.recordTypingGroup("s4-common-1", 1, 25);
  const progress = store.getTypingProgress("s4-common-1");
  assert.equal(progress.groupBests.filter((speed) => speed > 0).length, 2);
  assert.equal(progress.groupBests[69], 40);
  assert.equal(progress.groupBests[0], 25);
});

test("存档往返保留成绩，重练不会覆盖更快的成绩或取消完成状态", () => {
  setActivePinia(createPinia());
  const store = useSave();
  store.recordLevelResult("s3-idcode-all", 60, 0.95, true, 0);
  store.recordLevelResult("s3-idcode-all", 20, 0.8, false, 1);
  const backup = store.exportSave();
  store.resetAll();
  assert.equal(store.getLevelResult("s3-idcode-all"), undefined);
  assert.equal(store.importSave(backup).ok, true);
  const restored = store.getLevelResult("s3-idcode-all");
  assert.equal(restored.bestSpeed, 60);
  assert.equal(restored.bestAccuracy, 0.95);
  assert.equal(restored.passed, true);
  assert.equal(restored.attempts, 2);
  assert.equal(store.importSave("{invalid json").ok, false);
  assert.equal(store.getLevelResult("s3-idcode-all").bestSpeed, 60);
  flushSave();
});
