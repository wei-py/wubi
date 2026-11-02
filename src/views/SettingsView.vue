<script setup>
import dayjs from "dayjs";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSave } from "@/composables/useSave.js";
import { useUiSettings } from "@/composables/useUiSettings.js";
import Dialog from "@/shared/Dialog.vue";
const { save, exportSave, importSave, resetAll } = useSave();
const { scheme } = useUiSettings();
const route = useRoute();
const fileInput = ref(null);
const message = ref("");
const error = ref(false);
const pending = ref("");
const pendingText = ref("");
const fileName = ref("");
const summary = computed(() => ({
  passed: Object.values(save.value.progress.levels).filter((level) => level.passed).length,
  mistakes: Object.keys(save.value.mistakes).length,
  chars: Object.keys(save.value.stats).length,
}));
watch(
  () => route.hash,
  async (hash) => {
    if (hash === "#export") {
      await nextTick();
      document.getElementById("export-section")?.scrollIntoView({ block: "center" });
    }
  },
  { immediate: true },
);
function download() {
  const url = URL.createObjectURL(new Blob([exportSave()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `wubi-${scheme.value}-${dayjs().format("YYYYMMDD-HHmmss")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message.value = "已生成存档下载，请保留此文件以便恢复。";
  error.value = false;
}
async function chooseFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingText.value = await file.text();
    fileName.value = file.name;
    pending.value = "import";
  } catch {
    message.value = "无法读取文件，请重新选择。";
    error.value = true;
  }
  event.target.value = "";
}
function confirm() {
  if (pending.value === "reset") {
    resetAll();
    message.value = "当前方案的数据已清空，所有关卡仍然开放。";
    error.value = false;
  } else {
    const result = importSave(pendingText.value);
    error.value = !result.ok;
    message.value = result.ok
      ? "存档已导入，课程、错字和统计已恢复。"
      : result.error || "存档格式不正确，原数据未改变。";
  }
  pending.value = "";
  pendingText.value = "";
}
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / SETTINGS & DATA</span>
    <h1>把进步，好好保存</h1>
    <p class="paper-lead">
      {{ scheme === "wubi98" ? "98 王码" : "86 版" }} ·
      数据只保存在当前浏览器。两套方案独立记录，不需要注册账号。
    </p>
  </header>
  <nav class="section-tabs" aria-label="设置导航">
    <RouterLink to="/settings" aria-current="page">存档管理</RouterLink><RouterLink to="/appearance">外观与练习偏好</RouterLink>
  </nav>
  <dl class="stats-summary">
    <div>
      <dt>已完成课程</dt>
      <dd>{{ summary.passed }}<small> / 43</small></dd>
    </div>
    <div>
      <dt>记录的错字</dt>
      <dd>{{ summary.mistakes }}</dd>
    </div>
    <div>
      <dt>练过的汉字</dt>
      <dd>{{ summary.chars }}</dd>
    </div>
  </dl>
  <p v-if="message" role="status" class="notice" :class="{ 'notice--error': error }">
    {{ message }}
  </p>
  <section id="export-section" class="form-section">
    <h2>导出存档</h2>
    <p>下载当前方案的课程成绩、错字与单字统计。更换浏览器、清理浏览数据或换设备前，建议先备份。</p>
    <button class="base-button base-button--primary" @click="download">导出 JSON 存档 ↗</button>
  </section>
  <section class="form-section">
    <h2>导入存档</h2>
    <p>
      导入此前备份的 JSON 文件，将覆盖当前方案的数据。导入前会再次确认；你也可以先导出当前存档。
    </p>
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept="application/json,.json"
      aria-label="选择存档文件"
      @change="chooseFile"
    /><button class="base-button" @click="fileInput.click()">选择文件导入</button>
  </section>
  <section class="form-section">
    <h2>重新开始</h2>
    <p>
      只清空当前
      {{
        scheme === "wubi98" ? "98 王码" : "86 版"
      }}
      的成绩、错字和统计，不影响另一套方案。清空后无法撤销，关卡依然全部开放。
    </p>
    <button class="base-button reset-button" @click="pending = 'reset'">清空当前方案数据</button>
  </section>
  <section class="form-section reading">
    <h2>来源与许可</h2>
    <p>
      课程、练习引擎与码表基于
      <a href="https://github.com/LtyWK/wubi-practice" target="_blank" rel="noopener noreferrer">LtyWK / wubi-practice</a>，依 GPL-3.0 发布；86 码表来源于 RIME rime-wubi，98 码表来源于 98wb / yanhuacuo。UI
      与技术栈沿用本地 Herdr 学习站。
    </p>
  </section>
  <Dialog
    :open="Boolean(pending)"
    :title="pending === 'reset' ? '清空当前方案数据？' : '覆盖当前存档？'"
    @close="pending = ''"
  >
    <p class="reading">
      {{
        pending === "reset"
          ? "课程成绩、错字记录与单字统计会被清空，无法撤销。另一套五笔方案不受影响。"
          : `将使用「${fileName}」覆盖当前方案的成绩、错字与统计。建议先导出备份。`
      }}
    </p>
    <template #footer>
      <button class="base-button" @click="pending = ''">取消</button><button class="base-button base-button--primary" @click="confirm">
        {{ pending === "reset" ? "确认清空" : "确认导入" }}
      </button>
    </template>
  </Dialog>
</template>
<style scoped>
.file-input {
  display: none;
}
.reset-button {
  color: var(--danger);
  border-color: var(--danger);
}
.stats-summary small {
  color: var(--ink-muted);
  font-size: 13px;
}
</style>
