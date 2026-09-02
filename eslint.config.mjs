import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored agent skill trees — not application source, don't lint them.
      ".claude/**",
      ".agents/**",
      ".gemini/**",
      ".opencode/**",
    ],
  },
  {
    rules: {
      // ignoreRestSiblings clears the `{ node, ...props }` rest-strip warnings in
      // the chrome components; the ^_ patterns cover intentionally-unused
      // bindings like `_lk` / `_tk` and unused caught errors.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
