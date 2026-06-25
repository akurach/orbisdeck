import { useEffect } from 'react'

interface Props {
  title: string
  text: string
  loading?: boolean
  onRefresh?: () => void
  onClose: () => void
}

// Generic in-app log viewer (used for docker compose logs). Modal, not a bottom dock.
export function LogsModal({ title, text, loading, onRefresh, onClose }: Props): JSX.Element {
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
              {loading ? '…' : 'Обновить'}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <pre className="logs-modal-body">
          <code>{loading ? '…' : text || '(пусто)'}</code>
        </pre>
      </div>
    </div>
  )
}
