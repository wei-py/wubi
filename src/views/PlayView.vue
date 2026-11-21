<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { playKeySound } from "@/audio/sound.js";
import CodeHint from "@/components/CodeHint.vue";
import IntroPanel from "@/components/IntroPanel.vue";
import MistakeActions from "@/components/MistakeActions.vue";
import ResultModal from "@/components/ResultModal.vue";
import StatsBar from "@/components/StatsBar.vue";
import TextPanel from "@/components/TextPanel.vue";
import VirtualKeyboard from "@/components/VirtualKeyboard.vue";
import { useFreeText } from "@/composables/useFreeText.js";
import { useLevels } from "@/composables/useLevels.js";
import { useMistakes } from "@/composables/useMistakes.js";
import { useSave } from "@/composables/useSave.js";
import { useUiSettings } from "@/composables/useUiSettings.js";
import { loadArticles, loadRadicalWeights, loadZigen } from "@/data/loader.js";
import { buildLevelChars, isHan, randomSequence, weightedSequence } from "@/data/pool.js";
import { parseScript } from "@/data/script.js";
import { findLevel, stageOfLevel } from "@/data/stages.js";
import { createSession, feedKey, KEY_BACKSPACE } from "@/engine/judge.js";
import { MIN_LIVE_WINDOW_MS } from "@/engine/stats.js";
import { checkTimeout, elapsed, startChar } from "@/engine/timer.js";
import { ensureScheme, getScheme } from "@/schemes/registry.js";

/** 加练：每个错项的重复次数（总字数 = 错项数 × 该值） */
const DRILL_REPEAT = 10;

const route = useRoute();
const router = useRouter();
const { recordResult } = useLevels();
const { recordCharDone, recordCharError } = useSave();
const { freeTitle, freeText } = useFreeText();
const {
  soundOn,
  volume,
  setVolume,
  hintsOn,
  setHints,
  setAlign,
  scheme: uiScheme,
} = useUiSettings();

/** 当前输入方案实现（顶部下拉切换方案后刷新页面生效） */
const scheme = computed(() => getScheme(uiScheme.value));
const volumeOpen = ref(false);

function onVolumeInput(e) {
  setVolume(Number(e.target.value) / 100);
}

function testSound() {
  if (soundOn.value) playKeySound("ok", volume.value);
}

const levelId = computed(() => String(route.params.id));
const mistakeLevelId = computed(() => String(route.query.recallLevel ?? levelId.value));
const { book, record, markMastered } = useMistakes(mistakeLevelId);
const isFree = computed(() => levelId.value === "free");
const level = computed(() => (isFree.value ? undefined : findLevel(levelId.value)));
const isZigen = computed(() => level.value?.type === "zigen");
const isIntro = computed(() => level.value?.type === "intro");
const mode = computed(() => (isZigen.value ? "zigen" : "text"));
const articleMode = computed(() => level.value?.type === "article" || isFree.value);

// ---------- 通用状态 ----------
const now = ref(Date.now());
const started = ref(false);
const finished = ref(false);
const showResult = ref(false);
const drill = ref(false);
/** 暂停状态（暂停期间冻结计时与输入） */
const paused = ref(false);
const pauseDialog = ref(null);
watch(paused, async (value) => {
  await nextTick();
  if (value) pauseDialog.value?.showModal();
  else pauseDialog.value?.close();
});
let pausedAt = 0;
const feedback = ref(null);
const sticky = ref(null);
const charTimer = ref(startChar(0));
const sessionStartAt = ref(0);
const timeouts = ref(0);
/** 退格次数（击键统计附带，与引擎 totalKeys 相加） */
const backspaceCount = ref(0);
const streak = ref({});
const zigenMap = ref({});
/** 常用字根权重（常用字根强化训练用，按一级常用字使用频率降序） */
const radicalWeights = ref([]);
const articleTitle = ref("");
/** 本会话超时项（文本为汉字，字根为键位）→ 超时次数，用于加入加练 */
const timeoutCounts = ref({});

