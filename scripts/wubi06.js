import { readFileSync } from "node:fs";

// 新世纪拆分沿用站点已有的黑体字根码点，圈内笔画表示识别码。
const ident = new Set("\uE000\uE015\uE02D\uE06A\uE080\uE097\uE0CD\uE0DF\uE0F4\uE13D\uE155\uE171\uE1AD\uE1DF\uE1FA");

export function readChars06() {
  const text = readFileSync(new URL("./sources/data-wubi-v06.tsv", import.meta.url), "utf8");
  const chars = new Map();
  for (const line of text.split(/\r?\n/).slice(2)) {
    if (!line) continue;
    const [char, code, shorts, rootText] = line.split("\t");
    const roots = [...rootText];
    chars.set(char, {
      code,
      short: shorts ? shorts.split(",") : [],
      radicals: roots.map((root, i) => [root, code[i]]),
      idcode: ident.has(roots.at(-1)),
    });
  }
  return chars;
}

export function layout06(roots) {
  return {
    size: roots.length <= 16 ? 4 : 5,
    cells: roots.map((cp, i) => ({ cp, bold: i === 0, mark: null })),
  };
}
