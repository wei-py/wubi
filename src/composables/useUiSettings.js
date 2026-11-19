import { ref } from "vue";

const ALIGN_KEY = "wubi-learning.ui.align";
const THEME_KEY = "wubi-learning.ui.theme";
const SOUND_KEY = "wubi-learning.ui.sound";
const VOLUME_KEY = "wubi-learning.ui.volume";
const HINTS_KEY = "wubi-learning.ui.hints";
const CODEHINT_KEY = "wubi-learning.ui.codehint";
const SCHEME_KEY = "wubi-learning.ui.scheme";

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences remain usable in memory when storage is unavailable.
  }
}

function initialTheme() {
  const value = read(THEME_KEY);
  return value === "light" || value === "dark" ? value : "auto";
}

function initialVolume() {
  const stored = read(VOLUME_KEY);
  if (stored === null) return 0;
  const value = Number(stored);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

const align = ref(read(ALIGN_KEY) === "left" ? "left" : "center");
const theme = ref(initialTheme());
const soundOn = ref(read(SOUND_KEY) !== "off");
const volume = ref(initialVolume());
const hintsOn = ref(read(HINTS_KEY) !== "off");
const codeHintOn = ref(read(CODEHINT_KEY) !== "off");
const scheme = ref(read(SCHEME_KEY) === "wubi86" ? "wubi86" : "wubi98");

function applyTheme() {
  if (typeof document === "undefined") return;
  const explicit = theme.value !== "auto";
  if (explicit) document.documentElement.setAttribute("data-theme", theme.value);
  else document.documentElement.removeAttribute("data-theme");
  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.content = explicit ? theme.value : "light dark";
}

applyTheme();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    theme.value = initialTheme();
    applyTheme();
  });
}

/** Shared reactive UI preferences, kept separate from exported learning saves. */
export function useUiSettings() {
  function setAlign(value) {
    align.value = value;
    write(ALIGN_KEY, value);
  }

  function setTheme(value) {
    theme.value = value === "light" || value === "dark" ? value : "auto";
    if (theme.value === "auto") {
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        // Following the system remains usable when storage is unavailable.
      }
    } else write(THEME_KEY, theme.value);
    applyTheme();
  }

  function setSound(value) {
    soundOn.value = value;
    write(SOUND_KEY, value ? "on" : "off");
  }

  function setVolume(value) {
    const next = Math.min(1, Math.max(0, value));
    volume.value = next;
    write(VOLUME_KEY, String(next));
  }

  function setHints(value) {
    hintsOn.value = value;
    write(HINTS_KEY, value ? "on" : "off");
  }

  function setCodeHint(value) {
    codeHintOn.value = value;
    write(CODEHINT_KEY, value ? "on" : "off");
  }

  // The caller saves current progress and reloads to activate the new scheme.
  function setScheme(value) {
    scheme.value = value;
    write(SCHEME_KEY, value);
  }

  return {
    align,
    theme,
    soundOn,
    volume,
    hintsOn,
    codeHintOn,
    scheme,
    setAlign,
    setTheme,
    setSound,
    setVolume,
    setHints,
    setCodeHint,
    setScheme,
    applyTheme,
  };
}
