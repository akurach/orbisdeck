// App accent color (the active-tab / highlight blue). Stored in localStorage and applied
// as the --accent CSS variable so it themes the whole UI. Not a full theme system yet.

const KEY = 'orbisdeck:accent'
export const DEFAULT_ACCENT = '#58a6ff'

export const ACCENT_PRESETS = [
  '#58a6ff', // blue (default)
  '#3fb950', // green
  '#bc8cff', // purple
  '#d29922', // amber
  '#ff7b72', // red
  '#39c5cf', // teal
  '#f778ba' // pink
]

export function getAccent(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

export function applyAccent(color?: string): void {
  const c = color || getAccent()
  document.documentElement.style.setProperty('--accent', c)
}

export function setAccent(color: string): void {
  try {
    localStorage.setItem(KEY, color)
  } catch {
    /* storage unavailable */
  }
  applyAccent(color)
}
