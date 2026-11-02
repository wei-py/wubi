<script setup>
import { computed, ref } from "vue";
import { useLevels } from "@/composables/useLevels.js";
const { stages, isLevelPassed, levelResult, stageProgress } = useLevels();
const query = ref("");
const selected = ref("all");
const shown = computed(() =>
  stages
    .filter((stage) => selected.value === "all" || stage.id === selected.value)
    .map((stage) => ({
      ...stage,
      levels: stage.levels.filter((level) =>
        level.title.toLowerCase().includes(query.value.trim().toLowerCase()),
      ),
    }))
    .filter((stage) => stage.levels.length),
);
const total = stages.reduce((n, stage) => n + stage.levels.length, 0);
const passed = computed(() => stages.reduce((n, stage) => n + stageProgress(stage).passed, 0));
function rule(level) {
  if (level.type === "intro") return "阅读 · 原理与口诀";
  if (level.type === "zigen") return `${level.length} 题 · 字根键位`;
  const cfg = level.typing;
  if (cfg?.mode === "climb")
    return `${Math.ceil(level.length / cfg.groupSize)} 组 · 每组 ${cfg.groupSize}${cfg.source.startsWith("words") ? " 词" : " 字"}`;
  if (cfg?.mode === "sprint") return `${Math.round(cfg.durationSec / 60)} 分钟 · 限时冲刺`;
  if (cfg?.mode === "endless") return `无尽词流 · 错误上限 ${cfg.errorLimit} 次`;
  if (cfg?.mode === "gauntlet") return `${cfg.segments.length} 段 · 综合测试`;
  if (cfg?.mode === "speedup") return `${cfg.speedup.join(" → ")} 字/分 · 参考目标`;
  if (cfg?.source === "article") return `整篇跟打 · ${level.require.speed} 字/分参考目标`;
  return `${level.length + (cfg?.source?.startsWith("words") ? " 词" : " 字")} · ${cfg ? "汉字跟打" : "编码训练"}`;
}
function status(level) {
  const result = levelResult(level.id);
  if (!result) return "未练习";
  if (level.type === "intro") return "已阅读";
  return `最佳 ${Math.round(result.bestSpeed)}${level.type === "zigen" ? " 键/分" : " 字/分"}`;
}
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / LEARNING PATH</span>
    <h1>五笔，从这里开始</h1>
    <p class="paper-lead">
      从认识字根，到让汉字自然地落在指尖。6 个阶段，{{ total }} 个关卡，按自己的节奏练习。
    </p>
  </header>
  <div class="map-status">
    <span class="badge badge--success">全部关卡开放</span><span>无需解锁 · 不限顺序 · 可重复练习</span><span class="map-status__progress">已完成 {{ passed }} / {{ total }}</span>
  </div>
  <nav class="section-tabs" aria-label="课程阶段">
    <button :aria-pressed="selected === 'all'" @click="selected = 'all'">全部课程</button><button
      v-for="(stage, index) in stages"
      :key="stage.id"
      :aria-pressed="selected === stage.id"
      @click="selected = stage.id"
    >
      0{{ index + 1 }} {{ stage.title }}
    </button>
  </nav>
  <label class="search-label"><span class="i-carbon-search" aria-hidden="true"></span><input
    v-model="query"
    type="search"
    aria-label="搜索课程"
    placeholder="搜索课程，例如：字根、一级简码、诗词…"
  /></label>
  <section v-for="stage in shown" :key="stage.id" class="course-group">
    <header class="course-group__heading">
      <span class="course-group__number">{{
        String(stages.findIndex((s) => s.id === stage.id) + 1).padStart(2, "0")
      }}</span>
      <h2>{{ stage.title }}</h2>
      <span class="badge">{{ stageProgress(stages.find((s) => s.id === stage.id)).passed }} /
        {{ stages.find((s) => s.id === stage.id).levels.length }}</span>
    </header>
    <p class="course-group__description">{{ stage.description }}</p>
    <ul class="course-lessons">
      <li v-for="level in stage.levels" :key="level.id">
        <RouterLink
          :to="(level.type === 'typing' ? '/typing/' : '/play/') + level.id"
          class="course-lesson"
          :data-level-id="level.id"
        ><span class="course-lesson__number">{{
          String(
            stages.find((s) => s.id === stage.id).levels.findIndex((l) => l.id === level.id) + 1,
          ).padStart(2, "0")
        }}</span><span class="course-lesson__body"><span class="course-lesson__title">{{ level.title }}</span><span class="course-lesson__meta"><span>{{ rule(level) }}</span><span :class="{ complete: isLevelPassed(level.id) }">{{ status(level) }}{{ isLevelPassed(level.id) ? " ✓" : "" }}</span></span></span><span class="course-lesson__arrow" aria-hidden="true">↗</span></RouterLink>
      </li>
    </ul>
  </section>
  <div v-if="!shown.length" class="empty-state">
    没有找到“{{ query }}”相关课程。<button
      class="base-button base-button--text"
      @click="
        query = '';
        selected = 'all';
      "
    >
      清除筛选
    </button>
  </div>
  <p class="notice">
    初学建议：先练字根，再学简码和识别码。已有基础？直接选常用字、词组或文章挑战。速度目标仅供参考，不限制下一关。
  </p>
</template>
<style scoped>
.map-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: var(--ink-muted);
  font-size: 12px;
}
.map-status__progress {
  margin-left: auto;
}
.search-label {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 440px;
}
.search-label input {
  flex: 1;
  min-width: 0;
  border: 0;
  border-bottom: 1px solid var(--rule);
  padding-left: 0;
  font-size: 13px;
}
.search-label > span {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: var(--ink-muted);
}
@media (max-width: 480px) {
  .map-status__progress {
    margin-left: 0;
  }
}
</style>
