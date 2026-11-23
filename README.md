# 五笔学习

与本地 Herdr 学习站一致的 Vue / JavaScript 技术栈与纸面 UI。课程和练习引擎基于 [LtyWK/wubi-practice](https://github.com/LtyWK/wubi-practice)，所有课程、关卡与分组始终开放。

## 启动

环境：Node.js `^24.15.0 || >=26.0.0`、pnpm `12.5.1`。

```sh
pnpm install
pnpm dev
```

开发地址：http://localhost:5176/ 。端口固定，不占用 Herdr 的 5175。

```sh
pnpm build       # 生成 dist/
pnpm preview     # http://localhost:4176/
pnpm lint
pnpm test
pnpm data:verify
```

`dist/` 可直接部署到静态托管。使用相对资源路径和 Hash 路由，支持部署到子目录，不需要服务端路由回退规则。

## 发布到 GitHub Pages

已提供 `.github/workflows/deploy-pages.yml`，推送到 `master` 或在 Actions 页面手动运行时，会使用 Node.js 26 和项目声明的 pnpm 版本构建并发布 `dist/`。

首次启用：

1. 打开仓库 [Settings → Pages](https://github.com/wei-py/wubi/settings/pages)。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 将包含工作流的提交推送到 `master`；若提交已经推送，可在 [Actions](https://github.com/wei-py/wubi/actions) 中选择 **Deploy to GitHub Pages → Run workflow**。
4. 等待 `build` 和 `deploy` 都成功后，访问 **https://wei-py.github.io/wubi/**。

不需要创建 `gh-pages` 分支，也不需要手动提交 `dist/`。保留相对资源路径和 Hash 路由，课程等页面刷新时不会因 GitHub Pages 缺少服务端路由回退而返回 404。若更换发布分支，需同步修改工作流的 `on.push.branches`。

注意：本地开发站点与 GitHub Pages 不同源，学习进度不会自动迁移；发布后需要在本地导出存档，再到线上导入。

## 学习内容

- 6 个阶段、43 个关卡：字根启蒙、简码入门、识别码专题、常用字爬坡、词组爬坡、挑战关卡。
- 支持 86 版、98 王码和新世纪版，字根键位、助记说明、拆字和编码随方案切换。
- 每套方案包含单字码表与 3500 常用字；共享 1000 个二字词、200 个三字词、200 个四字词及 9 篇文章。
- 跟打支持分组练习、限时冲刺、逐段提速、耐力、无尽词流及综合测试。
- 自由练习可选择文章或输入自己的文本；原文标点与换行保留，成绩仅计算汉字。
- 字根与汉字编码速查、末笔识别码表、错字回忆、JSON 存档导入导出。
- 独立的「笔画」页（`#/strokes`）支持输入或粘贴简繁汉字，每次最多查询 24 个不同的字，显示总笔画数和五类笔形的笔顺。

### 输入方式

**字根、简码、识别码课程：** 切换到英文输入状态，直接按字母键。字根一键作答；按错时停留当前题并显示错误提示，直到按对才推进。汉字可按全码输入，简码以空格提交。强制全码训练按课程要求练完整编码。长按按键不重复提交答案。

**常用字、词组、挑战和自由练习：** 使用系统上的五笔输入法输入汉字。网页不替代系统输入法。请确保系统输入法版本与页面顶部选择的方案一致。支持原生 IME 组合输入，屏蔽粘贴跟打结果，退格清除当前位置的错字。

跟打时，「拆字提示」同时显示当前字的全码和可用简码。例如新世纪版的「发」可打全码 `NTCY`，也可打 `V` 或 `NTC` 后按空格。

### 每关错题本

- 编码、字根和汉字跟打中的错误按当前关卡自动记录；练习页可主动添加当前题或删除当前错题。
- 点击「本关错题」，或在「回忆」页选择关卡，可手动添加汉字（自动查码）或本关字根、逐题删除、标记掌握和专项练习。
- 各关的题目、错误次数和掌握状态独立；删除某关的同一个字，不影响其他关。主动添加不会虚增错误次数，重复添加不会重复计数。
- 错题变更立即写入本地存档，刷新、导出和导入均保留关卡隔离；错题专项练习仍记录到来源关卡。
- 旧版错题没有关卡信息，迁移后单独放在「历史未分类（旧版错题）」，不推断来源或混入各关。


### 无准入限制

- 新存档即可直接进入任意关卡，包括毕业综合测试。
- 所有分组都能直接选择，不要求先完成前一组。
- 速度、正确率只用于成绩反馈，不阻止练习其他关卡或继续下一组、下一段。
- 完成靠后的组不会把跳过的组计为已完成；每组成绩单独记录。
- 限时与无尽模式的时间、错误次数仍是各自的游戏规则，不是关卡解锁条件。

## 数据保存

Pinia 管理学习状态；进度保存在当前浏览器的 localStorage：

- `wubi-learning.save.wubi86`
- `wubi-learning.save.wubi98`
- `wubi-learning.save.wubi06`
- `wubi-learning.ui.*`：外观、音量、提示和方案偏好。

切换方案时先保存再刷新，各方案的成绩互不影响。当前自由练习文本保存在 sessionStorage，刷新可重新练习；关闭标签页后不承诺保留。重置和导入均需在界面确认，仅影响当前方案。导入会覆盖数据，换设备或清理浏览器前应先导出。

## 技术与结构

沿用 Herdr 的固定依赖版本：Vue 3.5.44、Pinia 4.1.0、Vue Router 4.6.4、Vite Plus 1.4.0、Tailwind CSS 4.3.3、UnoCSS Carbon 图标，以及 dayjs、xe-utils、vue-hooks-plus。应用与构建脚本均为 JavaScript。

- `src/shared/styles/tokens.css`：沿用 Herdr 的配色、排版、直角控件与响应式布局。
- `src/views/`、`src/components/`：课程、练习、速查、回忆、设置和练习组件。
- `src/engine/`：编码与汉字跟打判定、计时和评分。
- `src/composables/`：Pinia 存档、偏好、错字与 IME 输入管理。
- `src/data/generated/`：可直接使用的静态码表与练习数据，按需加载。
- `scripts/sources/`：保留数据来源，`pnpm data:build` 可重建三套方案及共享笔画数据。笔画数据取自 `data-chars.tsv`，有笔顺时按其计算笔画数，否则使用来源表的笔画数。
- `tests/practice.test.js`：简码/全码判定、错误修正、冻结计时、分组记录与存档往返的行为回归。

完整码表的单独懒加载块较大，生产构建会提示超过 500 kB；它们不会随课程首页一起加载。未通过调高警告阈值隐藏该提示。

## 来源与许可

本项目按 **GPL-3.0-only** 发布，完整协议见 `LICENSE`。

课程、引擎、码表构建脚本与字根字体来自 [LtyWK/wubi-practice](https://github.com/LtyWK/wubi-practice)，对应参考版本 `b5ad4f5e0ac82227311b4dd9229b2e8d799a20ed`；本项目进行了 JavaScript/Pinia 迁移、无门槛选关与 Herdr 风格改造。

- 86 码表：[RIME rime-wubi](https://github.com/rime/rime-wubi)；拆字资料来自 [hantang/search-wubi](https://github.com/hantang/search-wubi)。
- 98 码表与字根：感谢 [98wb](https://github.com/98wb)、[yanhuacuo/98wubi-tables](https://github.com/yanhuacuo/98wubi-tables)。
- 新世纪版：单字全码和简体首选简码按[王码大一统 2018 码表](https://06wb.github.io/Tables/index.html)核对；拆分参考[空山明月的 06 拆分表](https://github.com/mrshiqiqi/rime-wubi/blob/54d50759a29577e9fdcd8509463669225303e028/tables/06/wb_spelling.dict.yaml)，扩展单字全码参考 [byujiang/wubi06_rime（GPL-3.0，原始码表署名 Wozy）](https://github.com/byujiang/wubi06_rime/tree/fc1cedbb21cde3ca160ce291888fa70697720ab3)。字根键位参考[王码简体字根键位图](https://github.com/CNMan/UnicodeCJK-WuBi06/issues/15)，字形沿用站内已有的黑体字根字体。
- IBM Plex Mono：字体协议保留在 `public/IBM-Plex-Mono-LICENSE.txt` 和 `src/shared/styles/fonts/LICENSE.txt`。
