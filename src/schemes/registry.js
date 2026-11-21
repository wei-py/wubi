import { loadAllChars } from "../data/loader.js";
import { normalizeScheme, SCHEME_LABELS } from "./catalog.js";

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

const schemes = Object.fromEntries(
  Object.keys(SCHEME_LABELS).map((scheme) => [scheme, makeScheme(scheme)]),
);

/** 按 id 取方案实现 */
export function getScheme(scheme) {
  return schemes[normalizeScheme(scheme)];
}
