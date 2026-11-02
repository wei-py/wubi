/**
 * 所有 generated JSON 的懒加载器（构建期静态展开，支持方案化路径）。
 * 数据由 `pnpm data:build` 生成到 src/data/generated/{scheme}/。
 */
const modules = import.meta.glob("./generated/**/*.json");

function loadJson(path) {
  const loader = modules[`./generated/${path}`];
  if (!loader) {
    return Promise.reject(new Error(`数据文件不存在：${path}（请先运行 pnpm data:build）`));
  }
  return loader().then((module) => module.default);
}

/** 按 key 缓存懒加载 Promise */
const caches = new Map();

function cached(key, load) {
  if (!caches.has(key)) caches.set(key, load());
  return caches.get(key);
}

/** 懒加载全量单字码表 */
export function loadAllChars(scheme) {
  return cached(`${scheme}/chars`, () => loadJson(`${scheme}/chars.json`));
}

/** 懒加载一级常用字表 */
export function loadFreq1Chars(scheme) {
  return cached(`${scheme}/freq1`, () => loadJson(`${scheme}/chars.freq1.json`));
}

/** 懒加载字根表（含键盘布局） */
export function loadZigen(scheme) {
  return cached(`${scheme}/zigen`, () => loadJson(`${scheme}/zigen.json`));
}

/** 懒加载常用字根权重表 */
export function loadRadicalWeights(scheme) {
  return cached(`${scheme}/weights`, () => loadJson(`${scheme}/radical-weights.json`));
}

/** 懒加载公版文章库（方案共用） */
export function loadArticles() {
  return cached("articles", () => loadJson("articles.json"));
}

/** 懒加载常用 3500 字（按字频降序，方案共用） */
export function loadCommon3500() {
  return cached("common3500", () => loadJson("common3500.json"));
}

/** 懒加载常用词组表（方案共用） */
export function loadWords() {
  return cached("words", () => loadJson("words.json"));
}
