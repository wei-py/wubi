import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router.js";
import "virtual:uno.css";
import "./shared/styles/tokens.css";
import "./style.css";

createApp(App).use(createPinia()).use(router).mount("#app");
