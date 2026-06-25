import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { messages } from './messages'

// Lightweight i18n layer — no runtime dep. Strings live in ./messages keyed by a flat
// `namespace.key` id; t(key, vars) looks the active locale up and interpolates {var}
// placeholders. Locale is persisted in localStorage and defaults to the system language.

export type Locale = 'ru' | 'en'
export const LOCALES: Locale[] = ['ru', 'en']
export const LOCALE_LABEL: Record<Locale, string> = { ru: 'Русский', en: 'English' }

const KEY = 'orbisdeck:locale'

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  const sys = (typeof navigator !== 'undefined' && navigator.language) || 'en'
  return sys.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function persist(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* storage unavailable */
  }
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = messages[locale] || {}
  let s = dict[key]
  if (s === undefined) {
    // Fall back to the other locale, then to the raw key — never crash on a missing string.
    const other = locale === 'ru' ? 'en' : 'ru'
    s = messages[other]?.[key] ?? key
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return s
}

interface Ctx {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TFn
}

const LocaleContext = createContext<Ctx | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = useCallback((l: Locale): void => {
    persist(l)
    setLocaleState(l)
  }, [])

  const t = useCallback<TFn>((key, vars) => translate(locale, key, vars), [locale])

  const value = useMemo<Ctx>(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): Ctx {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}

// Convenience: just the t() function for components that only translate.
export function useT(): TFn {
  return useLocale().t
}
