import { useEffect } from 'react'
import { useT } from '../i18n'

interface Props {
  title: string
  text: string
  loading?: boolean
  onRefresh?: () => void
  onClose: () => void
}

// Generic in-app log viewer (used for docker compose logs). Modal, not a bottom dock.
export function LogsModal({ title, text, loading, onRefresh, onClose }: Props): JSX.Element {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logs-modal-head">
          <h2>{title}</h2>
          {onRefresh && (
            <button className="btn" onClick={onRefresh} disabled={loading}>
              {loading ? t('common.loading') : t('logs.refresh')}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <pre className="logs-modal-body">
          <code>{loading ? t('common.loading') : text || t('logs.empty')}</code>
        </pre>
      </div>
    </div>
  )
}
