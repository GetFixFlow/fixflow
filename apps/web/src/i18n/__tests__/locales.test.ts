import { describe, expect, it } from 'vitest'
import i18n, { LANGUAGE_CODES, LANGUAGES, isLanguage, label, setLanguage } from '@/i18n'

/** What a person adding or changing a language must keep true (docs/translating.md). */
const files = import.meta.glob('../../locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>
const sources = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/__tests__/**', '!../../test/**'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

type Texts = Record<string, string>

function flatten(value: unknown, prefix = ''): Texts {
  if (typeof value === 'string') return { [prefix]: value }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Texts>((all, [key, child]) => ({ ...all, ...flatten(child, prefix ? `${prefix}.${key}` : key) }), {})
  }
  return { [prefix]: String(value) }
}

const byLanguage: Record<string, Record<string, Texts>> = {}
for (const [path, content] of Object.entries(files)) {
  const [, code, file] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)!
  ;(byLanguage[code] ??= {})[file] = flatten(content)
}
const allTexts = (code: string): Texts => Object.assign({}, ...Object.values(byLanguage[code]))
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
const english = allTexts('en')

describe('the languages that ship', () => {
  it('are English and Spanish, English first, each by its own name', () => {
    expect(LANGUAGE_CODES).toEqual(['en', 'es'])
    expect(LANGUAGES).toEqual([{ code: 'en', name: 'English' }, { code: 'es', name: 'Español' }])
  })

  it('refuses a code that is not one of them', () => {
    expect(isLanguage('es')).toBe(true)
    expect(isLanguage('xx')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})

describe.each(LANGUAGE_CODES.filter((code) => code !== 'en'))('the %s files', (code) => {
  const other = allTexts(code)

  it('are the same files as English', () => {
    expect(Object.keys(byLanguage[code]).sort()).toEqual(Object.keys(byLanguage.en).sort())
  })

  it('have every text English has, and nothing English lacks', () => {
    expect(Object.keys(english).filter((key) => !(key in other))).toEqual([])
    expect(Object.keys(other).filter((key) => !(key in english))).toEqual([])
  })

  it('name the same {{placeholders}} as English in every text', () => {
    const wrong = Object.keys(other).filter((key) => key in english && placeholders(other[key]).join() !== placeholders(english[key]).join())
    expect(wrong).toEqual([])
  })

  it('have no empty text', () => {
    expect(Object.keys(other).filter((key) => other[key].trim() === '')).toEqual([])
  })
})

describe('the texts used in the code', () => {
  it('all exist in English (a mistyped key would show as the key itself)', () => {
    const missing: string[] = []
    for (const [path, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/\b(?:t|i18nKey=)\(?\s*['"`]([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)['"`]/g)) {
        const key = match[1]
        const found = key in english || `${key}_one` in english || `${key}_other` in english
        if (!found) missing.push(`${path.replace('../../', 'src/')}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every text in English is used somewhere, or is one of the families looked up by name', () => {
    const code = Object.values(sources).join('\n')
    const looked = /^(common\.(status|priority|type|role)\.|dashboard\.start\.steps\.|language_name$)/
    const unused = Object.keys(english).filter((key) => {
      const stem = key.replace(/_(one|other)$/, '')
      return !looked.test(key) && !code.includes(`'${stem}'`) && !code.includes(`"${stem}"`) && !code.includes(`\`${stem}\``)
        && !code.includes(`'${stem.split('.').slice(0, -1).join('.')}.`) && !code.includes(`\`${stem.split('.').slice(0, -1).join('.')}.`)
    })
    expect(unused).toEqual([])
  })
})

describe('switching language', () => {
  it('changes what every text reads, and plurals follow the language', async () => {
    setLanguage('es', false)
    expect(i18n.t('common.actions.save')).toBe('Guardar')
    expect(label('priority', 'critical')).toBe('Crítica')
    expect(label('status', 'in_progress')).toBe('En curso')
    setLanguage('en', false)
    expect(label('status', 'in_progress')).toBe('In Progress')
  })

  it('falls back to English for a text a language does not have', () => {
    i18n.addResource('en', 'translation', 'only_in_english', 'English only')
    expect(i18n.t('common.actions.save', { lng: 'es' })).toBe('Guardar')
    expect(i18n.t('only_in_english', { lng: 'es' })).toBe('English only')
    expect(i18n.t('no.such.text', { lng: 'es' })).toBe('no.such.text')
  })

  it('writes a word it has no translation for readably', () => {
    expect(label('status', 'some_new_state')).toBe('Some new state')
    expect(label('priority', null)).toBe('')
  })
})