let tickTimer;
let timeoutTimer;
let fbTimer;

// ---------- 字根模式 ----------
/** 字根练习题：目标字根与对应键位 */
const zigenQueue = ref([]);
const zigenIndex = ref(0);
const zigenWrong = ref([]);
const currentError = ref("");
const zigenCorrectKeys = ref(0);
const zigenTotalKeys = ref(0);
/** 字根级错误次数（PUA 字根 → 次数），用于加练加权出题 */
const zigenRootErrors = ref({});

// ---------- 文本模式 ----------
const session = ref(null);
const displayMap = ref([]);
/** 脚本关（口诀训练）：解析后的脚本（提示行 + 训练行） */
const parsedScript = ref(null);
const scriptMode = computed(() => Boolean(level.value?.script?.length));

// ---------- 统计 ----------
const doneCount = computed(() =>
  mode.value === "zigen" ? zigenIndex.value : (session.value?.cursor ?? 0),
);
const totalCount = computed(() =>
  mode.value === "zigen" ? zigenQueue.value.length : (session.value?.items.length ?? 0),
);
const correctKeys = computed(() =>
  mode.value === "zigen" ? zigenCorrectKeys.value : (session.value?.correctKeys ?? 0),
);
const totalKeys = computed(() =>
  mode.value === "zigen" ? zigenTotalKeys.value : (session.value?.totalKeys ?? 0),
);
const stats = computed(() => {
  const startedAt = sessionStartAt.value;
  const elapsedMs = startedAt > 0 ? Math.max(0, now.value - startedAt) : 0;
  const elapsedSec = elapsedMs / 1000;
  // 实时显示按至少 1 秒窗口计算，避免首键瞬间速度虚高；完成与结算用真实用时
  const displayMs =
    startedAt > 0 ? (finished.value ? elapsedMs : Math.max(elapsedMs, MIN_LIVE_WINDOW_MS)) : 0;
  const displaySec = displayMs / 1000;
  const speed = displaySec > 0 ? (doneCount.value / displaySec) * 60 : 0;
  const accuracy = totalKeys.value === 0 ? 1 : correctKeys.value / totalKeys.value;
  // 击键（键/秒）：物理按键总数（编码击键含错误键与退格，与跟打器口径一致）
  const keys = totalKeys.value + backspaceCount.value;
  const keystrokes = displaySec > 0 ? keys / displaySec : 0;
  return { speed, accuracy, elapsedSec, keystrokes };
});
const unit = computed(() => (isZigen.value ? "键/分" : "字/分"));

// ---------- 文本展示 ----------
function stateOf(state, wrong) {
  if (state === "done") return wrong ? "done-wrong" : "done-clean";
  return state === "active" ? "active" : "pending";
}

/** 从键位池生成字根练习题：键位均匀分布且不连续重复，每题取该键的随机字根 */
function makeZigenTasks(pool, count) {
  return randomSequence(pool, count).map((key) => {
    // 打字训练使用完整字根列表（roots）
    const roots = zigenMap.value[key]?.roots ?? [];
    const root =
      roots.length > 0 ? roots[Math.floor(Math.random() * roots.length)] : key.toUpperCase();
    return { key, root };
  });
}

/** 字根 → 键位反查表（加练出题用） */
function rootKeyMap() {
  const map = new Map();
  for (const [key, item] of Object.entries(zigenMap.value)) {
    for (const root of item.roots) map.set(root, key);
  }
  return map;
}

/**
 * 字根加练：按错误次数线性加权随机出题，打错越多的字根出现频率越高。
 * 纯加权随机（不做键位均衡 / 连续去重，否则会抹平加权效果）。
 */
