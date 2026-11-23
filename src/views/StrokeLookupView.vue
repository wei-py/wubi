<script>
import { ref, shallowRef } from "vue";
import strokeData from "@/data/generated/strokes.json?raw";

const strokes = JSON.parse(strokeData);
</script>

<script setup>
const limit = 24;
const strokeTypes = {
  1: { glyph: "一", name: "横" },
  2: { glyph: "丨", name: "竖" },
  3: { glyph: "丿", name: "撇" },
  4: { glyph: "丶", name: "点／捺" },
  5: { glyph: "乛", name: "折" },
};
const query = ref("");
const result = shallowRef(null);

function lookup() {
  const chars = new Set();
  for (const char of query.value) {
    if (/\p{Script=Han}/u.test(char)) chars.add(char);
    if (chars.size > limit) break;
  }
  const entries = Array.from(chars).slice(0, limit).map((char) => {
    const data = strokes[char];
    const sequence = typeof data === "string" ? data : "";
    return { char, count: sequence ? sequence.length : data, sequence };
  });
  result.value = { entries, found: entries.filter(({ count }) => count).length, capped: chars.size > limit };
}
</script>

<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / STROKE LOOKUP</span>
    <h1>笔画查询</h1>
    <p class="paper-lead">输入或粘贴汉字，查看总笔画数和每一笔的顺序。查询结果不受五笔方案影响。</p>
  </header>

  <search>
    <form class="stroke-search" @submit.prevent="lookup">
      <label for="stroke-query">要查询的汉字</label>
      <p id="stroke-hint" class="muted">
        例如「永」或「学习」。每次最多查 {{ limit }} 个不同的字，忽略空格和标点。
      </p>
      <div class="toolbar">
        <input
          id="stroke-query"
          v-model="query"
          name="q"
          type="search"
          aria-describedby="stroke-hint"
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

  <div role="status" class="stroke-status muted">
    <p v-if="result?.entries.length">
      查到 {{ result.found }} / {{ result.entries.length }} 个字。
      <template v-if="result.capped">仅查询前 {{ limit }} 个不同的字。</template>
    </p>
    <p v-else-if="result">未检测到汉字，请输入要查询的汉字。</p>
  </div>
  <template v-if="result?.entries.length">
    <p v-if="result.entries.some(({ sequence }) => sequence)" class="muted stroke-note">
      笔顺按横、竖、撇、点／捺、折五类显示，不区分同类笔形的具体写法。
    </p>
    <section v-for="entry in result.entries" :key="entry.char" class="stroke-result">
      <header class="stroke-result__heading">
        <h2>{{ entry.char }}</h2>
        <span v-if="entry.count" class="badge">{{ entry.count }} 画</span>
      </header>
      <p v-if="!entry.count" class="muted">字表未收录此字。</p>
      <p v-else-if="!entry.sequence" class="muted">暂无此字的笔顺数据。</p>
      <ol v-else class="stroke-sequence" role="list" :aria-label="`${entry.char}的笔顺`">
        <li v-for="(stroke, index) in entry.sequence" :key="index">
          <span aria-hidden="true">{{ strokeTypes[stroke].glyph }}</span>
          {{ strokeTypes[stroke].name }}
        </li>
      </ol>
    </section>
  </template>
</template>

<style scoped>
.stroke-search {
  max-inline-size: 44rem;
}
.stroke-search label {
  font-weight: 500;
}
.stroke-search p {
  margin-block: 4px 10px;
}
.stroke-search p,
.stroke-status,
.stroke-note {
  font-size: 14px;
}
.stroke-search input,
.stroke-search button {
  min-block-size: 3rem;
  font-size: max(1rem, 1em);
}
.stroke-search input {
  min-inline-size: 0;
}
.stroke-status p {
  margin-block: 24px 4px;
}
.stroke-note {
  margin-block-end: 16px;
}
.stroke-result {
  padding-block: 16px;
  border-top: 1px solid var(--rule);
}
.stroke-result__heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block-end: 8px;
}
.stroke-result h2 {
  margin: 0;
  font-size: 2rem;
  line-height: 1.2;
}
.stroke-result p {
  margin: 0;
}
.stroke-sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.stroke-sequence li {
  display: grid;
  justify-items: center;
  min-inline-size: 3.25rem;
  padding: 4px 6px;
  border: 1px solid var(--rule);
  color: var(--ink-muted);
  font-size: 12px;
}
.stroke-sequence li span {
  color: var(--ink);
  font-size: 1.25rem;
  line-height: 1.4;
}
</style>
