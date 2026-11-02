import { ref } from "vue";

const KEY = "wubi-learning.free-text";

function restoreText() {
  try {
    const data = JSON.parse(sessionStorage.getItem(KEY));
    if (typeof data?.title === "string" && typeof data?.text === "string") return data;
  } catch {
    // Start empty when no saved text is available in this browser session.
  }
  return { title: "", text: "" };
}

const selected = restoreText();
const freeTitle = ref(selected.title);
const freeText = ref(selected.text);

/** Custom and selected article text survives refreshes within this tab. */
export function useFreeText() {
  function setFreeText(title, text) {
    freeTitle.value = title;
    freeText.value = text;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ title, text }));
    } catch {
      // Current practice still works when session storage is unavailable.
    }
  }

  return { freeTitle, freeText, setFreeText };
}
