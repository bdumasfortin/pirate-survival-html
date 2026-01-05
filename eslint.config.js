import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      prettier: prettier,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "no-var": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "server/dist/**",
      "build/**",
      "*.min.js",
      "*.min.css",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "*.config.js",
      "*.config.ts",
      "coverage/**",
      ".vscode/**",
      ".idea/**",
      "*.log",
      ".DS_Store",
    ],
  }
);
