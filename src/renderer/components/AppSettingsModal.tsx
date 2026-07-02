import { useEffect, useState } from 'react'
import { useLocale, LOCALES, LOCALE_LABEL } from '../i18n'
import { ACCENT_PRESETS, getAccent, setAccent } from '../state/accent'
import { type Density, getDensity, setDensity } from '../state/density'

// App version — kept in sync with src-tauri/tauri.conf.json on release.
const APP_VERSION = '0.1.0'

interface Props {
  onClose: () => void
}

export function AppSettingsModal({ onClose }: Props): JSX.Element {
  const { t, locale, setLocale } = useLocale()
  const [accent, setAccentState] = useState(getAccent())
  const [density, setDensityState] = useState<Density>(getDensity())

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickAccent = (color: string): void => {
    setAccent(color)
    setAccentState(color)
  }

  const pickDensity = (d: Density): void => {
    setDensity(d)
    setDensityState(d)
  }
  const DENSITIES: Density[] = ['comfortable', 'compact']

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal app-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="app-settings-head">
          <h2>{t('appSettings.title')}</h2>
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        <div className="app-settings-body">
          <section className="app-settings-section">
            <div className="git-section-label">{t('appSettings.appearance')}</div>

            <div className="field">
              <label>{t('appSettings.accent')}</label>
              <div className="accent-swatches">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    className={`accent-swatch ${accent.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                    style={{ background: c }}
                    title={c}
                    aria-label={c}
                    onClick={() => pickAccent(c)}
                  />
                ))}
                <input
                  type="color"
                  className="accent-custom"
                  value={accent}
                  title={accent}
                  onChange={(e) => pickAccent(e.target.value)}
                />
              </div>
              <span className="field-hint">{t('appSettings.accentHint')}</span>
            </div>

            <div className="field">
              <label>{t('appSettings.language')}</label>
              <div className="lang-toggle">
                {LOCALES.map((l) => (
                  <button
                    key={l}
                    className={`viewer-toggle-btn ${locale === l ? 'active' : ''}`}
                    onClick={() => setLocale(l)}
                  >
                    {LOCALE_LABEL[l]}
                  </button>
                ))}
              </div>
              <span className="field-hint">{t('appSettings.languageHint')}</span>
            </div>

            <div className="field">
              <label>{t('appSettings.density')}</label>
              <div className="lang-toggle">
                {DENSITIES.map((d) => (
                  <button
                    key={d}
                    className={`viewer-toggle-btn ${density === d ? 'active' : ''}`}
                    onClick={() => pickDensity(d)}
                  >
                    {t(`appSettings.density.${d}`)}
                  </button>
                ))}
              </div>
              <span className="field-hint">{t('appSettings.densityHint')}</span>
            </div>
          </section>

          <section className="app-settings-section">
            <div className="git-section-label">{t('appSettings.about')}</div>
            <div className="about-block">
              <span className="about-brand">⬡ OrbisDeck</span>
              <span className="about-version">{t('appSettings.version', { v: APP_VERSION })}</span>
              <span className="about-tagline">{t('appSettings.aboutTagline')}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
