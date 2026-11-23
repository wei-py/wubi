<script setup>
import { computed, onMounted, ref, shallowRef } from "vue";
import { useUiSettings } from "@/composables/useUiSettings.js";
import { loadAllChars } from "@/data/loader.js";
import { SCHEME_LABELS } from "@/schemes/catalog.js";

const { scheme } = useUiSettings();
const limit = 24;
const query = ref("");
const dictionary = shallowRef(null);
const error = ref(false);
const submitted = shallowRef(null);
const results = computed(() => {
  if (!dictionary.value || !submitted.value) return null;
  return submitted.value.chars.map((char) => ({ char, entry: dictionary.value[char] }));
});
const found = computed(() => results.value?.filter(({ entry }) => entry).length ?? 0);

onMounted(async () => {
  try {
    dictionary.value = await loadAllChars(scheme.value);
  } catch {
    error.value = true;
  }
});

function lookup() {
  const chars = new Set();
  let capped = false;
  for (const char of query.value) {
    if (!/\p{Script=Han}/u.test(char) || chars.has(char)) continue;
    if (chars.size === limit) {
      capped = true;
      break;
    }
    chars.add(char);
  }
  submitted.value = { chars: [...chars], capped };
}
</script>

<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / CHARACTER LOOKUP</span>
    <h1>五笔查字</h1>
    <p class="paper-lead">
      输入或粘贴汉字，查询五笔全码、简码和字根拆分。当前方案：<strong>{{ SCHEME_LABELS[scheme] }}</strong>。
    </p>
  </header>

  <search>
    <form class="lookup-search" @submit.prevent="lookup">
      <label for="lookup-query">要查询的汉字</label>
      <p id="lookup-hint" class="muted">
        例如「钨」或「学习」。每次最多查 {{ limit }} 个不同的字，忽略空格和标点。
      </p>
      <div class="toolbar">
        <input
          id="lookup-query"
          v-model="query"
          name="q"
          type="search"
          aria-describedby="lookup-hint"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          required
        />
        <button type="submit" class="base-button base-button--primary">查询</button>
      </div>
    </form>
  </search>

  <p v-if="error" role="alert" class="notice notice--error">五笔码表加载失败，请刷新页面后重试。</p>
  <p v-else-if="!dictionary" class="notice">正在加载五笔码表…</p>
  <div role="status" class="lookup-status muted">
    <p v-if="results?.length">
      查到 {{ found }} / {{ results.length }} 个字的五笔编码。
      <template v-if="submitted.capped">仅查询前 {{ limit }} 个不同的字。</template>
    </p>
    <p v-else-if="results">未检测到汉字，请输入要查询的汉字。</p>
  </div>

  <section v-for="{ char, entry } in results" :key="char" class="reference-result lookup-result">
    <h2>{{ char }}</h2>
    <p v-if="!entry">当前方案的码表未收录此字。</p>
    <dl v-else>
      <dt>全码</dt>
      <dd>
        <code>{{ entry.code.toUpperCase() }}</code>
        <span v-if="entry.idcode" class="badge">含末笔识别码</span>
      </dd>
      <dt>简码</dt>
      <dd v-if="entry.short.length">
        <code v-for="short in entry.short" :key="short">{{ short.toUpperCase() }}</code>
        <span class="muted">按空格上屏</span>
      </dd>
      <dd v-else class="muted">无简码</dd>
      <template v-if="entry.radicals.length">
        <dt>字根</dt>
        <dd class="root-glyphs">
          {{ entry.radicals.map(([root, key]) => `${root} ${key.toUpperCase()}`).join(" · ") }}
        </dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.lookup-search {
  max-inline-size: 44rem;
}
.lookup-search label {
  font-weight: 500;
}
.lookup-search p {
  margin-block: 4px 10px;
}
.lookup-search p,
.lookup-status {
  font-size: 14px;
}
.lookup-search input,
.lookup-search button {
  min-block-size: 3rem;
  font-size: max(1rem, 1em);
}
.lookup-search input {
  min-inline-size: 0;
}
.lookup-status p {
  margin-block: 24px 12px;
}
.lookup-result h2 {
  margin: 0 0 8px;
  font-size: 2rem;
  line-height: 1.2;
}
.lookup-result dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 6px 16px;
  margin: 0;
}
.lookup-result dt {
  color: var(--ink-muted);
  font-size: 14px;
}
.lookup-result dd {
  margin: 0;
}
.lookup-result dd > :not(:last-child) {
  margin-inline-end: 10px;
}
.lookup-result .root-glyphs {
  font-size: 18px;
  letter-spacing: normal;
}
</style>