function makeDrillZigenTasks(roots) {
  const keyOf = rootKeyMap();
  const items = roots
    .map((root) => ({
      root,
      key: keyOf.get(root) ?? "",
      count: Math.max(1, zigenRootErrors.value[root] ?? 1),
    }))
    .filter((w) => w.key);
  if (items.length === 0) return [];
  const total = items.length * DRILL_REPEAT;
  const sum = items.reduce((a, b) => a + b.count, 0);
  const out = [];
  for (let n = 0; n < total; n += 1) {
    let r = Math.random() * sum;
    let pick = items[items.length - 1];
    for (const it of items) {
      r -= it.count;
      if (r <= 0) {
        pick = it;
        break;
      }
    }
    out.push({ key: pick.key, root: pick.root });
  }
  return out;
}

/** 常用字根强化：按常用字根权重加权出题，避免与上一题键位重复 */
function makeRadicalTasks(count) {
  if (radicalWeights.value.length === 0) {
    // 兜底：权重数据缺失时退回全键位随机
    return makeZigenTasks(Object.keys(zigenMap.value), count);
  }
  return weightedSequence(radicalWeights.value, count).map((w) => ({ key: w.key, root: w.root }));
}

/** 随机文字关卡（字根 / 单字）统一字符流：由 TextPanel 按容器宽度自动换行 */
const linearItems = computed(() => {
  if (mode.value === "zigen") {
    return zigenQueue.value.map((task, i) => {
      let state = "pending";
      if (i < zigenIndex.value) state = zigenWrong.value[i] ? "done-wrong" : "done-clean";
      else if (i === zigenIndex.value) state = "active";
      return { kind: "char", char: task.root, state };
    });
  }
  const src = session.value?.items ?? [];
  const cell = (it) => ({
    kind: "char",
    char: it.char,
    state: stateOf(it.state, it.wrongAttempts.length > 0),
  });
  // drill 关：每字连打的组独占一行（组尾换行）；随机段保持流式
  if (level.value?.pattern === "drill") {
    const out = [];
    let i = 0;
    while (i < src.length) {
      let j = i;
      while (j < src.length && src[j].char === src[i].char) j += 1;
      for (let k = i; k < j; k += 1) out.push(cell(src[k]));
      if (j - i >= 2 && j < src.length) out.push({ kind: "br" });
      i = j;
    }
    return out;
  }
  return src.map(cell);
});

const articleItems = computed(() => {
  const s = session.value;
  if (!s) return [];
  return displayMap.value.map((d, i) => {
    if (d.input >= 0) {
      const item = s.items[d.input];
      if (!item) return { kind: "char", char: d.char, state: "pending" };
      return {
        kind: "char",
        char: d.char,
        state: stateOf(item.state, item.wrongAttempts.length > 0),
      };
    }
    if (d.char === "\n") return { kind: "br" };
    let prev = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (displayMap.value[j].input >= 0) {
        prev = displayMap.value[j].input;
        break;
      }
    }
    const prevItem = prev >= 0 ? s.items[prev] : undefined;
    const done = prevItem ? prevItem.state === "done" : false;
    return { kind: "char", char: d.char, state: done ? "skip" : "pending" };
  });
});

/** 脚本关：提示行（不训练）+ 训练行（汉字绑定会话进度）+ 行尾换行 */
const scriptItems = computed(() => {
  const parsed = parsedScript.value;
  const s = session.value;
  if (!parsed) return [];
  const out = [];
  for (const line of parsed.lines) {
    if (line.kind === "hint") {
      out.push({ kind: "hint", text: line.text });
      continue;
    }
    if (line.kind === "blank") {
      out.push({ kind: "br" });
      continue;
    }
    for (const cell of line.cells) {
      if (cell.train) {
        const item = s?.items[cell.inputIndex];
        out.push({
          kind: "char",
          char: cell.char,
          state: item ? stateOf(item.state, item.wrongAttempts.length > 0) : "pending",
        });
      } else {
        out.push({ kind: "char", char: cell.char, state: "skip" });
      }
    }
    out.push({ kind: "br" });
  }
  return out;
});

const textItems = computed(() => {
  if (scriptMode.value) return scriptItems.value;
  if (articleMode.value) return articleItems.value;
  return linearItems.value;
});

