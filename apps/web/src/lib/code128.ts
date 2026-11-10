import JsBarcode from 'jsbarcode'

/** The characters a label's barcode can hold: printable ASCII (letters, digits, punctuation, space). */
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/

/**
 * Code 128 for `text` as a string of modules, "1" for a bar and "0" for a space, starting with the start symbol and
 * ending with the stop symbol, or null when the text is empty or holds a character it cannot. (Most handheld scanners and
 * phone cameras read Code 128.)
 */
export function code128Modules(text: string): string | null {
  if (!PRINTABLE_ASCII.test(text)) return null
  const target: { encodings?: { data: string }[] } = {}
  try {
    JsBarcode(target, text, { format: 'CODE128', valid: () => undefined })
  } catch {
    return null
  }
  return (target.encodings ?? []).map((part) => part.data).join('') || null
}

/** The runs of bars in a module string as [start, length] pairs: "11011" is [[0, 2], [3, 2]]. */
export function barRuns(modules: string): [number, number][] {
  const runs: [number, number][] = []
  for (const match of modules.matchAll(/1+/g)) runs.push([match.index, match[0].length])
  return runs
}
