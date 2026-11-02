<script setup>
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
  title: { type: String, required: true },
  speed: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  elapsedMs: { type: Number, required: true },
  keystrokes: Number,
  rank: String,
  passed: { type: Boolean, default: undefined },
  passLabel: String,
  errors: { type: Array, default: () => [] },
  nextLabel: String,
  show: { type: Boolean, default: true },
});

const emit = defineEmits(["retry", "next", "close"]);
const panel = ref(null);
watch(
  () => props.show,
  async (show) => {
    if (show) {
      await nextTick();
      panel.value?.focus();
    }
  },
  { immediate: true },
);

const metrics = computed(() => {
  const list = [
    { label: "速度", value: props.speed.toFixed(0), unit: "字/分" },
    { label: "正确率", value: `${Math.round(props.accuracy * 100)}%` },
    { label: "用时", value: (props.elapsedMs / 1000).toFixed(1), unit: "秒" },
  ];
  if (props.keystrokes !== undefined) {
    list.push({ label: "击键", value: props.keystrokes.toFixed(1), unit: "键/秒" });
  }
  return list;
});

const rankClass = computed(() => (props.rank ? `result__rank--${props.rank.toLowerCase()}` : ""));

const shownErrors = computed(() => props.errors.slice(0, 20));

const restErrors = computed(() => Math.max(0, props.errors.length - 20));
</script>

<template>
  <section
    v-if="props.show"
    ref="panel"
    class="result"
    tabindex="-1"
    aria-labelledby="typing-result-title"
  >
    <header class="result__head">
      <div class="result__heading">
        <div class="result__title-row">
          <h2 id="typing-result-title" class="result__title">{{ props.title }}</h2>
          <span
            v-if="props.passed !== undefined"
            class="result__pass"
            :class="props.passed ? 'result__pass--ok' : 'result__pass--fail'"
          >
            {{ props.passed ? "达标" : "未达标" }}
          </span>
        </div>
        <p v-if="props.passLabel" class="result__pass-label">{{ props.passLabel }}</p>
      </div>
      <span v-if="props.rank" class="result__rank" :class="rankClass">{{ props.rank }}</span>
    </header>

    <dl class="result__metrics">
      <div v-for="metric in metrics" :key="metric.label" class="result__metric">
        <dt class="result__metric-label">{{ metric.label }}</dt>
        <dd class="result__metric-value">
          {{ metric.value }}
          <span v-if="metric.unit" class="result__metric-unit">{{ metric.unit }}</span>
          <span v-if="metric.note" class="result__metric-note">{{ metric.note }}</span>
        </dd>
      </div>
    </dl>

    <section v-if="props.errors.length > 0" class="result__section">
      <h3 class="result__subtitle">
        错误字
        <span class="result__count">{{ props.errors.length }}</span>
      </h3>
      <ul class="result__error-list">
        <li
          v-for="(err, i) in shownErrors"
          :key="`${err.char}-${i}`"
          class="result__error-item"
          :title="`目标字：${err.char} · 错误输入：${err.input || '（空）'}`"
        >
          <span class="result__error-char">{{ err.char }}</span>
          <span class="result__error-arrow">→</span>
          <span class="result__error-input">{{ err.input || "（空）" }}</span>
        </li>
      </ul>
      <p v-if="restErrors > 0" class="result__more">另有 {{ restErrors }} 条未显示</p>
    </section>

    <div class="result__actions">
      <button type="button" class="btn" @click="emit('retry')">重试</button>
      <button v-if="props.nextLabel" type="button" class="btn btn--primary" @click="emit('next')">
        {{ props.nextLabel }}
      </button>
      <button type="button" class="btn btn--ghost" @click="emit('close')">关闭</button>
    </div>
  </section>
</template>

<style scoped>
.result {
  width: 100%;
  padding: 24px 0;
  border-top: 1px solid var(--color-border);
}
.result__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.result__heading {
  min-width: 0;
}
.result__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.result__title {
  font-size: 24px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.result__pass {
  padding: 4px 8px;
  border: 1px solid currentColor;
  font-size: 14px;
}
.result__pass--ok {
  color: var(--color-success);
}
.result__pass--fail {
  color: var(--color-danger);
}
.result__pass-label {
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 14px;
}
.result__rank {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border: 1px solid var(--color-border);
  font-size: 28px;
}
.result__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 20px;
  margin: 0 0 24px;
  padding: 20px 0;
  border-block: 1px solid var(--color-border);
}
.result__metric-label {
  color: var(--color-text-muted);
  font-size: 14px;
}
.result__metric-value {
  margin: 4px 0 0;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
.result__metric-unit,
.result__metric-note {
  color: var(--color-text-muted);
  font-size: 14px;
}
.result__metric-note {
  display: block;
}
.result__subtitle {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 500;
}
.result__count {
  margin-left: 6px;
  color: var(--color-danger);
  font-size: 14px;
}
.result__error-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}
.result__error-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  font-size: 16px;
}
.result__error-arrow,
.result__more {
  color: var(--color-text-muted);
  font-size: 14px;
}
.result__error-input {
  color: var(--color-danger);
  overflow-wrap: anywhere;
}
.result__more {
  margin-top: 12px;
}
.result__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}
.btn {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.btn:hover {
  border-color: var(--color-text);
}
.btn--primary {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}
.btn--ghost {
  color: var(--color-text-muted);
}
</style>
