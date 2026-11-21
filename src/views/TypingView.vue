<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CodeHint from "@/components/CodeHint.vue";
import MistakeActions from "@/components/MistakeActions.vue";
import StatsBar from "@/components/StatsBar.vue";
import TypingProgress from "@/components/TypingProgress.vue";
import TypingResult from "@/components/TypingResult.vue";
import VirtualKeyboard from "@/components/VirtualKeyboard.vue";
import { useFreeText } from "@/composables/useFreeText.js";
import { useMistakes } from "@/composables/useMistakes.js";
import { useSave } from "@/composables/useSave.js";
import { useTypingInput } from "@/composables/useTypingInput.js";
import { useUiSettings } from "@/composables/useUiSettings.js";
import { loadArticles, loadCommon3500, loadWords, loadZigen } from "@/data/loader.js";
import { findLevel } from "@/data/stages.js";
import { rankFromChars, rankFromEndlessChars, rankFromSpeed } from "@/engine/rank.js";
import { MIN_LIVE_WINDOW_MS } from "@/engine/stats.js";
import {
  createTypingSession,
  feedBackspace,
  feedChar,
  startTyping,
  typingStats,
} from "@/engine/typing.js";
import { ensureScheme, getScheme } from "@/schemes/registry.js";
import Dialog from "@/shared/Dialog.vue";

const route = useRoute();
const router = useRouter();
const {
  getTypingProgress,
  recordTypingGroup,
  reshuffleTyping,
  recordLevelResult,
  getEndlessBest,
  recordEndlessBest,
} = useSave();
const { freeTitle, freeText } = useFreeText();

const levelId = computed(() => String(route.params.id));
const { record: recordMistake } = useMistakes(levelId);
const isFree = computed(() => levelId.value === "free");
const level = computed(() => (isFree.value ? undefined : findLevel(levelId.value)));
const config = computed(() => level.value?.typing);
const mode = computed(() => (isFree.value ? "free" : (config.value?.mode ?? "climb")));
const require = computed(() => level.value?.require ?? { speed: 0, accuracy: 0 });

const pageTitle = computed(() => {
  if (isFree.value) return freeTitle.value || "自由练习";
  return level.value?.title ?? "跟打练习";
});

// ---------- 通用状态 ----------
const { scheme: uiScheme, align, setAlign } = useUiSettings();
const scheme = computed(() => getScheme(uiScheme.value));

/** 键位 → 字根表条目（虚拟键盘渲染，与编码练习关一致） */
const zigenMap = ref({});

const inputEl = ref(null);
const reshuffleOpen = ref(false);
const { focus: focusInput } = useTypingInput(inputEl, {
  onText,
  onBackspace,
  onKey,
  enabled: canInput,
});
const panelBox = ref(null);
const ready = ref(false);
const session = ref(createTypingSession([]));
const now = ref(Date.now());
/** 显示项（含标点/换行装饰）：为空时按纯汉字流渲染 */
const display = ref(null);
/** 目标切换计数：用于长文本自动滚回当前字 */
const sessionToken = ref(0);

/** 虚拟键盘物理按键高亮（按下后短暂点亮） */
const pressedKey = ref("");
let pressTimer;
const PRESS_FLASH_MS = 180;

/**
 * 击键统计（跟打器口径，适配用户任意输入法）：
 * 统计真实物理按键（含 IME 组字期间的字母 / 数字选字 / 空格 / 退格）；
 * 计时起点为首次物理按键（session.startAt，由 startTyping 注入），含首字输入时间。
 */
const keyCount = ref(0);

/** 当前方案码表是否已加载（拆字提示就绪） */
const schemeReady = ref(false);

/** 组/段达标后的短暂提示，1200ms 后自动推进 */
const advancePending = ref(false);
const bannerText = ref("");
let advanceTimer;

// ---------- 结果 ----------
const resultVisible = ref(false);
const resultRecord = ref(null);
const resultTitle = ref("");
const resultPassed = ref(undefined);
const resultPassLabel = ref("");
const resultRank = ref(undefined);
const resultNextLabel = ref("");
let resultRetryFn = null;
let resultNextFn = null;

const EMPTY_RECORD = {
  speed: 0,
  accuracy: 1,
  elapsedMs: 0,
  done: 0,
  keyCount: 0,
  errors: [],
};
const shownRecord = computed(() => resultRecord.value ?? EMPTY_RECORD);

/** 结算击键速度（键/秒） */
const shownKeySpeed = computed(() => {
  const record = shownRecord.value;
  return record.elapsedMs > 0 ? (record.keyCount * 1000) / record.elapsedMs : 0;
});

// ---------- 统计 ----------
/**
 * 实时统计：完成前按至少 1 秒窗口计算，避免开始瞬间样本过少导致速度虚高；
 * 完成与结算使用真实用时（引擎口径不变）。
 */
const liveStats = computed(() => {
  const base = typingStats(session.value, now.value);
  if (session.value.finishedAt !== null) return base;
  const start = session.value.startAt;
  if (start === null) return base;
  const elapsedMs = Math.max(now.value - start, MIN_LIVE_WINDOW_MS);
  return { ...base, speed: base.done > 0 ? (base.done * 60000) / elapsedMs : 0 };
});
const goalChars = computed(() => config.value?.charTarget ?? 0);

/** 实时击键速度（键/秒）：物理按键数 ÷ 计时区间（完成前同样按最小窗口） */
const keySpeed = computed(() => {
  const start = session.value.startAt;
  if (start === null) return 0;
  const finished = session.value.finishedAt;
  const end = finished ?? now.value;
  const elapsedMs = finished !== null ? end - start : Math.max(end - start, MIN_LIVE_WINDOW_MS);
  return elapsedMs > 0 ? (keyCount.value * 1000) / elapsedMs : 0;
});
const displayDone = computed(() => liveStats.value.done);
const displayTotal = computed(() => {
  if (mode.value === "sprint" || mode.value === "endless") {
    return goalChars.value || session.value.target.length;
  }
  return session.value.target.length;
});

