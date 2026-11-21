<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFreeText } from "@/composables/useFreeText.js";
import { useMistakes } from "@/composables/useMistakes.js";
import { useSave } from "@/composables/useSave.js";
import { useUiSettings } from "@/composables/useUiSettings.js";
import { loadAllChars, loadZigen } from "@/data/loader.js";
import { findLevel, STAGES } from "@/data/stages.js";

const route = useRoute();
const router = useRouter();
const { save } = useSave();
const { scheme } = useUiSettings();
const { setFreeText } = useFreeText();
const levels = computed(() => [
  ...STAGES.flatMap((stage) => stage.levels
    .filter((level) => level.type !== "intro")
    .map((level) => ({ id: level.id, title: `${stage.title} · ${level.title}` }))),
  { id: "free", title: "自由练习" },
  ...(save.value.mistakesByLevel.legacy ? [{ id: "legacy", title: "历史未分类（旧版错题）" }] : []),
]);
const levelId = computed({
  get: () => levels.value.some((level) => level.id === route.query.level)
    ? route.query.level : levels.value[0].id,
  set: (level) => router.replace({ query: { ...route.query, level } }),
});
const level = computed(() => findLevel(levelId.value));
const levelTitle = computed(() => levels.value.find((item) => item.id === levelId.value)?.title);
const isZigen = computed(() => level.value?.type === "zigen");
const { book, add, clear, markMastered } = useMistakes(levelId);
const showMastered = ref(false);
const chars = ref({});
const roots = ref([]);
const ready = ref(false);
const loadError = ref("");
const input = ref("");
const inputEl = ref(null);
const error = ref("");
const status = ref("");
const rootOptions = computed(() => roots.value
  .filter((item) => !level.value?.pool || level.value.pool.includes(item.key))
  .flatMap((item) => item.roots.map((root) => ({ char: root, code: item.key }))));
const entries = computed(() => Object.entries(book.value)
  .filter(([, item]) => showMastered.value || !item.mastered)
  .sort((a, b) => b[1].count - a[1].count));

watch(levelId, () => {
  input.value = "";
  error.value = "";
  status.value = "";
});

function submit() {
  const value = input.value.trim();
  const root = isZigen.value
    ? rootOptions.value.find((item) => `${item.code}:${item.char}` === value) : null;
  const char = root?.char ?? value;
  const code = root?.code ?? (Array.from(char).length === 1 ? chars.value[char]?.code : null);
  if (!code) {
    error.value = isZigen.value ? "请选择本关的字根。" : "请输入码表中可查询的单个汉字。";
    inputEl.value?.focus();
    return;
  }
  const added = add(char, code);
  status.value = added ? `已将「${char}」添加到本关错题。` : `「${char}」已在本关错题中。`;
  error.value = "";
  input.value = "";
}

function remove(char) {
  clear(char);
  status.value = `已从本关删除「${char}」。`;
}

function practice() {
  if (!entries.value.length) return;
  if (isZigen.value) {
    router.push({ path: `/play/${levelId.value}`, query: { mistakes: showMastered.value ? "all" : "pending" } });
  } else {
    setFreeText(`${levelTitle.value} · 错题练习`, entries.value.map(([char]) => char).join("").repeat(5));
    router.push({ path: "/play/free", query: { recallLevel: levelId.value } });
  }
}

onMounted(async () => {
  try {
    [chars.value, roots.value] = await Promise.all([loadAllChars(scheme.value), loadZigen(scheme.value)]);
    ready.value = true;
  } catch (cause) {
    loadError.value = `码表加载失败：${cause.message}，请刷新重试。`;
  }
});
</script>

