<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { flushSave, useSave } from "./composables/useSave.js";
import { useUiSettings } from "./composables/useUiSettings.js";
import { STAGES } from "./data/stages.js";
import { SCHEME_LABELS } from "./schemes/catalog.js";
import Dialog from "./shared/Dialog.vue";
const route = useRoute();
const router = useRouter();
const { save } = useSave();
const { scheme, setScheme } = useUiSettings();
const root = ref(null);
const helpOpen = ref(false);
const scrollTop = ref(0);
const positions = new Map();
const count = STAGES.reduce((total, stage) => total + stage.levels.length, 0);
const completed = computed(
  () =>
    STAGES.flatMap((stage) => stage.levels).filter(
      (level) => save.value.progress.levels[level.id]?.passed,
    ).length,
);
const navigation = [
  { path: "/", title: "课程" },
  { path: "/free", title: "练习" },
  { path: "/reference", title: "速查" },
  { path: "/recall", title: "回忆" },
];
const active = computed(() =>
  route.name === "play" || route.name === "typing" ? "/free" : route.path,
);
const removeBefore = router.beforeEach((to, from) => {
  if (to.path !== from.path) positions.set(from.path, root.value?.scrollTop || 0);
});
watch(
  () => route.path,
  async () => {
    await nextTick();
    if (root.value) root.value.scrollTop = positions.get(route.path) || 0;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  },
);
onBeforeUnmount(removeBefore);
function changeScheme(event) {
  flushSave();
  setScheme(event.target.value);
  window.location.reload();
}
function skip() {
  document.getElementById("main-content")?.focus();
}
</script>
<template>
  <a href="#main-content" class="skip-link" @click.prevent="skip">跳到主要内容</a>
  <div ref="root" class="learning-shell" @scroll.passive="scrollTop = $event.target.scrollTop">
    <header class="learning-topbar">
      <div class="learning-topbar__inner">
        <RouterLink to="/" class="learning-brand"><span class="learning-brand__mark" aria-hidden="true">&gt;_</span>五笔学习</RouterLink>
        <label class="scheme-control">输入方案
          <select :value="scheme" aria-label="输入方案" @change="changeScheme">
            <option v-for="(label, id) in SCHEME_LABELS" :key="id" :value="id">{{ label }}</option>
          </select>
        </label>
        <nav class="learning-nav" aria-label="主要导航">
          <RouterLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            class="base-button base-button--text"
            :aria-current="active === item.path ? 'page' : undefined"
          >{{ item.title }}</RouterLink>
        </nav>
        <div class="learning-tools">
          <button class="base-button base-button--text" @click="helpOpen = true">帮助</button>
          <RouterLink to="/settings" class="base-button base-button--text">设置</RouterLink>
          <RouterLink to="/settings#export" class="base-button base-button--text">导出 ↗</RouterLink>
        </div>
      </div>
    </header>
    <div class="learning-meta">
      <span>WUBI / 从字根到自由表达</span><span class="learning-progress">课程 {{ completed }} / {{ count }} · 全部开放</span>
    </div>
    <div class="learning-columns">
      <main id="main-content" class="learning-main" tabindex="-1">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </RouterView>
        <footer class="page-footer">
          <span>慢慢来，让手指记住汉字。</span><a
            href="https://github.com/LtyWK/wubi-practice"
            target="_blank"
            rel="noopener noreferrer"
          >课程与码表来源 ↗</a>
        </footer>
      </main>
    </div>
    <button
      v-show="scrollTop > 400"
      class="base-button learning-backtop"
      @click="root.scrollTo({ top: 0, behavior: 'instant' })"
    >
      ↑ 顶部
    </button>
    <Dialog :open="helpOpen" title="开始学习五笔" @close="helpOpen = false">
      <div class="reading">
        <p>
          第一次接触五笔？建议从字根启蒙开始，但你可以随时进入任意关卡、任意分组，无需先完成前面的课程。
        </p>
        <h3>两种练习方式</h3>
        <p>
          <strong>字根、简码、识别码：</strong>切换到英文输入状态，直接按字母键。字根一键作答；汉字按编码输入，简码用空格提交。
        </p>
        <p>
          <strong>常用字、词组、挑战与自由练习：</strong>使用电脑上的五笔输入法输入汉字。网页记录速度、正确率和错字，不替代系统输入法。
        </p>
        <p>
          尚未安装五笔输入法，也可以先练字根与编码。请确保系统输入法版本与页面顶部选择的方案一致。
        </p>
        <h3>成绩与保存</h3>
        <p>
          速度与正确率是学习参考，不影响选关。各方案的进度独立保存在当前浏览器；换设备前请在设置中导出存档。
        </p>
      </div>
    </Dialog>
  </div>
</template>
