<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
const props = defineProps({ open: Boolean, title: { type: String, required: true } });
const emit = defineEmits(["close"]);
const dialog = ref(null);
const titleId = useId();
let previousFocus;
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      previousFocus = document.activeElement;
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <dialog
    ref="dialog"
    class="base-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
  >
    <header class="base-dialog__header">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="base-button base-button--text" aria-label="关闭对话框" @click="emit('close')">
        ×
      </button>
    </header>
    <div class="base-dialog__body scroll-section"><slot /></div>
    <footer v-if="$slots.footer" class="base-dialog__footer"><slot name="footer" /></footer>
  </dialog>
</template>
