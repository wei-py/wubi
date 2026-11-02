<script setup>
const props = defineProps({
  title: { type: String, required: true },
  paragraphs: { type: Array, required: true },
});

const emit = defineEmits(["done"]);
</script>

<template>
  <section class="intro">
    <header class="intro__head">
      <span class="intro__tag">教学关</span>
      <h1 class="intro__title">{{ props.title }}</h1>
    </header>

    <div class="intro__body">
      <p v-for="(p, i) in props.paragraphs" :key="i" class="intro__p">{{ p }}</p>
    </div>

    <footer class="intro__foot">
      <button class="btn btn--primary" @click="emit('done')">已阅读，返回关卡</button>
    </footer>
  </section>
</template>

<style scoped>
.intro {
  width: 100%;
  max-width: 760px;
  display: grid;
  gap: 24px;
}
.intro__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 16px;
}
.intro__tag {
  color: var(--color-text-muted);
  font-size: 14px;
}
.intro__title {
  font-size: 24px;
  font-weight: 500;
}
.intro__body {
  border-block: 1px solid var(--color-border);
  padding: 24px 0;
}
.intro__p {
  margin: 0 0 16px;
  line-height: 1.9;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.intro__p:last-child {
  margin-bottom: 0;
}
.intro__foot {
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding: 10px 16px;
  border: 1px solid var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
  cursor: pointer;
}
</style>
