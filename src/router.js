import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", name: "map", component: () => import("./views/LevelSelectView.vue") },
  { path: "/play/:id", name: "play", component: () => import("./views/PlayView.vue") },
  { path: "/typing/:id", name: "typing", component: () => import("./views/TypingView.vue") },
  { path: "/free", name: "free", component: () => import("./views/FreeView.vue") },
  { path: "/reference", name: "reference", component: () => import("./views/ReferenceView.vue") },
  { path: "/recall", name: "recall", component: () => import("./views/RecallView.vue") },
  {
    path: "/appearance",
    name: "appearance",
    component: () => import("./views/AppearanceView.vue"),
  },
  { path: "/settings", name: "settings", component: () => import("./views/SettingsView.vue") },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({ history: createWebHashHistory(), routes });