function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 合并多段成绩：速度/正确率取简单平均，用时与击键累加（键速按合计重算） */
function mergeRecords(records) {
  const elapsedMs = records.reduce((sum, record) => sum + record.elapsedMs, 0);
  const done = records.reduce((sum, record) => sum + record.done, 0);
  const keyCount = records.reduce((sum, record) => sum + record.keyCount, 0);
  return {
    speed: average(records.map((record) => record.speed)),
    accuracy: average(records.map((record) => record.accuracy)),
    elapsedMs,
    done,
    keyCount,
    errors: records.flatMap((record) => record.errors),
  };
}

function makeRecord() {
  const finishedAt = session.value.finishedAt ?? Date.now();
  const stats = typingStats(session.value, finishedAt);
  return {
    speed: stats.speed,
    accuracy: stats.accuracy,
    elapsedMs: stats.elapsedMs,
    done: stats.done,
    keyCount: keyCount.value,
    errors: session.value.errors.map((error) => ({
      char: session.value.target[error.index] ?? "",
      input: error.input,
    })),
  };
}

// ---------- 文本来源工具 ----------
function isHanChar(char) {
  return /[\u3400-\u9FFF]/.test(char);
}

function hanChars(text) {
  return [...text].filter(isHanChar);
}

/** 原文 → 引擎目标汉字 + 显示项：标点与换行仅装饰显示，不参与跟打（自由模式与耐力关保留排版） */
function buildDisplay(text) {
  const chars = [];
  const items = [];
  const lines = text.split("\n");
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) items.push({ kind: "br" });
    for (const char of line) {
      if (char === "\r") continue;
      if (isHanChar(char)) {
        items.push({ kind: "char", char, index: chars.length });
        chars.push(char);
      } else {
        items.push({ kind: "punct", char });
      }
    }
  });
  return { chars, items };
}

async function loadArraySource(source) {
  if (source === "common3500") return loadCommon3500();
  if (source === "words2" || source === "words3" || source === "words4") {
    const words = await loadWords();
    return words[source];
  }
  return [];
}

/** 按 7:2:1 权重从二/三/四字词中抽取不重复的 count 个词（种子随机，综合抽样用） */
function sampleMixedWords(words, count, rand) {
  const pools = [
    { list: words.words2, weight: 7 },
    { list: words.words3, weight: 2 },
    { list: words.words4, weight: 1 },
  ].filter((pool) => pool.list.length > 0);
  if (pools.length === 0) return [];
  const totalWeight = pools.reduce((sum, pool) => sum + pool.weight, 0);
  const picked = [];
  const seen = new Set();
  let guard = count * 60;
  while (picked.length < count && guard > 0) {
    guard -= 1;
    let roll = rand() * totalWeight;
    let pool = pools[pools.length - 1];
    for (const candidate of pools) {
      roll -= candidate.weight;
      if (roll <= 0) {
        pool = candidate;
        break;
      }
    }
    const word = pool.list[Math.floor(rand() * pool.list.length)];
    if (seen.has(word)) continue;
    seen.add(word);
    picked.push(word);
  }
  return picked;
}

/**
 * 数组源综合目标（普通跟打，全键位综合形式）：
 * 每次进入从全源池随机抽取 sample 个字/词（不重复）；词组以不换行空格分隔显示。
 */
async function buildArrayTarget(cfgValue) {
  const count = cfgValue.sample ?? 200;
  if (cfgValue.source === "words-mix") {
    const words = await loadWords();
    const picked = sampleMixedWords(words, count, Math.random);
    const chars = [];
    const items = [];
    for (const word of picked) {
      if (items.length > 0) items.push({ kind: "punct", char: "\u00A0" });
      for (const char of word) {
        items.push({ kind: "char", char, index: chars.length });
        chars.push(char);
      }
    }
    return { chars, items };
  }
  const pool = await loadArraySource(cfgValue.source);
  const [start, end] = cfgValue.range ?? [0, pool.length];
  const chars = shuffleWith(pool.slice(start, end), Math.random).slice(0, count);
  return { chars, items: null };
}

async function loadChosenArticles(ids) {
  const articles = await loadArticles();
  return (ids ?? [])
    .map((id) => articles.find((article) => article.id === id))
    .filter((article) => Boolean(article));
}

/** 手写 mulberry32：同一种子重建同一排列（存档只存种子） */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(items, rand) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function shuffle(items) {
  return shuffleWith(items, Math.random);
}

/** 循环乱序拼接：用于冲刺/文章类长文本，避免同一轮内相邻重复 */
function rotatePool(base, size) {
  const pool = [...new Set(base)];
  if (pool.length === 0 || size <= 0) return [];
  const out = [];
  while (out.length < size) {
    const round = shuffle(pool);
    const prev = out[out.length - 1];
    if (prev !== undefined && round[0] === prev && round.length > 1) {
      const index = round.findIndex((char) => char !== prev);
      if (index > 0) {
        const tmp = round[0];
        round[0] = round[index];
        round[index] = tmp;
      }
    }
    out.push(...round);
  }
  return out.slice(0, size);
}

// ---------- 目标与结果 ----------
function clearAdvance() {
  if (advanceTimer !== undefined) {
    window.clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }
  advancePending.value = false;
  bannerText.value = "";
}

function showBanner(text) {
  bannerText.value = text;
  advancePending.value = true;
}

function scheduleAdvance(action) {
  if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
  advanceTimer = window.setTimeout(() => {
    advanceTimer = undefined;
    advancePending.value = false;
    bannerText.value = "";
    action();
  }, 1200);
}

function startTarget(chars, items = null) {
  clearAdvance();
  resultVisible.value = false;
  resultRecord.value = null;
  display.value = items;
  keyCount.value = 0;
  session.value = createTypingSession(chars);
  sessionToken.value += 1;
  now.value = Date.now();
  void nextTick(() => {
    syncFocusRect();
    focusInput();
  });
}

function showResult(options) {
  clearAdvance();
  resultRecord.value = options.record ?? makeRecord();
  resultTitle.value = options.title;
  resultPassed.value = options.passed;
  resultPassLabel.value = options.passLabel ?? "";
  resultRank.value = options.rank;
  resultNextLabel.value = options.nextLabel ?? "";
  resultRetryFn = options.retry ?? null;
  resultNextFn = options.next ?? null;
  resultVisible.value = true;
  now.value = Date.now();
}

function handleResultRetry() {
  const retry = resultRetryFn;
  resultVisible.value = false;
  resultRetryFn = null;
  resultNextFn = null;
  if (retry) retry();
}

