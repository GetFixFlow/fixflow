/** The colour the app ships with (Tailwind blue-600). Anything else is the company's own. */
export const DEFAULT_PRIMARY = '#2563eb'

/** White text goes on the primary colour, so it has to be dark enough to read. Matches the server. */
export const MIN_CONTRAST_WITH_WHITE = 3

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** How far each step sits from the chosen colour: toward white (positive) or black (negative). */
const MIX: Record<(typeof STEPS)[number], number> = {
  50: 0.92, 100: 0.84, 200: 0.7, 300: 0.52, 400: 0.3, 500: 0.12,
  600: 0,
  700: -0.14, 800: -0.28, 900: -0.42, 950: -0.58,
}

const STORAGE_KEY = 'fixflow-brand-color'

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

export const isHexColor = (value: string) => hexToRgb(value) !== null

/** WCAG contrast ratio of a colour against white (1 to 21). */
export function contrastWithWhite(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
}

/** The shades 50 to 950 around a colour, as "r g b" (the form Tailwind's alpha support needs). */
export function brandRamp(hex: string): Record<number, string> | null {
  const base = hexToRgb(hex)
  if (!base) return null
  const ramp: Record<number, string> = {}
  for (const step of STEPS) {
    const mix = MIX[step]
    const target = mix >= 0 ? 255 : 0
    const amount = Math.abs(mix)
    ramp[step] = base.map((c) => Math.round(c + (target - c) * amount)).join(' ')
  }
  return ramp
}

/** Restyles the whole app (every brand-* class) around this colour, or back to the default. */
export function applyBrandColor(hex: string | undefined) {
  const root = document.documentElement
  const ramp = hex && hex.toLowerCase() !== DEFAULT_PRIMARY ? brandRamp(hex) : null
  for (const step of STEPS) {
    if (ramp) root.style.setProperty(`--brand-${step}`, ramp[step])
    else root.style.removeProperty(`--brand-${step}`)
  }
  try {
    if (ramp) localStorage.setItem(STORAGE_KEY, hex!.toLowerCase())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode or storage blocked: the colour is simply fetched again next time.
  }
}

/** Applies the colour used last time, before the first paint, so the page does not flash blue first. */
export function restoreBrandColor() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && isHexColor(saved)) applyBrandColor(saved)
  } catch {
    // Nothing to restore.
  }
}
