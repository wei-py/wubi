<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useFreeText } from "@/composables/useFreeText.js";
import { useMistakes } from "@/composables/useMistakes.js";
const { book, markMastered } = useMistakes();
const { setFreeText } = useFreeText();
const router = useRouter();
const showMastered = ref(false);
const entries = computed(() =>
  Object.entries(book.value)
    .filter(([, item]) => showMastered.value || !item.mastered)
    .sort((a, b) => b[1].count - a[1].count),
);
function practice() {
  const text = entries.value.map(([char]) => char).join("");
  if (!text) return;
  setFreeText("错字回忆练习", text.repeat(5));
  router.push("/typing/free");
}
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / RECALL</span>
    <h1>回忆，比重看更有效</h1>
    <p class="paper-lead">
      编码训练中打错的汉字，会来到这里。先试着回忆，再检查编码，把不熟悉变成熟悉。
    </p>
  </header>
  <div class="toolbar">
    <button class="base-button base-button--primary" :disabled="!entries.length" @click="practice">
      练习这些汉字 ↗
    </button><label><input v-model="showMastered" type="checkbox" /> 显示已掌握</label><span class="badge">{{ entries.length }} 个字</span>
  </div>
  <div v-if="!entries.length" class="empty-state">
    <p>
      {{
        showMastered ? "还没有错字记录。" : "没有待复习的错字。"
      }}完成编码训练后，可以在这里回忆巩固。
    </p>
    <RouterLink to="/" class="base-button">选择课程 ↗</RouterLink>
  </div>
  <section v-for="[char, item] in entries" :key="char" class="recall-row">
    <span class="recall-char">{{ char }}</span>
    <div>
      <details>
        <summary>回忆后查看编码</summary>
        <code>{{ item.code.toUpperCase() }}</code>
      </details>
      <p>错误 {{ item.count }} 次 · 最近输入：{{ item.lastWrongInputs.join(" / ") }}</p>
    </div>
    <button v-if="!item.mastered" class="base-button base-button--text" @click="markMastered(char)">
      标记掌握 ✓
    </button><span v-else class="badge badge--success">已掌握</span>
  </section>
</template>
<style scoped>
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
@media (max-width: 480px) {
  .recall-row {
    gap: 12px;
    grid-template-columns: 32px minmax(0, 1fr);
  }
  .recall-row > button,
  .recall-row > .badge {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