function handleResultNext() {
  const next = resultNextFn;
  resultVisible.value = false;
  resultRetryFn = null;
  resultNextFn = null;
  if (next) next();
}

function goBack() {
  router.push(isFree.value ? "/free" : "/");
}

function handleResultClose() {
  goBack();
}

// ---------- 爬坡（S4/S5） ----------
const climbSource = ref([]);
const climbSeed = ref(undefined);
const groupIndex = ref(0);
const currentGroup = ref(0);
const groupBests = ref([]);

const isClimb = computed(() => mode.value === "climb");
const groupSize = computed(() => config.value?.groupSize ?? 10);

/** 参考速度档位；影响成绩提示，不限制选组和练习顺序。 */
const CLIMB_SPEEDS = [35, 50, 70];
function initialClimbSpeed() {
  const configured = config.value?.groupSpeed ?? 0;
  return CLIMB_SPEEDS.includes(configured) ? configured : CLIMB_SPEEDS[1];
}
const climbSpeed = ref(initialClimbSpeed());
const groupSpeed = computed(() => climbSpeed.value);

/** 切换参考速度并恢复输入焦点。 */
function setClimbSpeed(speed) {
  climbSpeed.value = speed;
  void nextTick(() => focusInput());
}
const climbGroups = computed(() => {
  const sorted =
    climbSeed.value === undefined
      ? climbSource.value
      : shuffleWith(climbSource.value, mulberry32(climbSeed.value));
  const groups = [];
  for (let i = 0; i < sorted.length; i += groupSize.value) {
    groups.push(sorted.slice(i, i + groupSize.value));
  }
  return groups;
});
const totalGroups = computed(() => climbGroups.value.length);
const climbSourceUnit = computed(() => (config.value?.source === "common3500" ? "字" : "词"));

/** 每组目标：组内条目每次开始随机排序（重来 / 回打均换序），避免背固定字序；词组保持词内顺序 */
function groupChars(index) {
  const items = climbGroups.value[index] ?? [];
  return shuffle(items).flatMap((item) => [...item]);
}

function rememberGroupBest(index, speed) {
  const bests = [...groupBests.value];
  for (let i = bests.length; i < index; i += 1) bests[i] = 0;
  bests[index] = Math.max(bests[index] ?? 0, speed);
  groupBests.value = bests;
}

function startGroup(index) {
  if (index < 0 || index >= totalGroups.value) return;
  currentGroup.value = index;
  startTarget(groupChars(index));
}

function onSelectGroup(index) {
  if (!isClimb.value) return;
  if (index === currentGroup.value) return;
  startGroup(index);
}

function completeClimbLevel() {
  const bestSpeed = Math.max(0, ...groupBests.value);
  const lastStats = typingStats(session.value, session.value.finishedAt ?? Date.now());
  const rank = rankFromSpeed(bestSpeed, groupSpeed.value, lastStats.accuracy);
  const completedCount = climbGroups.value.filter(
    (_, index) => (groupBests.value[index] ?? 0) > 0,
  ).length;
  const completed = completedCount === totalGroups.value;
  const firstUnfinished = climbGroups.value.findIndex((_, index) => !(groupBests.value[index] > 0));
  recordLevelResult(levelId.value, bestSpeed, lastStats.accuracy, completed, 0, rank);
  showResult({
    title: `${level.value?.title ?? "常用字爬坡"} · ${completed ? "全部练习完成" : "本次练习完成"}`,
    passed: completed ? true : undefined,
    passLabel: `已练 ${completedCount}/${totalGroups.value} 组 · 最佳单组 ${bestSpeed.toFixed(0)} 字/分 · 参考 ${groupSpeed.value} 字/分`,
    rank,
    record: { ...makeRecord(), speed: bestSpeed },
    retry: () => startGroup(Math.min(currentGroup.value, totalGroups.value - 1)),
    nextLabel: firstUnfinished >= 0 ? `练习第 ${firstUnfinished + 1} 组` : undefined,
    next: firstUnfinished >= 0 ? () => startGroup(firstUnfinished) : undefined,
  });
}

function completeClimbGroup() {
  const index = currentGroup.value;
  const stats = typingStats(session.value, session.value.finishedAt ?? Date.now());
  const limitMs = (session.value.target.length * 60000) / groupSpeed.value;
  const passed = stats.elapsedMs <= limitMs + 1e-6;

  // 速度只用于成绩反馈，不限制练习顺序。
  recordTypingGroup(levelId.value, index + 1, stats.speed);
  rememberGroupBest(index, stats.speed);
  groupIndex.value = Math.max(groupIndex.value, index + 1);
  const next = index + 1;
  const completedAll = climbGroups.value.every((_, group) => (groupBests.value[group] ?? 0) > 0);
  const tail = completedAll
    ? "全部练习完成"
    : next >= totalGroups.value
      ? "本次练习结束"
      : `即将进入第 ${next + 1} 组`;
  showBanner(`本组${passed ? "达标" : "完成"} · ${stats.speed.toFixed(0)} 字/分 · ${tail}`);
  scheduleAdvance(() => {
    if (completedAll || next >= totalGroups.value) completeClimbLevel();
    else startGroup(next);
  });
}

async function setupClimb(cfgValue) {
  const source = await loadArraySource(cfgValue.source);
  const [start, end] = cfgValue.range ?? [0, source.length];
  climbSource.value = source.slice(start, end);
  const saved = getTypingProgress(levelId.value);
  climbSeed.value = saved?.shuffleSeed;
  groupBests.value = [...(saved?.groupBests ?? [])];
  groupIndex.value = Math.min(Math.max(0, saved?.groupIndex ?? 0), climbGroups.value.length);
  if (climbGroups.value.length === 0) {
    router.replace("/");
    return false;
  }
  startGroup(Math.min(groupIndex.value, totalGroups.value - 1));
  return true;
}

function onReshuffle() {
  if (!isClimb.value) return;
  reshuffleOpen.value = false;
  const seed = Math.floor(Math.random() * 0xFFFFFFFF) || 1;
  reshuffleTyping(levelId.value, seed);
  climbSeed.value = seed;
  groupIndex.value = 0;
  groupBests.value = [];
  startGroup(0);
}

