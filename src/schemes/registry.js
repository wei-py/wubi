import { loadAllChars } from "../data/loader.js";

/** 已加载的码表；未加载时为 undefined */
const tables = {};

/** 确保指定方案的码表已加载 */
export async function ensureScheme(scheme) {
  if (!tables[scheme]) {
    tables[scheme] = await loadAllChars(scheme);
  }
}

function makeScheme(scheme) {
  return {
    id: scheme,
    code(char) {
      return tables[scheme]?.[char]?.code ?? null;
    },
    shorts(char) {
      return tables[scheme]?.[char]?.short ?? [];
    },
    hint(char) {
      const entry = tables[scheme]?.[char];
      if (!entry) return [];
      return entry.radicals.map(([text, key]) => ({ text, key }));
    },
  };
}

/** 86 版（微软五笔）方案实现 */
export const wubi86 = makeScheme("wubi86");

/** 98 王码方案实现 */
export const wubi98 = makeScheme("wubi98");

/** 按 id 取方案实现 */
export function getScheme(scheme) {
  return scheme === "wubi98" ? wubi98 : wubi86;
}