/** 随机字/字根关（纯字符流，非脚本 / 文章 / drill）：使用每行 20 个的网格布局 */
const gridLayout = computed(
  () => !scriptMode.value && !articleMode.value && level.value?.pattern !== "drill",
);

/** 标题：大关（阶段）· 小关 */
const panelTitle = computed(() => {
  const lv = level.value;
  const stage = lv ? stageOfLevel(lv.id) : undefined;
  if (articleMode.value) {
    const base = articleTitle.value || "自由练习";
    return stage ? `${stage.title} · ${base}` : base;
  }
  if (!lv) return "";
  return stage ? `${stage.title} · ${lv.title}` : lv.title;
});

// ---------- 下一步按键 ----------
const highlight = computed(() => {
  // 关闭按键提示时不显示下一步高亮
  if (!hintsOn.value) return "";
  if (mode.value === "zigen") return zigenQueue.value[zigenIndex.value]?.key ?? "";
  const s = session.value;
  if (!s || s.finished) return "";
  const item = s.items[s.cursor];
  if (!item) return "";
  if (!s.requireFull && s.input.length > 0 && item.shorts.includes(s.input)) return " ";
  return item.code[s.input.length] ?? "";
});

// 关闭按键提示时清除残留的高亮与常亮
watch(hintsOn, (on) => {
  if (!on) {
    sticky.value = null;
    feedback.value = null;
  }
});

const currentHint = computed(() => {
  if (mode.value === "zigen") return null;
  const s = session.value;
  if (!s || s.finished) return null;
  const item = s.items[s.cursor];
  if (!item) return null;
  // 简码提示：一级简码关只显示一级；二级简码关显示规则说明与全部层级
  const lv = level.value;
  let shorts = [];
  if (lv?.showShorts) {
    shorts = [...item.shorts].sort((a, b) => a.length - b.length);
  } else if (lv?.showShort1) {
    const one = item.shorts.find((short) => short.length === 1);
    if (one) shorts = [one];
  }
  return {
    char: item.char,
    code: item.code,
    items: scheme.value.hint(item.char),
    input: s.input,
    shorts,
    guide: Boolean(lv?.showShorts),
  };
});

// ---------- 达标与结算 ----------
const requirement = computed(() => level.value?.require ?? { speed: 20, accuracy: 0.85 });
const passed = computed(() => {
  if (!level.value) return true;
  return (
    stats.value.speed >= requirement.value.speed &&
    stats.value.accuracy >= requirement.value.accuracy
  );
});

const options = computed(() => {
  const list = Object.entries(book.value)
    .filter(([, item]) => !item.mastered)
    .map(([char, item]) => ({
      id: char,
      main: char,
      detail: item.count ? `${item.code.toUpperCase()} · 错误 ${item.count} 次` : "主动添加",
    }));
  const seen = new Set(list.map((item) => item.id));
  for (const [char, count] of Object.entries(timeoutCounts.value)) {
    if (!seen.has(char)) list.push({ id: char, main: char, detail: `超时 ${count} 次` });
  }
  return list;
});

// ---------- 初始化 ----------
function resetCommon() {
  currentError.value = "";
  finished.value = false;
  started.value = false;
  paused.value = false;
  showResult.value = false;
  feedback.value = null;
  sticky.value = null;
  timeouts.value = 0;
  timeoutCounts.value = {};
  backspaceCount.value = 0;
  sessionStartAt.value = 0;
  charTimer.value = startChar(0);
  now.value = Date.now();
}

function initZigen(queue, isDrill = false) {
  resetCommon();
  drill.value = isDrill;
  zigenQueue.value = queue;
  zigenIndex.value = 0;
  zigenWrong.value = Array.from({ length: queue.length }).fill(false);
  zigenCorrectKeys.value = 0;
  zigenTotalKeys.value = 0;
  zigenRootErrors.value = {};
}