// ---------- 限时冲刺（S6） ----------
const sprintPool = ref([]);
const sprintRemaining = computed(() => {
  const duration = config.value?.durationSec ?? 180;
  const startAt = session.value.startAt;
  if (startAt === null) return duration;
  return Math.max(0, duration - (now.value - startAt) / 1000);
});

function sprintExpired() {
  const startAt = session.value.startAt;
  if (startAt === null) return false;
  return Date.now() - startAt >= (config.value?.durationSec ?? 180) * 1000;
}

function finishSprint() {
  if (resultVisible.value) return;
  const record = makeRecord();
  const done = session.value.pos;
  const target = config.value?.charTarget ?? 0;
  const passed = done >= target;
  const rank = rankFromChars(done, target);
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank);
  showResult({
    title: "限时冲刺结束",
    passed,
    passLabel: `${config.value?.durationSec ?? 180} 秒内 ≥${target} 字 · 本局 ${done} 字`,
    rank,
    record,
    retry: () => startTarget(sprintPool.value),
  });
}

async function setupSprint(cfgValue) {
  // 诗词内容默认居中（仍可手动切换）
  setAlign("center");
  const chosen = await loadChosenArticles(cfgValue.articleIds);
  const base = chosen.flatMap((article) => hanChars(article.paragraphs.join("\n")));
  if (base.length === 0) {
    router.replace("/");
    return false;
  }
  sprintPool.value = rotatePool(base, cfgValue.poolSize ?? 2000);
  startTarget(sprintPool.value);
  return true;
}

// ---------- 逐段提速 / 综合测试共用段落状态 ----------
const segmentIndex = ref(0);
const segmentRecords = ref([]);

function addSegmentRecord(record) {
  segmentRecords.value = [...segmentRecords.value, record];
}

// ---------- 逐段提速（S6） ----------
const speedSegments = ref([]);

function speedupThreshold(index) {
  const list = config.value?.speedup ?? [];
  if (list.length === 0) return require.value.speed || 60;
  return list[Math.min(index, list.length - 1)];
}

function startSpeedupSegment(index) {
  if (index < 0 || index >= speedSegments.value.length) return;
  segmentIndex.value = index;
  startTarget(speedSegments.value[index]);
}

function completeSpeedupSegment() {
  const index = segmentIndex.value;
  const record = makeRecord();
  const threshold = speedupThreshold(index);
  if (record.speed < threshold) {
    showResult({
      title: `第 ${index + 1} 段未达标`,
      passed: false,
      passLabel: `本段要求 ≥${threshold} 字/分`,
      record,
      retry: () => startSpeedupSegment(index),
      nextLabel: index + 1 < speedSegments.value.length ? "继续下一段" : "查看总成绩",
      next: () => {
        addSegmentRecord(record);
        if (index + 1 < speedSegments.value.length) startSpeedupSegment(index + 1);
        else finishSpeedupLevel();
      },
    });
    return;
  }
  addSegmentRecord(record);
  if (index + 1 >= speedSegments.value.length) {
    finishSpeedupLevel();
    return;
  }
  showBanner(
    `第 ${index + 1} 段达标 · ${record.speed.toFixed(0)} 字/分 · 即将进入第 ${index + 2} 段`,
  );
  scheduleAdvance(() => startSpeedupSegment(index + 1));
}

function finishSpeedupLevel() {
  const merged = mergeRecords(segmentRecords.value);
  const rank = rankFromSpeed(merged.speed, require.value.speed || 60, merged.accuracy);
  const passed = segmentRecords.value.every(
    (record, index) => record.speed >= speedupThreshold(index),
  );
  recordLevelResult(levelId.value, merged.speed, merged.accuracy, passed, 0, rank);
  showResult({
    title: `${level.value?.title ?? "逐段提速"} · 练习完成`,
    passed,
    passLabel: `共 ${speedSegments.value.length} 段 · 平均 ${merged.speed.toFixed(0)} 字/分`,
    rank,
    record: merged,
    retry: () => {
      segmentRecords.value = [];
      startSpeedupSegment(0);
    },
  });
}

async function setupSpeedup(cfgValue) {
  // 宋词 / 古文内容默认居中（仍可手动切换）
  setAlign("center");
  const chosen = await loadChosenArticles(cfgValue.articleIds);
  const segments = chosen
    .flatMap((article) => article.paragraphs.map((paragraph) => hanChars(paragraph)))
    .filter((chars) => chars.length > 0);
  if (segments.length === 0) {
    router.replace("/");
    return false;
  }
  speedSegments.value = segments;
  segmentRecords.value = [];
  startSpeedupSegment(0);
  return true;
}

// ---------- 耐力 / 综合跟打（marathon：文章或数组源一次打完） ----------
const marathonDisplay = ref(null);

function finishMarathon() {
  const record = makeRecord();
  const passed = record.speed >= require.value.speed && record.accuracy >= require.value.accuracy;
  const rank = rankFromSpeed(record.speed, require.value.speed, record.accuracy);
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank);
  showResult({
    title: passed
      ? `${level.value?.title ?? "耐力"} · 达标`
      : `${level.value?.title ?? "耐力"} · 未达标`,
    passed,
    passLabel: `≥${require.value.speed} 字/分 · 正确率 ≥${Math.round(require.value.accuracy * 100)}%`,
    rank,
    record,
    retry: () => {
      const built = marathonDisplay.value;
      if (built) startTarget(built.chars, built.items);
    },
  });
}

async function setupMarathon(cfgValue) {
  // 文章源：保留标点排版；数组源（综合关）：每次进入随机抽样 200 字/词，一次打完
  const built =
    cfgValue.source === "article"
      ? buildDisplay(
          (await loadChosenArticles(cfgValue.articleIds))
            .map((article) => article.paragraphs.join("\n"))
            .join("\n"),
        )
      : await buildArrayTarget(cfgValue);
  if (built.chars.length === 0) {
    router.replace("/");
    return false;
  }
  marathonDisplay.value = built;
  startTarget(built.chars, built.items);
  return true;
}

// ---------- 无尽（S6） ----------
const endlessPool = ref([]);
const endlessBest = ref(0);
const endlessRemaining = computed(() =>
  Math.max(0, (config.value?.errorLimit ?? 10) - session.value.errors.length),
);