<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / RECALL</span>
    <h1>回忆，比重看更有效</h1>
    <p class="paper-lead">错题按关卡独立保存。可以主动添加不熟悉的题目，也可以删除不再需要的错题。</p>
  </header>
  <div class="toolbar">
    <label for="recall-level">选择关卡</label>
    <select id="recall-level" v-model="levelId" name="level">
      <option v-for="item in levels" :key="item.id" :value="item.id">{{ item.title }}</option>
    </select>
  </div>
  <p v-if="levelId === 'legacy'" class="notice">旧版错题没有来源关卡，单独保留在这里，不会混入任何关卡。</p>
  <form class="recall-add" aria-labelledby="recall-add-title" @submit.prevent="submit">
    <h2 id="recall-add-title">主动添加错题</h2>
    <label for="recall-item">{{ isZigen ? "本关字根（必选）" : "汉字（必填，单个汉字，自动查询编码）" }}</label>
    <select
      v-if="isZigen"
      id="recall-item"
      ref="inputEl"
      v-model="input"
      class="root-glyphs"
      name="item"
      required
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? 'recall-error' : undefined"
      @invalid="error = '请选择本关的字根。'"
      @change="error = ''"
    >
      <option value="" disabled>选择字根</option>
      <option v-for="item in rootOptions" :key="`${item.code}:${item.char}`" :value="`${item.code}:${item.char}`">
        {{ item.char }} · {{ item.code.toUpperCase() }}
      </option>
    </select>
    <input
      v-else
      id="recall-item"
      ref="inputEl"
      v-model="input"
      name="item"
      type="text"
      required
      maxlength="2"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? 'recall-error' : undefined"
      @invalid="error = '请输入单个汉字。'"
      @input="error = ''"
    />
    <button type="submit" class="base-button base-button--primary" :disabled="!ready">添加到本关错题</button>
    <p v-if="error" id="recall-error" class="notice notice--error">{{ error }}</p>
    <p v-if="loadError" class="notice notice--error" role="alert">{{ loadError }}</p>
  </form>
  <p class="recall-status" role="status">{{ status }}</p>
  <div class="toolbar">
    <button class="base-button base-button--primary" :disabled="!entries.length" @click="practice">练习本关错题 ↗</button>
    <label><input v-model="showMastered" type="checkbox" /> 显示已掌握</label>
    <span class="badge">{{ entries.length }} 题</span>
  </div>
  <div v-if="!entries.length" class="empty-state">
    <p>{{ showMastered ? "本关还没有错题记录。" : "本关没有待复习的错题。" }}可以在上方主动添加，或练习本关后自动收集。</p>
    <RouterLink to="/" class="base-button">选择课程 ↗</RouterLink>
  </div>
  <section v-for="[char, item] in entries" :key="char" class="recall-row">
    <span class="recall-char" :class="{ 'root-glyphs': isZigen }">{{ char }}</span>
    <div>
      <details>
        <summary>回忆后查看编码</summary>
        <code>{{ item.code.toUpperCase() }}</code>
      </details>
      <p>{{ item.count ? `错误 ${item.count} 次` : "主动添加 · 尚无错误记录" }}<template v-if="item.lastWrongInputs.length"> · 最近输入：{{ item.lastWrongInputs.join(" / ") }}</template></p>
    </div>
    <div class="recall-actions">
      <button v-if="!item.mastered" class="base-button base-button--text" @click="markMastered(char)">标记掌握 ✓</button>
      <span v-else class="badge badge--success">已掌握</span>
      <button type="button" class="base-button base-button--text" :aria-label="`删除错题「${char}」`" @click="remove(char)">删除错题</button>
    </div>
  </section>
</template>

<style scoped>
.recall-add {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding-block: 24px;
  border-block: 1px solid var(--rule);
}
.recall-add h2 {
  margin: 0;
  font-size: 18px;
}
.recall-add input,
.recall-add select {
  width: min(100%, 420px);
  min-height: 48px;
  font: inherit;
}
.recall-add [aria-invalid="true"] {
  border-color: var(--color-error);
}
.recall-status {
  min-height: 1.5em;
  color: var(--ink-muted);
}
.recall-row {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
  border-bottom: 1px solid var(--rule);
}
.recall-char {
  font-size: 32px;
}
.recall-row p {
  color: var(--ink-muted);
  font-size: 13px;
  margin: 10px 0 0;
  overflow-wrap: anywhere;
}
.recall-row summary {
  cursor: pointer;
  font-size: 14px;
}
.recall-row code {
  display: block;
  padding: 12px 0;
  font-size: 20px;
  letter-spacing: 0.15em;
}
.recall-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
@media (max-width: 600px) {
  .recall-row {
    gap: 12px;
    grid-template-columns: 32px minmax(0, 1fr);
  }
  .recall-actions {
    grid-column: 2;
  }
}
</style>
