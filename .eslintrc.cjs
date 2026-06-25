/* The renderer-purity rule lives here and fails CI, not just convention.
   The React renderer must NEVER import electron/node/native modules directly —
   everything funnels through window.cockpit (the typed IPC seam). This is the
   single cheapest-to-impose / most-expensive-to-retrofit decision in the project. */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['out/', 'release/', 'node_modules/', '*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      // RENDERER PURITY: no native/Electron access in the React layer.
      files: ['src/renderer/**/*.{ts,tsx}'],
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: 'electron', message: 'Renderer must use window.cockpit, not electron.' },
              { name: 'node-pty', message: 'Native modules live behind the IPC seam.' },
              { name: 'simple-git', message: 'Git access goes through window.cockpit.' },
              { name: 'chokidar', message: 'File watching goes through window.cockpit.' },
              { name: 'fs', message: 'No direct fs in the renderer.' },
              { name: 'node:fs', message: 'No direct fs in the renderer.' },
              { name: 'child_process', message: 'No process spawning in the renderer.' },
              { name: 'node:child_process', message: 'No process spawning in the renderer.' }
            ],
            patterns: ['node:*', '../main/*', '../preload/*']
          }
        ]
      }
    }
  ]
}
