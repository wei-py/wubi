/** 仅响应小写字母与空格 */
const KEY_RE = /^[a-z ]$/;

/** 退格键名（视图层与引擎的约定字符串） */
export const KEY_BACKSPACE = "Backspace";

/**
 * 创建练习会话。
 * 未收录（code 为 null）的字会被跳过。
 */
export function createSession(chars, scheme, now, options = {}) {
  const items = [];
  for (const char of chars) {
    const code = scheme.code(char);
    if (!code) continue;
    items.push({ char, code, state: "pending", wrongAttempts: [], shorts: scheme.shorts(char) });
  }
  if (items.length > 0) items[0].state = "active";
  return {
    items,
    cursor: 0,
    input: "",
    correctKeys: 0,
    totalKeys: 0,
    correctChars: 0,
    startAt: now,
    finished: items.length === 0,
    requireFull: options.requireFull ?? false,
  };
}

/** 深拷贝会话（items 与 wrongAttempts 均复制） */
function clone(session) {
  return {
    ...session,
    items: session.items.map((item) => ({ ...item, wrongAttempts: [...item.wrongAttempts] })),
  };
}

/** 完成当前字并推进光标 */
function complete(session, events) {
  const item = session.items[session.cursor];
  item.state = "done";
  session.correctChars += 1;
  events.push({ type: "char-done", char: item.char });
  session.cursor += 1;
  session.input = "";
  if (session.cursor >= session.items.length) {
    session.finished = true;
    events.push({ type: "session-done" });
  } else {
    session.items[session.cursor].state = "active";
  }
}

/** 接受一个正确字母键 */
function accept(session, key, events) {
  const item = session.items[session.cursor];
  session.input += key;
  session.totalKeys += 1;
  session.correctKeys += 1;
  events.push({ type: "key-accept" });
  if (session.input === item.code) complete(session, events);
}

/** 拒绝一个错误按键（字母或空格） */
function reject(session, actual, events) {
  const item = session.items[session.cursor];
  session.totalKeys += 1;
  item.wrongAttempts.push(actual);
  events.push({ type: "key-reject", expect: item.code, actual });
  events.push({ type: "char-error", char: item.char, expect: item.code, actual });
}

/**
 * 处理一次按键。
 * 返回新的会话与本次产生的事件列表；会话不满足输入条件时原样返回。
 * 退格仅删除当前字已接受输入的末位字符，不计入击键统计（已发生的错误不回滚）。
 */
export function feedKey(session, key) {
  const events = [];
  if (session.finished) {
    return { session, events };
  }
  if (key === KEY_BACKSPACE) {
    if (session.input.length === 0) return { session, events };
    const next = clone(session);
    next.input = next.input.slice(0, -1);
    events.push({ type: "key-back" });
    return { session: next, events };
  }
  if (!KEY_RE.test(key)) {
    return { session, events };
  }
  const next = clone(session);
  const item = next.items[next.cursor];

  if (key === " ") {
    if (!next.requireFull && next.input.length > 0 && item.shorts.includes(next.input)) {
      complete(next, events);
    } else {
      reject(next, `${next.input} `, events);
    }
  } else if (item.code.startsWith(next.input + key)) {
    accept(next, key, events);
  } else if (!next.requireFull && item.shorts.some((s) => s.startsWith(next.input + key))) {
    // 简码可能不是全码前缀（如「有」全码 def、简码 e），须允许简码输入
    accept(next, key, events);
  } else {
    reject(next, next.input + key, events);
  }

  return { session: next, events };
}
