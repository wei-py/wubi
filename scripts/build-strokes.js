import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";

const source = new URL("./sources/data-chars.tsv", import.meta.url);
const output = new URL("../src/data/generated/", import.meta.url);
const [header, ...rows] = readFileSync(source, "utf8").trimEnd().split(/\r?\n/);
const columns = header.split("\t");
const [charColumn, countColumn, sequenceColumn] = ["char", "strokes", "stroke_seq"].map(
  (name) => columns.indexOf(name),
);
if ([charColumn, countColumn, sequenceColumn].includes(-1)) {
  throw new Error("data-chars.tsv 缺少笔画数据列");
}

const entries = {};
for (const row of rows) {
  const fields = row.split("\t");
  const char = fields[charColumn];
  if (!/^\p{Script=Han}$/u.test(char)) continue;
  const sequence = fields[sequenceColumn];
  const count = Number(fields[countColumn]);
  // 部分字的 strokes 列沿用异体字笔画数；有笔顺时以逐笔记录为准。
  if (sequence && /^[1-5]+$/.test(sequence)) entries[char] = sequence;
  else if (Number.isInteger(count) && count > 0) entries[char] = count;
}

mkdirSync(output, { recursive: true });
writeFileSync(new URL("strokes.json", output), JSON.stringify(entries), "utf8");
console.log(`[build-strokes] 笔画条目 ${Object.keys(entries).length}`);