function initText(chars, isDrill = false) {
  resetCommon();
  drill.value = isDrill;
  streak.value = {};
  session.value = createSession(chars, scheme.value, 0, { requireFull: level.value?.requireFull });
  displayMap.value = chars.map((c, i) => ({ char: c, input: i }));
}

function buildDisplay(text) {
  const map = [];
  let ci = 0;
  for (const c of text) {
    if (isHan(c)) {
      map.push({ char: c, input: ci });
      ci += 1;
    } else {
      map.push({ char: c, input: -1 });
    }
  }
  displayMap.value = map;
}

async function initArticle(lv) {
  const articles = await loadArticles();
  const chosen = (lv.articleIds ?? [])
    .map((id) => articles.find((a) => a.id === id))
    .filter((a) => Boolean(a));
  if (chosen.length === 0) {
    router.replace("/");
    return;
  }
  const text = chosen.map((a) => a.paragraphs.join("\n")).join("\n");
  articleTitle.value = chosen.map((a) => `《${a.title}》${a.author}`).join("　");
  const chars = [...text].filter(isHan);
  initText(chars);
  buildDisplay(text);
}

// ---------- 按键处理 ----------
function startIfNeeded() {
  if (started.value) return;
  started.value = true;
  sessionStartAt.value = Date.now();
  charTimer.value = startChar(Date.now());
  if (session.value) session.value = { ...session.value, startAt: sessionStartAt.value };
}

function setFeedback(key, type, keep = true) {
  if (soundOn.value) playKeySound(type, volume.value);
  feedback.value = { key, type };
  if (keep && type !== "timeout" && hintsOn.value) sticky.value = { key, type };
  if (fbTimer) window.clearTimeout(fbTimer);
  fbTimer = window.setTimeout(() => {
    feedback.value = null;
  }, 350);
}

function handleZigenKey(key) {
  if (!/^[a-z]$/.test(key)) return;
  zigenTotalKeys.value += 1;
  const expect = zigenQueue.value[zigenIndex.value]?.key;
  if (key === expect) {
    zigenCorrectKeys.value += 1;
    currentError.value = "";
    setFeedback(key, "ok");
    zigenIndex.value += 1;
    charTimer.value = startChar(Date.now());
    if (zigenIndex.value >= zigenQueue.value.length) finish();
  } else {
    const task = zigenQueue.value[zigenIndex.value];
    if (task) {
      // 记录实际打错的字根（按字根聚合，供加练加权）
      zigenRootErrors.value[task.root] = (zigenRootErrors.value[task.root] ?? 0) + 1;
      record(task.root, task.key, key);
    }
    zigenWrong.value[zigenIndex.value] = true;
    currentError.value = `按错了，请继续按 ${expect.toUpperCase()}，答对后才进入下一题。`;
    setFeedback(key, "bad");
    charTimer.value = startChar(Date.now());
  }
}

function handleTextKey(key) {
  const s = session.value;
  if (!s) return;
  const result = feedKey(s, key);
  session.value = result.session;
  for (const ev of result.events) {
    if (ev.type === "key-accept") {
      currentError.value = "";
      setFeedback(key, "ok");
    } else if (ev.type === "key-reject") {
      currentError.value = "按错了，仍在当前字；请继续输入正确编码。";
      setFeedback(key, "bad");
    } else if (ev.type === "key-back") {
      // 退格：清除反馈高亮，不做按键音
      feedback.value = null;
      sticky.value = null;
    }
    if (ev.type === "char-error") {
      record(ev.char, ev.expect, ev.actual);
      recordCharError(ev.char);
      if (drill.value) streak.value[ev.char] = 0;
    } else if (ev.type === "char-done") {
      currentError.value = "";
      recordCharDone(ev.char, elapsed(charTimer.value, Date.now()));
      if (drill.value) {
        const n = (streak.value[ev.char] ?? 0) + 1;
        streak.value[ev.char] = n;
        if (n >= 2) markMastered(ev.char);
      }
      charTimer.value = startChar(Date.now());
    } else if (ev.type === "session-done") {
      finish();
    }
  }
}

