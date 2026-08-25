// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      /**
       * A `useState` setter that shadows a same-named import silently swallows
       * every call to the import — it still type-checks, because awaiting a void
       * setter is legal. That is exactly how TopUpScreen stopped persisting the
       * pending Kora deposit reference, stranding paid deposits that could no
       * longer be reconciled. Warn-level for now; the remaining hits are benign
       * `catch (error)` / callback-param shadows and can be promoted to `error`
       * once they are cleaned up.
       */
      '@typescript-eslint/no-shadow': ['warn', { builtinGlobals: false }],
    },
  },
]);
