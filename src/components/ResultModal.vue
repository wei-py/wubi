<script setup>
import { nextTick, ref, watch } from "vue";

import MistakePicker from "./MistakePicker.vue";

const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, required: true },
  stats: { type: Object, required: true },
  passed: { type: Boolean, required: true },
  requirement: { type: Object, required: true },
  options: { type: Array, required: true },
  showPass: { type: Boolean, default: true },
  unit: { type: String, default: "字/分" },
});

const emit = defineEmits(["practice", "close"]);

const selected = ref([]);
const dialog = ref(null);

watch(
  () => props.visible,
  async (visible) => {
    if (visible) selected.value = props.options.map((option) => option.id);
    await nextTick();
    if (visible && !dialog.value?.open) dialog.value?.showModal();
    else if (!visible) dialog.value?.close();
  },
  { immediate: true },
);

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function onPractice() {
  if (selected.value.length > 0) emit("practice", [...selected.value]);
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="practice-result-title"
    @cancel.prevent="emit('close')"
  >
    <div class="modal__panel">
      <h2 id="practice-result-title" class="modal__title">{{ title }}</h2>
      <p
        v-if="props.showPass"
        class="modal__result"
        :class="passed ? 'modal__result--pass' : 'modal__result--fail'"
      >
        {{ passed ? "达标" : "未达标，可再练一次" }}
      </p>

      <dl class="modal__stats">
        <div>
          <dt>速度</dt>
          <dd>{{ stats.speed.toFixed(0) }} {{ props.unit }}</dd>
        </div>
        <div>
          <dt>正确率</dt>
          <dd>{{ pct(stats.accuracy) }}</dd>
        </div>
        <div>
          <dt>用时</dt>
          <dd>{{ stats.elapsedSec.toFixed(1) }} 秒</dd>
        </div>
        <div v-if="stats.keystrokes !== undefined">
          <dt>击键</dt>
          <dd>{{ stats.keystrokes.toFixed(1) }} 键/秒</dd>
        </div>
      </dl>
      <p v-if="props.showPass" class="modal__req">
        达标参考：≥ {{ requirement.speed }} {{ props.unit }} · ≥ {{ pct(requirement.accuracy) }}
      </p>

      <template v-if="options.length > 0">
        <h3 class="modal__sub">错误与超时清单</h3>
        <MistakePicker :options="options" @update:selected="(ids) => (selected = ids)" />
      </template>

      <div class="modal__actions">
        <button
          class="btn btn--primary"
          :disabled="options.length === 0 || selected.length === 0"
          @click="onPractice"
        >
          加练所选（{{ selected.length }}）
        </button>
        <button class="btn" @click="emit('close')">返回关卡</button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  overflow: auto;
}
.modal::backdrop {
  background: rgb(23 25 24 / 35%);
}
.modal__panel {
  padding: 24px;
}
.modal__title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 500;
}
.modal__result {
  margin-bottom: 20px;
  font-size: 16px;
}
.modal__result--pass {
  color: var(--color-success);
}
.modal__result--fail {
  color: var(--color-danger);
}
.modal__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 0 0 20px;
  padding: 20px 0;
  border-block: 1px solid var(--color-border);
}
.modal__stats dt {
  color: var(--color-text-muted);
  font-size: 14px;
}
.modal__stats dd {
  margin: 4px 0 0;
  font-size: 22px;
}
.modal__req {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 20px;
}
.modal__sub {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 500;
}
.modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.btn {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.btn--primary {
  background: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-surface);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@media (max-width: 480px) {
  .modal__panel {
    padding: 16px;
  }
}
</style>