/** 统一输入入口：物理键盘与虚拟键盘点按共用 */
function handleInput(key) {
  if (finished.value || paused.value) return;
  if (key === KEY_BACKSPACE) {
    // 退格：仅文本模式下、已有输入时生效（字根关与未开始忽略）
    if (!started.value || mode.value === "zigen") return;
    if (!session.value || session.value.input.length === 0) return;
    backspaceCount.value += 1;
    handleTextKey(key);
    return;
  }
  if (!/^[a-z ]$/.test(key)) return;
  startIfNeeded();
  if (mode.value === "zigen") handleZigenKey(key);
  else handleTextKey(key);
}

function onKeydown(e) {
  if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest("input, select, textarea, a")) return;
  if (e.target instanceof Element && e.target.closest("button") && [" ", "Enter"].includes(e.key))
    return;
  if (e.key === KEY_BACKSPACE) {
    e.preventDefault();
    handleInput(KEY_BACKSPACE);
    return;
  }
  const key = e.key.toLowerCase();
  if (key === " ") e.preventDefault();
  handleInput(key);
}

/** 当前待练项标识：文本为汉字，字根为键位；已完成时返回空串 */
function currentItemId() {
  if (mode.value === "zigen") return zigenQueue.value[zigenIndex.value]?.root ?? "";
  const s = session.value;
  if (!s || s.finished) return "";
  return s.items[s.cursor]?.char ?? "";
}

function onTimeoutTick() {
  if (!started.value || finished.value || paused.value) return;
  const timeoutMs = level.value?.timeoutMs ?? 4000;
  const r = checkTimeout(charTimer.value, timeoutMs, Date.now());
  if (r.timedOut) {
    charTimer.value = r.timer;
    timeouts.value += 1;
    const id = currentItemId();
    if (id) timeoutCounts.value[id] = (timeoutCounts.value[id] ?? 0) + 1;
    const key = highlight.value;
    if (key) setFeedback(key, "timeout", false);
  }
}

// ---------- 结算与加练 ----------
function finish() {
  finished.value = true;
  now.value = Date.now();
  showResult.value = true;
  const lv = level.value;
  // 加练只记录错项，不改写关卡成绩。
  if (lv && !drill.value) {
    recordResult(lv.id, stats.value.speed, stats.value.accuracy, passed.value, timeouts.value);
  }
}

function onPractice(ids) {
  if (ids.length === 0) return;
  if (mode.value === "zigen") {
    // 字根加练：按错误次数加权，打错的字根出现频率更高
    const tasks = makeDrillZigenTasks(ids);
    initZigen(tasks.length > 0 ? tasks : makeZigenTasks(ids, ids.length * DRILL_REPEAT), true);
    return;
  }
  // 单字加练：每项重复 DRILL_REPEAT 次，整体均匀随机且不连续重复
  initText(randomSequence(ids, ids.length * DRILL_REPEAT), true);
}

function closeResult() {
  router.push("/");
}

// ---------- 生命周期 ----------
/** 开启本关一局（首次进入与「重新开始」共用） */
async function startRound() {
  if (isFree.value) {
    if (!freeText.value) {
      router.replace("/free");
      return;
    }
    articleTitle.value = freeTitle.value || "自由练习";
    const text = freeText.value;
    initText([...text].filter(isHan), Boolean(route.query.recallLevel));
    buildDisplay(text);
    return;
  }
  const lv = level.value;
  if (!lv) return;
  if (lv.type === "intro") return;
  if (lv.type === "zigen" && route.query.mistakes) {
    const ids = Object.entries(book.value)
      .filter(([, item]) => route.query.mistakes === "all" || !item.mastered)
      .map(([char]) => char);
    if (ids.length) {
      onPractice(ids);
      return;
    }
  }
  parsedScript.value = null;
  if (lv.type === "zigen") {
    initZigen(
      lv.source === "radicals" ? makeRadicalTasks(lv.length) : makeZigenTasks(lv.pool, lv.length),
    );
  } else if (lv.type === "article") {
    await initArticle(lv);
  } else if (lv.script && lv.script.length > 0) {
    const parsed = parseScript(lv.script);
    parsedScript.value = parsed;
    initText(parsed.chars);
  } else {
    initText(await buildLevelChars(lv, uiScheme.value));
  }
}

