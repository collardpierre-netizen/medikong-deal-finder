import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
      react,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      // Icon-only buttons/links must have an accessible label.
      // Ignoring input/select/textarea to avoid noise on form fields
      // wrapped in labels without htmlFor; td/th are table cells, not controls.
      "jsx-a11y/control-has-associated-label": [
        "error",
        {
          ignoreElements: ["input", "select", "textarea", "td", "th"],
          depth: 5,
        },
      ],
      "jsx-a11y/anchor-has-content": "error",
      // Structural JSX safety nets — catch the kinds of bugs that make
      // a file fail to compile (unclosed tags, stray text, dup props…)
      // without forcing a full strict TS migration.
      "react/jsx-no-undef": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-key": "error",
      "react/jsx-no-target-blank": "error",
      "react/no-unescaped-entities": "off",
      "react/no-children-prop": "error",
      "react/no-direct-mutation-state": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-fallthrough": "error",
    },
  },
);
