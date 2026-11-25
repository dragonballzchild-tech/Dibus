import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", ".wrangler/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.browser },
  },
  {
    files: ["functions/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.serviceworker } },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
  },
];