/** 教学关：阅读完毕即达标，返回地图 */
function completeIntro() {
  const lv = level.value;
  if (lv) recordResult(lv.id, 0, 1, true, 0);
  router.push("/");
}

/** 重新开始本关（重新抽题，开新一轮） */
function restart() {
  void startRound();
}

/** 暂停 / 继续：恢复时扣除暂停时长，避免影响速度与超时判定 */
function togglePause() {
  if (finished.value) return;
  if (paused.value) {
    const duration = Date.now() - pausedAt;
    if (sessionStartAt.value > 0) sessionStartAt.value += duration;
    if (charTimer.value.charStartAt > 0) {
      charTimer.value = { ...charTimer.value, charStartAt: charTimer.value.charStartAt + duration };
    }
    paused.value = false;
  } else {
    pausedAt = Date.now();
    paused.value = true;
  }
}

onMounted(async () => {
  await ensureScheme(uiScheme.value);
  const [zigenData, weights] = await Promise.all([
    loadZigen(uiScheme.value),
    loadRadicalWeights(uiScheme.value),
  ]);
  zigenMap.value = Object.fromEntries(zigenData.map((z) => [z.key, z]));
  radicalWeights.value = weights;

  if (!isFree.value) {
    const lv = level.value;
    if (!lv) {
      router.replace("/");
      return;
    }
  }
  // 教学关仅阅读，不进入打字流程
  if (isIntro.value) return;
  // 口诀脚本关：进入时自动居中（仍可手动切换）
  if (scriptMode.value) setAlign("center");
  await startRound();

  window.addEventListener("keydown", onKeydown);
  tickTimer = window.setInterval(() => {
    if (started.value && !finished.value && !paused.value) now.value = Date.now();
  }, 1000);
  timeoutTimer = window.setInterval(onTimeoutTick, 200);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  if (tickTimer) window.clearInterval(tickTimer);
  if (timeoutTimer) window.clearInterval(timeoutTimer);
  if (fbTimer) window.clearTimeout(fbTimer);
});
</script>

