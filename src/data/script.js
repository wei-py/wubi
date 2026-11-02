/** 是否汉字（与 pool.js 的 isHan 判定一致） */
function isHan(c) {
  return /[\u4E00-\u9FFF]/.test(c);
}

/** 提示行格式：[...]，两端空白忽略 */
const HINT_RE = /^\[.*\]$/;

/**
 * 解析训练脚本：
 * - `[...]` 提示行不参与训练；
 * - 空行为空行；
 * - 其他行逐字符拆格：汉字参与输入（按序编号），标点/空格仅显示。
 */
export function parseScript(lines) {
  const out = [];
  const chars = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      out.push({ kind: "blank" });
      continue;
    }
    if (HINT_RE.test(line)) {
      out.push({ kind: "hint", text: line });
      continue;
    }
    const cells = [];
    for (const ch of line) {
      if (isHan(ch)) {
        cells.push({ char: ch, train: true, inputIndex: chars.length });
        chars.push(ch);
      } else {
        cells.push({ char: ch, train: false, inputIndex: -1 });
      }
    }
    out.push({ kind: "chars", cells });
  }
  return { lines: out, chars };
}
