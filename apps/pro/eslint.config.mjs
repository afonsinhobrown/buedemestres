// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  expoConfig,
  {
    rules: {
      // Em React Native o texto é renderizado nativamente, não em HTML — as
      // aspas dentro de <Text> não precisam de ser escapadas.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'dist-web/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'node_modules/**',
      'babel.config.js',
      'metro.config.js',
    ],
  },
]);