<template>
  <section class="play">
    <header v-if="!isIntro" class="play__heading paper-heading">
      <RouterLink :to="isFree ? '/free' : '/'" class="play__back">← {{ isFree ? "自由练习" : "全部课程" }}</RouterLink>
      <h1>{{ isFree ? freeTitle || "自由编码练习" : level?.title || "编码练习" }}</h1>
      <p>请切换到英文输入，直接按字母键练习五笔编码。空格确认简码，退格纠正；也可点按下方键盘。</p>
    </header>
    <IntroPanel
      v-if="isIntro"
      :title="level?.title ?? '教学关'"
      :paragraphs="level?.intro ?? []"
      @done="completeIntro"
    />

    <template v-else>
      <StatsBar
        :speed="stats.speed"
        :accuracy="stats.accuracy"
        :done="doneCount"
        :total="totalCount"
        :elapsed-sec="stats.elapsedSec"
        :timeouts="timeouts"
        :unit="unit"
        :keystrokes="stats.keystrokes"
      />

      <TextPanel :items="textItems" :title="panelTitle" :layout="gridLayout ? 'grid' : 'flow'" />
      <p v-if="currentError" class="notice notice--error" role="status">{{ currentError }}</p>

      <CodeHint
        v-if="currentHint"
        :char="currentHint.char"
        :code="currentHint.code"
        :items="currentHint.items"
        :input="currentHint.input"
        :shorts="currentHint.shorts"
        :guide="currentHint.guide"
      />

      <MistakeActions
        :level-id="mistakeLevelId"
        :char="isZigen ? zigenQueue[zigenIndex]?.root : currentHint?.char"
        :code="isZigen ? zigenQueue[zigenIndex]?.key : currentHint?.code"
      />

      <div class="keyboard-wrap">
        <div class="controls">
          <button
            class="ctrl-btn"
            :aria-pressed="paused"
            :class="{ 'ctrl-btn--on': paused }"
            @click="togglePause"
          >
            {{ paused ? "继续" : "暂停" }}
          </button>
          <button class="ctrl-btn" @click="restart">重新开始</button>
          <button
            class="ctrl-btn"
            :class="{ 'ctrl-btn--off': !hintsOn }"
            :aria-pressed="hintsOn"
            @click="setHints(!hintsOn)"
          >
            {{ hintsOn ? "按键提示：开" : "按键提示：关" }}
          </button>
          <div class="volume">
            <button class="ctrl-btn" :aria-expanded="volumeOpen" @click="volumeOpen = !volumeOpen">
              {{ soundOn ? `音量 ${Math.round(volume * 100)}%` : "音效已关闭" }}
            </button>
            <div v-if="volumeOpen" class="volume__panel">
              <input
                class="volume__range"
                type="range"
                aria-label="音效音量"
                min="0"
                max="100"
                step="5"
                :value="Math.round(volume * 100)"
                :disabled="!soundOn"
                @input="onVolumeInput"
              />
              <button class="volume__test" :disabled="!soundOn" @click="testSound">试听</button>
            </div>
          </div>
        </div>
        <VirtualKeyboard
          :highlight="highlight"
          :feedback="feedback"
          :sticky="sticky"
          :zigen="zigenMap"
          :disabled="finished || paused"
          @press="handleInput"
        />
      </div>

      <dialog
        ref="pauseDialog"
        class="pause-dialog"
        aria-labelledby="pause-title"
        @cancel.prevent="togglePause"
      >
        <h2 id="pause-title">已暂停</h2>
        <p>计时与输入已暂停，继续后保留当前进度。</p>
        <button class="ctrl-btn" autofocus @click="togglePause">继续练习</button>
      </dialog>

      <ResultModal
        :visible="showResult"
        :title="panelTitle || level?.title || '练习结算'"
        :stats="stats"
        :unit="unit"
        :passed="passed"
        :requirement="requirement"
        :options="options"
        :show-pass="!isFree && !drill"
        @practice="onPractice"
        @close="closeResult"
      />
    </template>
  </section>
</template>

<style scoped>
.play {
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.play__heading {
  display: grid;
  gap: 16px;
  padding-bottom: 12px;
}
.play__back {
  width: fit-content;
  color: var(--color-text-muted);
  font-size: 14px;
  text-decoration: none;
}
.play__back:hover {
  color: var(--color-text);
}
.play__heading h1 {
  margin: 0;
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 500;
}
.play__heading p {
  max-width: 720px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.9;
}
.keyboard-wrap {
  min-width: 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.ctrl-btn,
.volume__test {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
}
.ctrl-btn:hover,
.volume__test:hover,
.ctrl-btn--on {
  color: var(--color-text);
  border-color: var(--color-text);
}
.ctrl-btn--off {
  color: var(--color-text-muted);
}
.volume {
  position: relative;
}
.volume__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100vw - 48px);
  padding: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
.volume__range {
  width: 120px;
  accent-color: var(--color-success);
}
.volume__test:disabled,
.volume__range:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pause-dialog {
  width: min(420px, calc(100vw - 32px));
  margin: auto;
  padding: 24px;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-surface);
}
.pause-dialog::backdrop {
  background: rgb(23 25 24 / 35%);
}
.pause-dialog h2 {
  font-size: 24px;
  font-weight: 500;
}
.pause-dialog p {
  margin: 16px 0 24px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--color-text-muted);
}
@media (max-width: 640px) {
  .volume__panel {
    left: auto;
    right: 0;
  }
}
</style>
