<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useFreeText } from "@/composables/useFreeText.js";
import { loadArticles } from "@/data/loader.js";
const router = useRouter();
const { setFreeText } = useFreeText();
const articles = ref([]);
const title = ref("");
const text = ref("");
const message = ref("");
const hanCount = computed(() => [...text.value].filter((c) => /[\u4E00-\u9FFF]/.test(c)).length);
onMounted(async () => {
  try {
    articles.value = await loadArticles();
  } catch (error) {
    message.value = error.message;
  }
});
function start(content, name) {
  setFreeText(name, content);
  router.push("/typing/free");
}
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / FREE PRACTICE</span>
    <h1>练习，自由一点</h1>
    <p class="paper-lead">选一篇喜欢的文章，或者带上自己的文字。没有速度门槛，只专注于每一个字。</p>
  </header>
  <p class="notice">
    本页使用电脑上的五笔输入法输入汉字。字根与编码训练无需安装输入法，请前往「课程」。
  </p>
  <section class="form-section">
    <h2>自己的文字</h2>
    <form @submit.prevent="start(text.trim(), title.trim() || '自定义文本')">
      <label class="field-label">标题（可选）<input v-model="title" placeholder="给这次练习起个名字" /></label><label class="field-label">练习文本<textarea
        v-model="text"
        rows="6"
        placeholder="粘贴一段课文、笔记，或工作中经常输入的句子…"
      ></textarea>
      </label>
      <div class="toolbar">
        <button class="base-button base-button--primary" :disabled="hanCount === 0" type="submit">
          开始练习 ↗
        </button><span class="muted text-xs">{{ hanCount }} 个可练习汉字 · 标点与换行保留，不计入成绩</span>
      </div>
      <p v-if="text.trim() && !hanCount" class="notice notice--error">
        请至少输入一个汉字；数字、英文与标点不作为五笔练习题目。
      </p>
    </form>
  </section>
  <section class="course-group">
    <header class="course-group__heading">
      <span class="course-group__number">01</span>
      <h2>文章练习</h2>
      <span class="badge">{{ articles.length }} 篇</span>
    </header>
    <ul class="course-lessons">
      <li v-for="(article, index) in articles" :key="article.id">
        <button
          class="course-lesson"
          @click="start(article.paragraphs.join('\n'), `《${article.title}》`)"
        >
          <span class="course-lesson__number">{{ String(index + 1).padStart(2, "0") }}</span><span class="course-lesson__body"><span class="course-lesson__title">{{ article.title }}</span><span class="course-lesson__meta">{{ article.author }} · 难度 {{ article.difficulty }} / 5</span></span><span class="course-lesson__arrow" aria-hidden="true">↗</span>
        </button>
      </li>
    </ul>
    <p v-if="message" class="notice notice--error" role="alert">文章加载失败：{{ message }}</p>
  </section>
</template>
