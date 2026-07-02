// UI density (M9 W3): 'comfortable' (default) or 'compact'. Chrome only — sets a
// `data-density` attribute on <html> that a small set of CSS overrides key off. Mirrors
// accent.ts (localStorage + apply-before-paint). The terminal is deliberately untouched:
// xterm carries its own metrics and re-fitting it on a density flip isn't worth the churn.

export type Density = 'comfortable' | 'compact'
const KEY = 'orbisdeck:density'
export const DEFAULT_DENSITY: Density = 'comfortable'

export function getDensity(): Density {
  try {
    return localStorage.getItem(KEY) === 'compact' ? 'compact' : DEFAULT_DENSITY
  } catch {
    return DEFAULT_DENSITY
  }
}

export function applyDensity(d?: Density): void {
  document.documentElement.setAttribute('data-density', d || getDensity())
}

export function setDensity(d: Density): void {
  try {
    localStorage.setItem(KEY, d)
  } catch {
    /* storage unavailable */
  }
  applyDensity(d)
}
