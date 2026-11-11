// The plugin ships no types; only the accessibility lint test reads it.
declare module 'eslint-plugin-jsx-a11y' {
  import type { ESLint } from 'eslint'
  const plugin: ESLint.Plugin & { flatConfigs: { recommended: { rules: Record<string, unknown> } } }
  export default plugin
}
