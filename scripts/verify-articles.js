/**
 * 文章数据校验（R4.1）。
 *
 * 校验：
 *   ① 结构完整（id/title/author/source/paragraphs/difficulty）
 *   ② id 唯一，汉字数 ≥ 200
 *   ③ 课程与综合段落的文章引用都能在生成文章库中找到
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { STAGES } from "../src/data/stages.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function hanCount(text) {
  return [...text].filter((c) => /[\u4E00-\u9FFF]/.test(c)).length;
}

function main() {
  const articles = JSON.parse(readFileSync(resolve(ROOT, "src/data/generated/articles.json"), "utf8"));

  const errors = [];
  const ids = new Set();

  for (const a of articles) {
    if (!a.id || !a.title || !a.author || !a.source) errors.push(`字段缺失：${a.id || "?"}`);
    if (ids.has(a.id)) errors.push(`id 重复：${a.id}`);
    ids.add(a.id);
    if (!Array.isArray(a.paragraphs) || a.paragraphs.length === 0) {
      errors.push(`段落为空：${a.id}`);
      continue;
    }
    const count = hanCount(a.paragraphs.join(""));
    if (count < 200) errors.push(`汉字少于 200（${count}）：${a.id}`);
    if (a.difficulty < 1 || a.difficulty > 4) errors.push(`难度越界：${a.id}`);
  }

  const referenced = STAGES.flatMap((stage) =>
    stage.levels.flatMap((level) => [
      ...(level.articleIds ?? []),
      ...(level.typing?.articleIds ?? []),
      ...(level.typing?.segments ?? []).flatMap((segment) => segment.articleIds ?? []),
    ]),
  );
  for (const id of referenced) {
    if (!ids.has(id)) errors.push(`stages 引用不存在：${id}`);
  }

  console.log("=== 文章校验 ===");
  console.log(`篇目 ${articles.length} 篇，引用校验 ${referenced.length} 处`);
  for (const a of articles) {
    console.log(`  ${a.id} 《${a.title}》 ${a.author} · ${hanCount(a.paragraphs.join(""))} 字`);
  }

  if (errors.length > 0) {
    console.error("\n文章校验未通过：");
    for (const e of errors) console.error("  -", e);
    process.exit(1);
  }
  console.log("文章校验全部通过");
}

main();
