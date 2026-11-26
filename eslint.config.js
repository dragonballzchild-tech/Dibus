import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", ".vercel/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.browser },
  },
  {
    files: ["api/**/*.js", "lib/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
  },
];