function endlessErrorLimit() {
  return config.value?.errorLimit ?? 10;
}

/** 按 7:2:1 权重随机混合二字/三字/四字词，拼至目标字数 */
function buildWordMix(words, size) {
  const pools = [
    { list: words.words2, weight: 7 },
    { list: words.words3, weight: 2 },
    { list: words.words4, weight: 1 },
  ].filter((pool) => pool.list.length > 0);
  if (pools.length === 0) return [];
  const totalWeight = pools.reduce((sum, pool) => sum + pool.weight, 0);
  const out = [];
  while (out.length < size) {
    let pick = pools[pools.length - 1];
    let roll = Math.random() * totalWeight;
    for (const pool of pools) {
      roll -= pool.weight;
      if (roll <= 0) {
        pick = pool;
        break;
      }
    }
    const word = pick.list[Math.floor(Math.random() * pick.list.length)];
    out.push(...hanChars(word));
  }
  return out.slice(0, size);
}

function finishEndless() {
  if (resultVisible.value) return;
  const record = makeRecord();
  const done = session.value.pos;
  if (done > getEndlessBest()) recordEndlessBest(done);
  endlessBest.value = getEndlessBest();
  const target = config.value?.charTarget ?? 0;
  const passed = done >= target;
  const rank = rankFromEndlessChars(done, target);
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank);
  showResult({
    title: "无尽词流结束",
    passed,
    passLabel: `单局 ≥${target} 字 · 本局 ${done} 字 · 历史纪录 ${endlessBest.value} 字`,
    rank,
    record,
    retry: () => startTarget(endlessPool.value),
  });
}

async function setupEndless(cfgValue) {
  const words = await loadWords();
  endlessPool.value = buildWordMix(words, cfgValue.poolSize ?? 3000);
  if (endlessPool.value.length === 0) {
    router.replace("/");
    return false;
  }
  endlessBest.value = getEndlessBest();
  startTarget(endlessPool.value);
  return true;
}

// ---------- 毕业综合（S6） ----------
const gauntletTargets = ref([]);
const gauntletSpeeds = ref([]);

function startGauntletSegment(index) {
  if (index < 0 || index >= gauntletTargets.value.length) return;
  segmentIndex.value = index;
  startTarget(gauntletTargets.value[index]);
}

function completeGauntletSegment() {
  const index = segmentIndex.value;
  const record = makeRecord();
  const threshold = gauntletSpeeds.value[index] ?? 60;
  if (record.speed < threshold) {
    showResult({
      title: `第 ${index + 1} 段未达标`,
      passed: false,
      passLabel: `本段要求 ≥${threshold} 字/分`,
      record,
      retry: () => startGauntletSegment(index),
      nextLabel: index + 1 < gauntletTargets.value.length ? "继续下一段" : "查看总成绩",
      next: () => {
        addSegmentRecord(record);
        if (index + 1 < gauntletTargets.value.length) startGauntletSegment(index + 1);
        else finishGauntlet();
      },
    });
    return;
  }
  addSegmentRecord(record);
  if (index + 1 >= gauntletTargets.value.length) {
    finishGauntlet();
    return;
  }
  showBanner(
    `第 ${index + 1} 段达标 · ${record.speed.toFixed(0)} 字/分 · 即将进入第 ${index + 2} 段`,
  );
  scheduleAdvance(() => startGauntletSegment(index + 1));
}

function finishGauntlet() {
  const merged = mergeRecords(segmentRecords.value);
  const rank = rankFromSpeed(merged.speed, require.value.speed || 60, merged.accuracy);
  const passed = segmentRecords.value.every(
    (record, index) => record.speed >= (gauntletSpeeds.value[index] ?? 60),
  );
  recordLevelResult(levelId.value, merged.speed, merged.accuracy, passed, 0, rank);
  showResult({
    title: `${level.value?.title ?? "毕业综合"} · 练习完成`,
    passed,
    passLabel: `共 ${gauntletTargets.value.length} 段 · 平均 ${merged.speed.toFixed(0)} 字/分`,
    rank,
    record: merged,
    retry: () => {
      segmentRecords.value = [];
      startGauntletSegment(0);
    },
  });
}

async function setupGauntlet(cfgValue) {
  const targets = [];
  const speeds = [];
  for (const segment of cfgValue.segments ?? []) {
    let chars = [];
    if (segment.source === "article") {
      const chosen = await loadChosenArticles(segment.articleIds);
      const all = chosen.flatMap((article) => hanChars(article.paragraphs.join("\n")));
      chars = typeof segment.count === "number" ? all.slice(0, segment.count) : all;
    } else {
      const items = await loadArraySource(segment.source);
      const [start, end] = segment.range ?? [0, items.length];
      const picked = items.slice(start, end);
      const limited = typeof segment.count === "number" ? picked.slice(0, segment.count) : picked;
      chars = shuffle(limited.flatMap((item) => hanChars(item)));
    }
    if (chars.length > 0) {
      targets.push(chars);
      speeds.push(segment.speed);
    }
  }
  if (targets.length === 0) {
    router.replace("/");
    return false;
  }
  gauntletTargets.value = targets;
  gauntletSpeeds.value = speeds;
  segmentRecords.value = [];
  startGauntletSegment(0);
  return true;
}

// ---------- 自由模式 ----------
function setupFree() {
  const { chars, items } = buildDisplay(freeText.value);
  if (chars.length === 0) {
    router.replace("/free");
    return false;
  }
  startTarget(chars, items);
  return true;
}

function finishFree() {
  const { chars, items } = buildDisplay(freeText.value);
  showResult({
    title: "自由练习完成",
    record: makeRecord(),
    retry: () => startTarget(chars, items),
  });
}

// ---------- 输入处理 ----------
function canInput() {
  return (
    ready.value &&
    !resultVisible.value &&
    !advancePending.value &&
    session.value.finishedAt === null
  );
}

/** 物理按键 → 虚拟键盘键位标识（仅字母 / 空格 / 退格有对应键帽） */
function codeToKey(code) {
  if (code === "Space") return " ";
  if (code === "Backspace") return "Backspace";
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  return "";
}

