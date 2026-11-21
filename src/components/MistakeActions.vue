<script setup>
import { computed } from "vue";
import { useMistakes } from "@/composables/useMistakes.js";

const props = defineProps({
  levelId: { type: String, required: true },
  char: { type: String, default: "" },
  code: { type: String, default: "" },
});
const { book, add, clear } = useMistakes(() => props.levelId);
const included = computed(() => Boolean(book.value[props.char]));
</script>

<template>
  <div class="mistake-actions">
    <button
      type="button"
      class="base-button"
      :disabled="!char || !code"
      @click="included ? clear(char) : add(char, code)"
    >
      {{ included ? "删除当前错题" : "添加当前题到错题" }}
    </button>
    <RouterLink :to="{ path: '/recall', query: { level: levelId } }" class="base-button base-button--text">
      本关错题（{{ Object.keys(book).length }}）↗
    </RouterLink>
  </div>
</template>

<style scoped>
.mistake-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
