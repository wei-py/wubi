import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import presetIcons from "@unocss/preset-icons";
import UnoCSS from "@unocss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [vue(), tailwindcss(), UnoCSS({ presets: [presetIcons({ scale: 1.1, warn: true })] })],
});