/** 物理按键（含 IME 组字期间）：首次按键启动计时，累计击键并点亮虚拟键盘对应键帽 */
function onKey(code) {
  if (session.value.startAt === null) {
    session.value = startTyping(session.value, Date.now());
  }
  keyCount.value += 1;
  const key = codeToKey(code);
  if (!key) return;
  pressedKey.value = key;
  if (pressTimer !== undefined) window.clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined;
    pressedKey.value = "";
  }, PRESS_FLASH_MS);
}

function onTargetComplete() {
  switch (mode.value) {
    case "climb":
      completeClimbGroup();
      break;
    case "sprint":
      finishSprint();
      break;
    case "speedup":
      completeSpeedupSegment();
      break;
    case "marathon":
      finishMarathon();
      break;
    case "endless":
      finishEndless();
      break;
    case "gauntlet":
      completeGauntletSegment();
      break;
    default:
      finishFree();
      break;
  }
}

function onText(text) {
  if (!canInput()) return;
  if (mode.value === "sprint" && sprintExpired()) {
    finishSprint();
    return;
  }
  if (mode.value === "endless" && session.value.errors.length >= endlessErrorLimit()) {
    finishEndless();
    return;
  }

  for (const char of text) {
    if (!canInput()) break;
    const result = feedChar(session.value, char, Date.now());
    session.value = result.session;
    for (const event of result.events) {
      if (event.type !== "wrong") continue;
      const target = session.value.target[event.index];
      const code = scheme.value.code(target);
      if (code) recordMistake(target, code, event.input);
    }
    if (result.events.some((event) => event.type === "complete")) {
      onTargetComplete();
      break;
    }
    if (mode.value === "endless" && session.value.errors.length >= endlessErrorLimit()) {
      finishEndless();
      break;
    }
    if (mode.value === "sprint" && sprintExpired()) {
      finishSprint();
      break;
    }
  }
  now.value = Date.now();
}

function onBackspace() {
  if (!canInput()) return;
  if (mode.value === "sprint" && sprintExpired()) {
    finishSprint();
    return;
  }
  session.value = feedBackspace(session.value, Date.now()).session;
  now.value = Date.now();
}

// ---------- 推进 / 重开 ----------
function restart() {
  if (!ready.value) return;
  clearAdvance();
  resultVisible.value = false;
  switch (mode.value) {
    case "climb":
      startGroup(Math.min(currentGroup.value, Math.max(0, totalGroups.value - 1)));
      break;
    case "sprint":
      startTarget(sprintPool.value);
      break;
    case "speedup":
      startSpeedupSegment(segmentIndex.value);
      break;
    case "marathon": {
      const built = marathonDisplay.value;
      if (built) startTarget(built.chars, built.items);
      break;
    }
    case "endless":
      startTarget(endlessPool.value);
      break;
    case "gauntlet":
      startGauntletSegment(segmentIndex.value);
      break;
    default:
      setupFree();
      break;
  }
}

function onWindowKeydown(event) {
  if (event.key !== "Escape" || event.isComposing || !ready.value) return;
  event.preventDefault();
  restart();
}

// ---------- 实时显示 ----------
const modeInfo = computed(() => {
  switch (mode.value) {
    case "climb":
      if (totalGroups.value === 0) return "";
      return `第 ${Math.min(currentGroup.value + 1, totalGroups.value)}/${totalGroups.value} 组 · 每组 ${groupSize.value} ${climbSourceUnit.value}`;
    case "sprint":
      return `剩余 ${formatClock(sprintRemaining.value)} · 目标 ${goalChars.value} 字`;
    case "speedup":
      return `第 ${segmentIndex.value + 1}/${speedSegments.value.length} 段 · 本段要求 ≥${speedupThreshold(segmentIndex.value)} 字/分`;
    case "endless":
      return `已打 ${liveStats.value.done} 字 · 纪录 ${endlessBest.value} 字 · 剩余错误 ${endlessRemaining.value} 次`;
    case "gauntlet":
      return `第 ${segmentIndex.value + 1}/${gauntletTargets.value.length} 段 · 本段要求 ≥${gauntletSpeeds.value[segmentIndex.value] ?? 0} 字/分`;
    case "marathon":
      return `一次打完 · 达标 ≥${require.value.speed} 字/分 · 正确率 ≥${Math.round(require.value.accuracy * 100)}%`;
    default:
      return "自由练习 · 不计关卡进度";
  }
});

function charClass(index) {
  const pos = session.value.pos;
  return {
    "tv-char--done": index < pos,
    "tv-char--active": index === pos,
    "tv-char--error": index === pos && session.value.errorSlot !== null,
    "tv-char--pending": index > pos,
  };
}

function displayChar(index) {
  if (index === session.value.pos && session.value.errorSlot !== null) {
    return session.value.errorSlot;
  }
  return session.value.target[index] ?? "";
}

/** 渲染序列：有装饰项（标点/换行）用原文排版，否则按纯汉字流 */
const displayItems = computed(
  () => display.value ?? session.value.target.map((char, index) => ({ kind: "char", char, index })),
);

/** 网格布局（爬坡 / 毕业综合）：与文本面板网格一致，不提供对齐切换 */
const isGridLayout = computed(() => isClimb.value || mode.value === "gauntlet");

/** 文本对齐（全局设置，与编码练习关共用）：仅流式布局生效 */
const targetClasses = computed(() => ({
  "typing__target--grid": isGridLayout.value,
  "typing__target--flow": !isGridLayout.value,
  "typing__flow--center": !isGridLayout.value && align.value === "center",
  "typing__flow--left": !isGridLayout.value && align.value === "left",
}));

/** 切换对齐并恢复输入焦点 */
function handleAlign(value) {
  setAlign(value);
  void nextTick(() => focusInput());
}

/** 光标可见条件：进行中且目标未完成 */
const caretVisible = computed(
  () =>
    ready.value &&
    !resultVisible.value &&
    session.value.finishedAt === null &&
    session.value.target.length > 0,
);

const caretStyle = ref({});

