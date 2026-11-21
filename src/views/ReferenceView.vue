<script setup>
import { computed, onMounted, ref } from "vue";
import { useUiSettings } from "@/composables/useUiSettings.js";
import { loadAllChars, loadZigen } from "@/data/loader.js";
import { SCHEME_LABELS } from "@/schemes/catalog.js";
const { scheme } = useUiSettings();
const roots = ref([]);
const chars = ref({});
const query = ref("");
const area = ref(0);
const error = ref("");
const areas = [
  "全部字根",
  "横区 G F D S A",
  "竖区 H J K L M",
  "撇区 T R E W Q",
  "捺区 Y U I O P",
  "折区 N B V C X",
];
const visibleRoots = computed(() =>
  roots.value.filter(
    (root) =>
      (!area.value || root.area === area.value) &&
      (!query.value.trim() ||
        (root.key + root.name + root.mnemonic + root.roots.join(""))
          .toLowerCase()
          .includes(query.value.trim().toLowerCase())),
  ),
);
const lookup = computed(() =>
  [...new Set([...query.value])]
    .filter((char) => chars.value[char])
    .slice(0, 24)
    .map((char) => ({ char, ...chars.value[char] })),
);
onMounted(async () => {
  try {
    [roots.value, chars.value] = await Promise.all([
      loadZigen(scheme.value),
      loadAllChars(scheme.value),
    ]);
  } catch (cause) {
    error.value = cause.message;
  }
});
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / QUICK REFERENCE</span>
    <h1>想不起来，就查一下</h1>
    <p class="paper-lead">
      {{ SCHEME_LABELS[scheme] }} · 25
      个键位、字根口诀与汉字编码。查过，再亲手打一遍。
    </p>
  </header>
  <div class="toolbar">
    <input
      v-model="query"
      type="search"
      aria-label="查询字根或汉字编码"
      placeholder="输入汉字查编码，或输入键位、口诀查字根"
    /><label>分区<select v-model.number="area">
      <option v-for="(name, index) in areas" :key="index" :value="index">{{ name }}</option>
    </select></label>
  </div>
  <p v-if="error" role="alert" class="notice notice--error">加载失败：{{ error }}</p>
  <section v-for="item in lookup" :key="item.char" class="reference-result">
    <h2>
      <span>{{ item.char }}</span><code>{{ item.code.toUpperCase() }}</code><span class="badge">{{ item.idcode ? "含末笔识别码" : "全码" }}</span>
    </h2>
    <div class="root-glyphs">
      {{ item.radicals.map(([root, key]) => `${root} ${key.toUpperCase()}`).join(" · ") }}
    </div>
    <p>
      简码：{{
        item.short.length
          ? item.short.map((code) => `${code.toUpperCase()} + 空格`).join(" ／ ")
          : "无简码，请输入全码"
      }}
    </p>
  </section>
  <div class="reference-grid">
    <article v-for="root in visibleRoots" :key="root.key" class="root-entry">
      <span class="root-key">{{ root.key.toUpperCase() }}</span>
      <div>
        <h2>{{ root.name }} · 一级简码「{{ root.short1 }}」</h2>
        <div class="root-glyphs">{{ root.roots.join("") }}</div>
        <p>{{ root.mnemonic }}</p>
      </div>
    </article>
  </div>
  <p v-if="roots.length && !visibleRoots.length && !lookup.length" class="empty-state">
    未找到对应字根或汉字。可以尝试「G」「王」或单个简体汉字。
  </p>
  <section class="form-section reading">
    <h2>末笔字型识别码</h2>
    <p>字根不足四个时，按末笔与字型补充识别码。行看末笔，列看结构；字型为左右、上下或杂合。</p>
    <table class="id-table">
      <thead>
        <tr>
          <th>末笔</th>
          <th>左右型</th>
          <th>上下型</th>
          <th>杂合型</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in [
            ['横', 'G', 'F', 'D'],
            ['竖', 'H', 'J', 'K'],
            ['撇', 'T', 'R', 'E'],
            ['捺', 'Y', 'U', 'I'],
            ['折', 'N', 'B', 'V'],
          ]"
          :key="row[0]"
        >
          <td v-for="(cell, index) in row" :key="index">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
    <RouterLink to="/play/s3-intro" class="base-button">阅读识别码原理 ↗</RouterLink>
  </section>
</template>
