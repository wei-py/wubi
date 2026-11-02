<script setup>
import { computed, nextTick, ref, watch } from "vue";

import { useUiSettings } from "@/composables/useUiSettings.js";

const props = defineProps({
  items: { type: Array, required: true },
  title: { type: String, default: "" },
  layout: { type: String, default: "flow" },
});

const { align, setAlign } = useUiSettings();
const box = ref(null);

/** 网格布局单元：字符 + 在 items 中的下标（供自动滚动定位） */

/** 网格布局：每 20 个一行，行内每 10 个一组（两组中间空开） */
const gridRows = computed(() => {
  const cells = [];
  props.items.forEach((item, index) => {
    if (item.kind === "char") cells.push({ char: item.char, state: item.state, index });
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += 20) {
    const slice = cells.slice(i, i + 20);
    const groups = [];
    for (let j = 0; j < slice.length; j += 10) groups.push(slice.slice(j, j + 10));
    rows.push(groups);
  }
  return rows;
});

/** 当前字进入可视区时自动滚动 */
watch(
  () => props.items.findIndex((item) => item.kind === "char" && item.state === "active"),
  async (index) => {
    if (index < 0) return;
    await nextTick();
    const el = box.value?.querySelector(`.tp-char[data-index="${index}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  },
);
</script>

<template>
  <div class="text-panel">
    <div class="text-panel__head">
      <span class="text-panel__title">{{ props.title }}</span>
      <span v-if="props.layout === 'flow'" class="text-panel__align">
        <button
          class="align-btn"
          :class="{ 'align-btn--active': align === 'center' }"
          :aria-pressed="align === 'center'"
          @click="setAlign('center')"
        >
          居中
        </button>
        <button
          class="align-btn"
          :class="{ 'align-btn--active': align === 'left' }"
          :aria-pressed="align === 'left'"
          @click="setAlign('left')"
        >
          左对齐
        </button>
      </span>
    </div>
    <div ref="box" class="text-panel__box">
      <div v-if="props.layout === 'grid'" class="tp-grid">
        <div v-for="(row, ri) in gridRows" :key="ri" class="tp-grid__row">
          <div v-for="(group, gi) in row" :key="gi" class="tp-grid__group">
            <span
              v-for="cell in group"
              :key="cell.index"
              class="tp-char"
              :data-index="cell.index"
              :class="`tp-char--${cell.state}`"
            >{{ cell.char }}</span>
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-panel__text"
        :class="align === 'center' ? 'text-panel__text--center' : 'text-panel__text--left'"
      >
        <template v-for="(item, i) in props.items" :key="i">
          <br v-if="item.kind === 'br'" />
          <span v-else-if="item.kind === 'hint'" class="tp-hint">{{ item.text }}</span>
          <span v-else class="tp-char" :data-index="i" :class="`tp-char--${item.state}`">{{
            item.char
          }}</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.text-panel {
  min-width: 0;
  padding: 20px 0;
}
.text-panel__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.text-panel__title {
  font-size: 16px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.text-panel__align {
  display: inline-flex;
  border: 1px solid var(--color-border);
}
.align-btn {
  padding: 6px 10px;
  border: 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
}
.align-btn + .align-btn {
  border-left: 1px solid var(--color-border);
}
.align-btn--active {
  color: var(--color-text);
  background: var(--color-key-bg);
}
.text-panel__box {
  max-height: 32vh;
  min-height: 100px;
  overflow: auto;
  scrollbar-width: thin;
}
.text-panel__text {
  margin: 0;
  font-size: 24px;
  line-height: 2;
  letter-spacing: 0.12em;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.text-panel__text--center {
  text-align: center;
}
.text-panel__text--left {
  text-align: left;
}
.tp-grid {
  font-size: 24px;
  line-height: 2;
}
.tp-grid__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 24px;
}
.tp-grid__group {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  justify-items: center;
  align-items: center;
  width: min(100%, 330px);
}
.tp-char--pending {
  color: var(--text-pending);
}
.tp-char--active {
  color: var(--color-text);
  background: var(--text-active-bg);
  text-decoration: underline;
  text-underline-offset: 7px;
}
.tp-char--done-clean {
  color: var(--color-success);
}
.tp-char--done-wrong {
  color: var(--color-danger);
  text-decoration: underline wavy;
  text-underline-offset: 6px;
}
.tp-char--skip {
  color: var(--color-text-muted);
}
.tp-hint {
  display: block;
  margin-top: 12px;
  color: var(--color-text-muted);
  font-size: 16px;
  letter-spacing: 0.03em;
  line-height: 1.8;
}
@media (max-width: 640px) {
  .text-panel__text,
  .tp-grid {
    font-size: 22px;
  }
}
</style>
