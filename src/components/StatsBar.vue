<script setup>
const props = defineProps({
  speed: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  done: { type: Number, required: true },
  total: { type: Number, required: true },
  elapsedSec: { type: Number, required: true },
  timeouts: Number,
  unit: { type: String, default: "字/分" },
  keystrokes: Number,
});

function pct(n) {
  return `${Math.round(n * 100)}%`;
}
</script>

<template>
  <div class="stats">
    <div class="stats__item">
      <span class="stats__label">速度</span>
      <span class="stats__value">{{ props.speed.toFixed(0) }}</span>
      <span class="stats__unit">{{ props.unit ?? "字/分" }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">正确率</span>
      <span class="stats__value">{{ pct(props.accuracy) }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">进度</span>
      <span class="stats__value">{{ props.done }}/{{ props.total }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">用时</span>
      <span class="stats__value">{{ props.elapsedSec.toFixed(0) }}</span>
      <span class="stats__unit">秒</span>
    </div>
    <div v-if="props.keystrokes !== undefined" class="stats__item">
      <span class="stats__label">击键</span>
      <span class="stats__value">{{ props.keystrokes.toFixed(1) }}</span>
      <span class="stats__unit">键/秒</span>
    </div>
    <div v-if="props.timeouts !== undefined" class="stats__item">
      <span class="stats__label">超时</span>
      <span class="stats__value" :class="{ 'stats__value--warn': props.timeouts > 0 }">
        {{ props.timeouts }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 32px;
  padding: 20px 0;
  border-block: 1px solid var(--color-border);
  font-variant-numeric: tabular-nums;
}
.stats__item {
  min-width: 76px;
}
.stats__label {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: 14px;
}
.stats__value {
  font-size: 24px;
  font-weight: 500;
}
.stats__value--warn {
  color: var(--color-warning);
}
.stats__unit {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-left: 4px;
}
@media (max-width: 480px) {
  .stats {
    gap: 16px 20px;
  }
  .stats__item {
    flex: 1 0 25%;
  }
  .stats__value {
    font-size: 22px;
  }
}
</style>
