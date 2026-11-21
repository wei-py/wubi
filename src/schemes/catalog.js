export const SCHEME_LABELS = {
  wubi98: "98 王码",
  wubi86: "86 版",
  wubi06: "新世纪版",
};

export const SCHEME_KEY = "wubi-learning.ui.scheme";

export function normalizeScheme(value) {
  return Object.hasOwn(SCHEME_LABELS, value) ? value : "wubi98";
}

export function readScheme() {
  try {
    return normalizeScheme(localStorage.getItem(SCHEME_KEY));
  } catch {
    return normalizeScheme(null);
  }
}
