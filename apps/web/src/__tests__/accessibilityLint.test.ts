import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

/**
 * The accessibility mistakes a linter can see in the code of the screens: a clickable <div> the keyboard cannot reach, a
 * <label> that names nothing, an icon-only button with no name, an <img> with no alt, a bad ARIA role or attribute.
 * Runs over every screen file, so a new one is held to the same rules.
 */
describe('the screens, read by the accessibility linter', () => {
  it('have no findings', async () => {
    const eslint = new ESLint({
      cwd: process.cwd(),
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['src/**/*.tsx'],
          ignores: ['src/**/__tests__/**', 'src/test/**'],
          languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { 'jsx-a11y': jsxA11y },
          linterOptions: { reportUnusedDisableDirectives: false },
          rules: {
            ...jsxA11y.flatConfigs.recommended.rules,
            // A form field that takes the keyboard when a dialog opens or a scanner starts is what the person came to do.
            'jsx-a11y/no-autofocus': 'off',
            // A list with list-style: none loses its meaning in Safari and VoiceOver unless it says role="list".
            'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
          },
        },
      ],
    })
    const results = await eslint.lintFiles(['src/**/*.tsx'])
    const findings = results.flatMap((result) =>
      result.messages.filter((m) => m.fatal || m.ruleId?.startsWith('jsx-a11y/')).map((m) => `${result.filePath.split('/src/')[1]}:${m.line} ${m.ruleId}: ${m.message}`),
    )
    expect(findings).toEqual([])
  }, 180_000)
})
