import antfu from "@antfu/eslint-config";
export default antfu({
  typescript: false,
  vue: true,
  stylistic: false,
  jsdoc: false,
  test: false,
  jsonc: false,
  yaml: false,
  markdown: false,
  ignores: ["dist/**", "node_modules/**", "src/data/generated/**", "scripts/sources/**"],
  rules: {
    "vue/max-attributes-per-line": "off",
    "vue/singleline-html-element-content-newline": "off",
    "vue/html-self-closing": "off",
    "antfu/if-newline": "off",
    curly: "off",
  },
});
