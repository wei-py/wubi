<script setup>
const props = defineProps({
  highlight: { type: String, default: "" },
  feedback: { type: Object, default: null },
  sticky: { type: Object, default: null },
  zigen: Object,
  disabled: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true },
  press: { type: String, default: "" },
});

const emit = defineEmits(["press"]);

/** Keep pointer focus on the practice surface; native buttons also support keyboard activation. */
function onPress(key) {
  if (props.disabled || !props.interactive) return;
  emit("press", key);
}

/** QWERTY 三行（配合真实键盘） */
const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

function keyClass(key) {
  const f = props.feedback;
  const s = props.sticky;
  return {
    "vk__key--hint": props.highlight === key,
    "vk__key--sticky-ok": s?.key === key && s.type === "ok",
    "vk__key--sticky-bad": s?.key === key && s.type === "bad",
    "vk__key--flash-ok": f?.key === key && f.type === "ok",
    "vk__key--flash-bad": f?.key === key && f.type === "bad",
    "vk__key--flash-timeout": f?.key === key && f.type === "timeout",
    "vk__key--press": props.press === key,
  };
}

/** 取键位的布局格子（补齐到 size²） */
function cellsOf(key) {
  const z = props.zigen?.[key];
  if (!z) return [];
  const total = z.layout.size * z.layout.size;
  const cells = z.layout.cells.slice(0, total);
  while (cells.length < total) cells.push(null);
  return cells;
}

function sizeOf(key) {
  return props.zigen?.[key]?.layout.size ?? 5;
}
</script>

<template>
  <div class="vk" :class="{ 'vk--disabled': props.disabled, 'vk--display': !props.interactive }">
    <div
      v-for="(row, ri) in ROWS"
      :key="ri"
      class="vk__row"
      :class="{ 'vk__row--offset': ri === 2 }"
    >
      <component
        :is="props.interactive ? 'button' : 'span'"
        v-for="key in row"
        :key="key"
        class="vk__key"
        :class="keyClass(key)"
        :type="props.interactive ? 'button' : undefined"
        :disabled="props.disabled"
        :aria-label="`${key.toUpperCase()} 键`"
        @pointerdown.prevent
        @click="onPress(key)"
      >
        <!-- 字根矩阵 -->
        <span
          class="vk__grid"
          :data-size="sizeOf(key)"
          :style="{ gridTemplateColumns: `repeat(${sizeOf(key)}, 1fr)` }"
        >
          <span
            v-for="(cell, i) in cellsOf(key)"
            :key="i"
            class="vk__cell"
            :class="{
              'vk__cell--bold': cell?.bold,
              'vk__cell--red': cell?.mark === 'red',
              'vk__cell--green': cell?.mark === 'green',
            }"
          >
            <span v-if="cell" class="vk__root">{{ cell.cp }}</span>
          </span>
        </span>
        <!-- 底部信息条：字母 + 一级简码 -->
        <span class="vk__foot">
          <span class="vk__letter">{{ key.toUpperCase() }}</span>
          <span class="vk__short">{{ props.zigen?.[key]?.short1 ?? "" }}</span>
        </span>
      </component>
    </div>
    <div class="vk__row vk__row--bottom">
      <component
        :is="props.interactive ? 'button' : 'span'"
        class="vk__key vk__key--space"
        :class="keyClass(' ')"
        :type="props.interactive ? 'button' : undefined"
        :disabled="props.disabled"
        aria-label="空格键"
        @pointerdown.prevent
        @click="onPress(' ')"
      >
        空 格
      </component>
      <component
        :is="props.interactive ? 'button' : 'span'"
        class="vk__key vk__key--backspace"
        :type="props.interactive ? 'button' : undefined"
        :disabled="props.disabled"
        aria-label="退格键"
        @pointerdown.prevent
        @click="onPress('Backspace')"
      >
        ⌫
      </component>
    </div>
  </div>
</template>

<style scoped>
.vk {
  --vk-gap: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vk-gap);
  min-width: 0;
  padding: 20px 0;
  border-top: 1px solid var(--color-border);
  user-select: none;
}
.vk--disabled {
  opacity: 0.5;
}
.vk__row {
  display: flex;
  justify-content: center;
  gap: var(--vk-gap);
  width: 100%;
}
.vk--display .vk__key {
  cursor: default;
}
.vk--display .vk__key:hover {
  border-color: var(--color-border);
}
.vk__row--offset {
  transform: translateX(calc(-0.5 * (100% - 9 * var(--vk-gap)) / 10));
}
.vk__key {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: calc((100% - 9 * var(--vk-gap)) / 10);
  max-width: 92px;
  min-width: 0;
  aspect-ratio: 1 / 1.18;
  padding: 4px 4px 2px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
  overflow: hidden;
}
.vk__key:hover {
  border-color: var(--color-text);
}
.vk__key:disabled {
  cursor: not-allowed;
}
.vk__grid {
  display: grid;
  flex: 1;
  min-height: 0;
  align-content: stretch;
  container-type: inline-size;
}
.vk__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
.vk__root {
  font-family: "WubiRoots", "WubiRoots98", sans-serif;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text-muted);
}
.vk__grid[data-size="4"] .vk__root {
  font-size: 20cqw;
}
.vk__grid[data-size="5"] .vk__root {
  font-size: 16cqw;
}
.vk__cell--bold .vk__root {
  color: var(--color-text);
}
.vk__cell--red .vk__root {
  color: var(--color-danger);
}
.vk__cell--green .vk__root {
  color: var(--color-success);
}
.vk__foot {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 18px;
  margin-top: 2px;
  padding-top: 3px;
  border-top: 1px solid var(--color-border);
  line-height: 1;
}
.vk__letter {
  font-size: 14px;
  color: var(--color-text-muted);
}
.vk__short {
  font-size: 15px;
}
.vk__key--hint,
.vk__key--press {
  border-color: var(--color-text);
  background: var(--color-key-bg);
}
.vk__key--sticky-ok,
.vk__key--flash-ok {
  border-color: var(--color-success);
  background: var(--color-success-weak);
}
.vk__key--sticky-bad,
.vk__key--flash-bad {
  border-color: var(--color-danger);
  background: var(--color-danger-weak);
}
.vk__key--flash-timeout {
  border-color: var(--color-warning);
  background: var(--color-warning-weak);
}
.vk__key--space,
.vk__key--backspace {
  aspect-ratio: auto;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 16px;
}
.vk__key--space {
  flex: 1 1 auto;
  width: auto;
  max-width: 520px;
}
.vk__key--backspace {
  width: 72px;
}
@media (max-width: 640px) {
  .vk {
    --vk-gap: 3px;
    padding: 12px 0;
  }
  .vk__key {
    padding: 2px 1px 1px;
    aspect-ratio: 1 / 1.3;
  }
  .vk__foot {
    gap: 2px;
    min-height: 14px;
  }
  .vk__letter {
    font-size: 12px;
  }
  .vk__short {
    font-size: 12px;
  }
  .vk__key--space,
  .vk__key--backspace {
    aspect-ratio: auto;
    height: 36px;
  }
  .vk__key--backspace {
    width: 48px;
  }
}
</style>
