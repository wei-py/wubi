<script setup>
import { computed } from "vue";

const props = defineProps({
  total: { type: Number, required: true },
  done: { type: Number, required: true },
  current: { type: Number, required: true },
  bests: { type: Array, default: () => [] },
});

const emit = defineEmits(["select"]);

const indexes = computed(() =>
  Array.from({ length: Math.max(0, Math.floor(props.total)) }, (_, i) => i),
);

function isCurrent(index) {
  return index === props.current;
}

function isPassed(index) {
  return (props.bests[index] ?? 0) > 0 && !isCurrent(index);
}

function cellTitle(index) {
  const base = `第 ${index + 1} 组`;
  const best = props.bests[index];
  if (typeof best === "number" && Number.isFinite(best)) {
    return `${base} · 最佳 ${best.toFixed(1)} 字/分`;
  }
  return base;
}

function onSelect(index) {
  emit("select", index);
}
</script>

<template>
  <div class="tp">
    <div class="tp__head">
      <span class="tp__summary">已练 {{ props.done }}/{{ props.total }} 组</span>
      <span class="tp__hint">所有组均可自由选择、重复练习</span>
    </div>

    <div class="tp__grid">
      <button
        v-for="index in indexes"
        :key="index"
        type="button"
        class="tp__cell"
        :class="{
          'tp__cell--passed': isPassed(index),
          'tp__cell--current': isCurrent(index),
        }"
        :title="cellTitle(index)"
        :aria-current="isCurrent(index) ? 'step' : undefined"
        @click="onSelect(index)"
      >
        {{ index + 1 }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tp {
  display: grid;
  gap: 12px;
  padding: 16px 0;
}
.tp__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
  font-size: 14px;
  color: var(--color-text-muted);
}
.tp__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tp__cell {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.tp__cell:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
.tp__cell--passed {
  border-color: var(--color-success);
  color: var(--color-success);
}
.tp__cell--current {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}
.tp__cell--current:hover {
  color: var(--color-surface);
}
</style>
