<script setup>
import { useUiSettings } from "@/composables/useUiSettings.js";
const {
  align,
  theme,
  volume,
  hintsOn,
  codeHintOn,
  setAlign,
  setTheme,
  setVolume,
  setHints,
  setCodeHint,
} = useUiSettings();
</script>
<template>
  <header class="paper-heading">
    <span class="eyebrow">WUBI / PREFERENCES</span>
    <h1>适合自己的练习方式</h1>
    <p class="paper-lead">偏好会自动保存在当前浏览器。默认使用与 Herdr 一致的白纸界面。</p>
  </header>
  <nav class="section-tabs" aria-label="设置导航">
    <RouterLink to="/settings">存档管理</RouterLink><RouterLink to="/appearance" aria-current="page">外观与练习偏好</RouterLink>
  </nav>
  <div class="setting-row">
    <label for="theme">界面主题<small>浅色、深色，或跟随系统外观。</small></label><select id="theme" :value="theme" @change="setTheme($event.target.value)">
      <option value="light">浅色</option>
      <option value="dark">深色</option>
      <option value="auto">跟随系统</option>
    </select>
  </div>
  <div class="setting-row">
    <label for="align">练习文本对齐<small>仅影响编码训练文字区的排版。</small></label><select id="align" :value="align" @change="setAlign($event.target.value)">
      <option value="center">居中对齐</option>
      <option value="left">左对齐</option>
    </select>
  </div>
  <div class="setting-row">
    <label for="key-hints">按键提示<small>在屏幕键盘上标出下一步键位及输入反馈。</small></label><input
      id="key-hints"
      type="checkbox"
      :checked="hintsOn"
      @change="setHints($event.target.checked)"
    />
  </div>
  <div class="setting-row">
    <label for="code-hints">拆字提示<small>显示当前汉字的字根拆解与完整编码。</small></label><input
      id="code-hints"
      type="checkbox"
      :checked="codeHintOn"
      @change="setCodeHint($event.target.checked)"
    />
  </div>
  <div class="setting-row">
    <label for="volume">按键音量<small>0% 为静音，音效只用于编码训练。</small></label>
    <div class="volume-field">
      <input
        id="volume"
        type="range"
        min="0"
        max="100"
        :value="Math.round(volume * 100)"
        @input="setVolume(Number($event.target.value) / 100)"
      /><output for="volume">{{ Math.round(volume * 100) }}%</output>
    </div>
  </div>
  <p class="notice">
    五笔方案在页面顶部切换。切换时页面会刷新，已有进度会先保存；请让系统输入法与网页选择的版本保持一致。
  </p>
</template>
<style scoped>
.volume-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.volume-field input {
  max-width: 120px;
  accent-color: var(--ink);
}
.volume-field output {
  min-width: 35px;
  font-size: 13px;
  color: var(--ink-muted);
}
@media (max-width: 480px) {
  .volume-field {
    flex-direction: column;
    align-items: end;
    gap: 4px;
  }
  .volume-field input {
    max-width: 95px;
  }
}
</style>
