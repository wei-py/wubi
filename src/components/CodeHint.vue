<script setup>
import { computed } from "vue";

import { useUiSettings } from "@/composables/useUiSettings.js";

const props = defineProps({
  char: { type: String, required: true },
  code: { type: String, required: true },
  items: { type: Array, required: true },
  input: { type: String, required: true },
  shorts: { type: Array, default: () => [] },
  guide: { type: Boolean, default: false },
});

const codeChars = computed(() => props.code.split(""));
const { codeHintOn, setCodeHint } = useUiSettings();

function shortName(len) {
  if (len === 1) return "一级简码";
  if (len === 2) return "二级简码";
  if (len === 3) return "三级简码";
  return `${len} 级简码`;
}
</script>

<template>
  <div class="hint-card">
    <div class="hint-card__head">
      <span class="hint-card__title">拆字提示</span>
      <button
        class="hint-card__toggle"
        :aria-expanded="codeHintOn"
        @click="setCodeHint(!codeHintOn)"
      >
        {{ codeHintOn ? "隐藏" : "显示" }}
      </button>
    </div>
    <div v-show="codeHintOn" class="hint-card__body">
      <div class="hint__line">
        <span class="hint__char">{{ props.char }}</span>
        <template v-if="props.items.length">
          <span class="hint__arrow">→</span>
          <span class="hint__roots">
            （<template v-for="(it, i) in props.items" :key="i"><span v-if="i > 0" class="hint__root-sep"> + </span><span class="hint__root">{{ it.text }}</span></template>）
          </span>
        </template>
        <span class="hint__arrow">→</span>
        <span class="hint__code">
          <span
            v-for="(c, i) in codeChars"
            :key="i"
            class="hint__code-char"
            :class="{ 'hint__code-char--typed': i < props.input.length }"
          >
            {{ c.toUpperCase() }}
          </span>
        </span>
      </div>
      <div v-if="props.shorts && props.shorts.length > 0" class="hint__shorts">
        <p v-if="props.guide" class="hint__short-guide">
          一级简码：打 1 个键 + 空格，共 25 个最常用字。<br />
          二级简码：打 2 个键 + 空格。<br />
          三级简码：打 3 个键 + 空格。
        </p>
        <div v-for="(short, i) in props.shorts" :key="i" class="hint__short-item">
          {{ shortName(short.length) }}：<span class="hint__short-key">{{
            short.toUpperCase()
          }}</span>
          + 空格
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint-card {
  padding: 16px 0;
  border-block: 1px solid var(--color-border);
}
.hint-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.hint-card__title,
.hint-card__toggle {
  font-size: 14px;
  color: var(--color-text-muted);
}
.hint-card__toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 6px 12px;
  cursor: pointer;
}
.hint-card__toggle:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
.hint-card__body {
  margin-top: 12px;
}
.hint__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 22px;
}
.hint__char,
.hint__code-char,
.hint__root {
  font-weight: 500;
}
.hint__arrow,
.hint__roots,
.hint__root-sep {
  color: var(--color-text-muted);
}
.hint__roots {
  font-size: 18px;
}
.hint__root {
  color: var(--color-text);
}
.hint__code {
  letter-spacing: 0.12em;
}
.hint__code-char--typed {
  color: var(--color-success);
}
.hint__shorts {
  margin-top: 12px;
  font-size: 14px;
}
.hint__short-guide {
  margin: 0 0 8px;
  color: var(--color-text-muted);
  line-height: 1.8;
}
.hint__short-item + .hint__short-item {
  margin-top: 6px;
}
.hint__short-key {
  display: inline-block;
  padding: 0 6px;
  border: 1px solid var(--color-border);
  letter-spacing: 0.08em;
}
</style>
