import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundles web das apps Expo montados para download (gerados, não código).
    "public/apps/**",
    "public/exports/**",
    // Scripts utilitários executados com node (não fazem parte do bundle).
    "scripts/**",
  ]),
]);

export default eslintConfig;
