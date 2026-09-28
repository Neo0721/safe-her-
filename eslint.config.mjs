import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Screens load their data from effects and set loading/error state as part of that flow;
      // components also flip a `mounted` flag to avoid hydration mismatches. Both are intentional.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Node CLI scripts and the shared CommonJS schema module.
    files: ['scripts/**/*.js', 'backend/db/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'node_modules/**',
    'android/**',
    'expo-app/**',
    'capacitor-www/**',
    'next-env.d.ts',
  ]),
])