/** 同步隐藏输入框与光标到当前待输入字的位置（IME 候选框跟随该位置出现） */
function syncFocusRect() {
  const box = panelBox.value;
  const input = inputEl.value;
  if (!box || !input) return;
  const active = box.querySelector('.tv-char[data-active="true"]');
  if (!active) {
    input.style.left = "0px";
    input.style.top = "0px";
    input.style.width = "1px";
    input.style.height = "1em";
    caretStyle.value = {};
    return;
  }
  const boxRect = box.getBoundingClientRect();
  const rect = active.getBoundingClientRect();
  const left = rect.left - boxRect.left + box.scrollLeft;
  const top = rect.top - boxRect.top + box.scrollTop;
  const height = Math.max(rect.height, 16);
  input.style.left = `${left}px`;
  input.style.top = `${top}px`;
  input.style.width = `${Math.max(rect.width, 6)}px`;
  input.style.height = `${height}px`;
  caretStyle.value = { left: `${left - 1}px`, top: `${top}px`, height: `${height}px` };
}

/** 跟打提示：当前待输入字的拆分、全码与简码（不参与输入判定） */
const hintData = computed(() => {
  if (!schemeReady.value || resultVisible.value || session.value.finishedAt !== null) return null;
  const char = session.value.target[session.value.pos];
  if (!char) return null;
  const code = scheme.value.code(char);
  if (!code) return null;
  return { char, code, items: scheme.value.hint(char), shorts: scheme.value.shorts(char) };
});

/** 长文本跟随当前字滚动；新目标（sessionToken 变化）重新定位；光标与输入框跟随 */
watch(
  () => [sessionToken.value, session.value.pos, session.value.errorSlot],
  async () => {
    await nextTick();
    const el = panelBox.value?.querySelector('.tv-char[data-active="true"]');
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    syncFocusRect();
    // 平滑滚动过程中再校准一次
    window.setTimeout(() => syncFocusRect(), 260);
  },
);

// ---------- 生命周期 ----------
let tickTimer;
let disposed = false;

function startTick() {
  if (tickTimer !== undefined) return;
  tickTimer = window.setInterval(() => {
    if (session.value.startAt === null || resultVisible.value) return;
    now.value = Date.now();
    if (mode.value === "sprint" && sprintExpired()) finishSprint();
  }, 100);
}

async function setupMode(cfgValue) {
  switch (cfgValue.mode) {
    case "climb":
      return setupClimb(cfgValue);
    case "sprint":
      return setupSprint(cfgValue);
    case "speedup":
      return setupSpeedup(cfgValue);
    case "marathon":
      return setupMarathon(cfgValue);
    case "endless":
      return setupEndless(cfgValue);
    case "gauntlet":
      return setupGauntlet(cfgValue);
    default:
      return false;
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onWindowKeydown);
  window.addEventListener("resize", syncFocusRect);

  // 字根键盘与拆字提示需要当前方案数据（后台加载，不阻塞练习）
  void ensureScheme(uiScheme.value).then(() => {
    schemeReady.value = true;
  });
  void loadZigen(uiScheme.value).then((data) => {
    zigenMap.value = Object.fromEntries(data.map((z) => [z.key, z]));
  });

  if (isFree.value) {
    if (!setupFree()) return;
    ready.value = true;
    startTick();
    return;
  }

  const lv = level.value;
  if (!lv || lv.type !== "typing" || !lv.typing) {
    router.replace("/");
    return;
  }
  const ok = await setupMode(lv.typing);
  if (!ok || disposed) return;
  ready.value = true;
  startTick();
});

onUnmounted(() => {
  disposed = true;
  window.removeEventListener("keydown", onWindowKeydown);
  window.removeEventListener("resize", syncFocusRect);
  if (tickTimer !== undefined) window.clearInterval(tickTimer);
  if (pressTimer !== undefined) window.clearTimeout(pressTimer);
  clearAdvance();
});
</script>

