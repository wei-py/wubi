import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", name: "map", component: () => import("./views/LevelSelectView.vue") },
  { path: "/play/:id", name: "play", component: () => import("./views/PlayView.vue") },
  { path: "/typing/:id", name: "typing", component: () => import("./views/TypingView.vue") },
  { path: "/free", name: "free", component: () => import("./views/FreeView.vue") },
  { path: "/reference", name: "reference", component: () => import("./views/ReferenceView.vue") },
  {
    path: "/strokes",
    name: "strokes",
    component: () => import("./views/StrokeLookupView.vue"),
    meta: { title: "笔画查询" },
  },
  { path: "/recall", name: "recall", component: () => import("./views/RecallView.vue") },
  {
    path: "/appearance",
    name: "appearance",
    component: () => import("./views/AppearanceView.vue"),
  },
  { path: "/settings", name: "settings", component: () => import("./views/SettingsView.vue") },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.afterEach((to, _from, failure) => {
  if (!failure) document.title = to.meta.title ? `${to.meta.title} · 五笔学习` : "五笔学习";
});

export default router;