<template>
  <section class="typing">
    <header class="typing__bar">
      <button type="button" class="typing__back" @click="goBack">← 返回</button>
      <h1 class="typing__title">{{ pageTitle }}</h1>
      <div class="typing__actions">
        <button v-if="isClimb" type="button" class="typing__btn" @click="reshuffleOpen = true">
          重新随机
        </button>
        <button type="button" class="typing__btn" @click="restart">重开</button>
      </div>
    </header>
    <p class="typing__instruction">
      请启用电脑或手机上的真实五笔输入法，点击练习区后输入汉字。此模式接收输入法选字结果，不是直接输入英文字母；Esc
      重新开始当前练习。
    </p>
    <MistakeActions
      :level-id="levelId"
      :char="session.target[session.pos]"
      :code="schemeReady ? scheme.code(session.target[session.pos]) ?? '' : ''"
    />

    <StatsBar
      :speed="liveStats.speed"
      :accuracy="liveStats.accuracy"
      :done="displayDone"
      :total="displayTotal"
      :elapsed-sec="liveStats.elapsedMs / 1000"
      :keystrokes="keySpeed"
    />

    <p v-if="ready && !resultVisible" class="typing__mode">{{ modeInfo }}</p>

    <div v-if="ready && !resultVisible && isClimb" class="typing__climb-bar">
      <span class="typing__climb-label">参考速度</span>
      <span class="typing__climb-group">
        <button
          v-for="speed in CLIMB_SPEEDS"
          :key="speed"
          type="button"
          class="speed-btn"
          :class="{ 'speed-btn--active': climbSpeed === speed }"
          :aria-pressed="climbSpeed === speed"
          @click.stop="setClimbSpeed(speed)"
        >
          {{ speed }}
        </button>
      </span>
      <span class="typing__climb-unit">字/分</span>
      <span class="typing__climb-tip">
        每组完成后继续下一组；{{ groupSpeed }} 字/分仅作成绩参考，所有组都可自由选择。
      </span>
    </div>

    <p v-if="!ready" class="typing__loading">加载中…</p>

    <template v-else-if="!resultVisible">
      <section class="typing__stage" @click="focusInput">
        <div v-if="advancePending" class="typing__banner" role="status">{{ bannerText }}</div>
        <div v-if="ready && !isGridLayout" class="typing__align">
          <span class="typing__align-group">
            <button
              class="align-btn"
              :class="{ 'align-btn--active': align === 'center' }"
              :aria-pressed="align === 'center'"
              @click.stop="handleAlign('center')"
            >
              居中
            </button>
            <button
              class="align-btn"
              :class="{ 'align-btn--active': align === 'left' }"
              :aria-pressed="align === 'left'"
              @click.stop="handleAlign('left')"
            >
              左对齐
            </button>
          </span>
        </div>
        <div
          ref="panelBox"
          class="typing__target"
          :class="targetClasses"
          @scroll.passive="syncFocusRect"
        >
          <!-- 隐藏输入框与光标跟随当前待输入字（IME 候选框随之定位） -->
          <input
            ref="inputEl"
            class="typing__input"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="跟打输入"
          />
          <span v-if="caretVisible" class="typing__caret" :style="caretStyle"></span>
          <template v-for="(item, i) in displayItems" :key="`${sessionToken}-${i}-${item.kind}`">
            <br v-if="item.kind === 'br'" />
            <span v-else-if="item.kind === 'punct'" class="tv-punct">{{ item.char }}</span>
            <span
              v-else
              class="tv-char"
              :class="charClass(item.index)"
              :data-index="item.index"
              :data-active="item.index === session.pos ? 'true' : undefined"
              :title="
                item.index === session.pos && session.errorSlot
                  ? `错误输入：${session.errorSlot} · 正确：${item.char}`
                  : undefined
              "
            >{{ displayChar(item.index) }}</span>
          </template>
        </div>
        <p v-if="session.errorSlot" class="typing__error-hint">
          当前应为「{{ session.target[session.pos] }}」，刚输入「{{ session.errorSlot }}」
        </p>
      </section>

      <TypingProgress
        v-if="isClimb"
        :total="totalGroups"
        :done="groupBests.filter((best) => best > 0).length"
        :current="currentGroup"
        :bests="groupBests"
        @select="onSelectGroup"
      />

      <CodeHint
        v-if="hintData"
        :char="hintData.char"
        :code="hintData.code"
        :items="hintData.items"
        :shorts="hintData.shorts"
        input=""
      />

      <div class="typing__bottom">
        <div v-if="mode === 'endless'" class="typing__tools">
          <button type="button" class="typing__btn" @click="finishEndless">结束本局</button>
        </div>
        <VirtualKeyboard :press="pressedKey" :zigen="zigenMap" :interactive="false" />
      </div>
    </template>

    <TypingResult
      v-if="resultVisible"
      :title="resultTitle"
      :speed="shownRecord.speed"
      :accuracy="shownRecord.accuracy"
      :elapsed-ms="shownRecord.elapsedMs"
      :keystrokes="shownKeySpeed"
      :rank="resultRank"
      :passed="resultPassed"
      :pass-label="resultPassLabel"
      :errors="shownRecord.errors"
      :next-label="resultNextLabel || undefined"
      @retry="handleResultRetry"
      @next="handleResultNext"
      @close="handleResultClose"
    />
    <Dialog :open="reshuffleOpen" title="重新随机本关？" @close="reshuffleOpen = false">
      <p class="reading">
        将打乱本关文字顺序，并清除本关分组进度与分组最佳速度。其他课程的成绩不受影响。
      </p>
      <template #footer>
        <button class="base-button" @click="reshuffleOpen = false">取消</button>
        <button class="base-button base-button--primary" @click="onReshuffle">确认重新随机</button>
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.typing {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.typing__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.typing__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 400;
  overflow-wrap: anywhere;
}
.typing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.typing__back,
.typing__btn {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.typing__back:hover,
.typing__btn:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
.typing__instruction {
  max-width: 760px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.9;
}
.typing__mode {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
.typing__climb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.typing__climb-group,
.typing__align-group {
  display: inline-flex;
  border: 1px solid var(--color-border);
}
.speed-btn,
.align-btn {
  padding: 6px 12px;
  border: 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.speed-btn + .speed-btn,
.align-btn + .align-btn {
  border-left: 1px solid var(--color-border);
}
.speed-btn--active,
.align-btn--active {
  color: var(--color-text);
  background: var(--color-key-bg);
}
.typing__loading {
  padding: 24px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}
.typing__stage {
  position: relative;
  min-width: 0;
  padding: 24px 0;
  border-block: 1px solid var(--color-border);
  cursor: text;
}
/* The input follows the active glyph so the native IME candidate window stays nearby. */
.typing__input {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  width: 6px;
  height: 1em;
  padding: 0;
  margin: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  opacity: 0;
  font-size: 16px;
  cursor: text;
}
.typing__stage:focus-within {
  border-color: var(--color-text);
}
.typing__caret {
  position: absolute;
  z-index: 2;
  width: 2px;
  background: var(--color-text);
  pointer-events: none;
  animation: tv-caret-blink 1.06s steps(1) infinite;
}
@keyframes tv-caret-blink {
  0%,
  55% {
    opacity: 1;
  }
  56%,
  100% {
    opacity: 0.15;
  }
}
.tv-punct {
  color: var(--text-pending);
  user-select: none;
}
.typing__banner {
  margin-bottom: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 12px;
}
.typing__align {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.typing__target {
  position: relative;
  min-width: 0;
  user-select: text;
}
.typing__flow--center {
  text-align: center;
}
.typing__flow--left {
  text-align: left;
}
.typing__target--flow {
  max-height: 42vh;
  min-height: 120px;
  overflow: auto;
  padding-right: 8px;
  scrollbar-width: thin;
  font-size: 24px;
  line-height: 2;
  letter-spacing: 0.12em;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.typing__target--grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 8px;
  justify-items: center;
  max-height: 42vh;
  overflow: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  font-size: 28px;
  line-height: 1.8;
}
.tv-char--pending {
  color: var(--text-pending);
}
.tv-char--done {
  color: var(--color-success);
}
.tv-char--active {
  color: var(--color-text);
  background: var(--text-active-bg);
  text-decoration: underline;
  text-underline-offset: 7px;
}
.tv-char--error {
  color: var(--color-danger);
  text-decoration: underline wavy;
  text-underline-offset: 5px;
}
.typing__error-hint {
  margin-top: 12px;
  color: var(--color-danger);
  font-size: 12px;
  line-height: 1.8;
}
.typing__bottom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.typing__tools {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 640px) {
  .typing__title {
    order: -1;
    flex-basis: 100%;
  }
  .typing__target--grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    font-size: 24px;
  }
  .typing__target--flow {
    font-size: 20px;
    max-height: 36vh;
  }
}
@media (prefers-reduced-motion: reduce) {
  .typing__caret {
    animation: none;
  }
}
</style>
