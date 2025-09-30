// src/ai/VoiceRelationsButton.jsx
import { useEffect, useState } from 'react'
import { useEditor } from 'tldraw'
import { useVoiceRelations } from './useVoiceRelations'

export default function VoiceRelationsButton({ editor: editorProp, lang = 'es-419', className = '' }) {
  const editor = editorProp || useEditor()
  const [feedback, setFeedback] = useState(null) // {type, message}
  const [visible, setVisible] = useState(false)

  const { supported, listening, error, start, stop } = useVoiceRelations(editor, {
    lang,
    onFeedback: (evt) => { setFeedback(evt); setVisible(true) },
    keepAlive: true,
  })

  const toggle = () => {
    if (!listening) setVisible(false)
    listening ? stop() : start()
  }

  // autohide avisos (2.8s hint/success, 5s error)
  useEffect(() => {
    if (!visible) return
    const ms = feedback?.type === 'error' ? 5000 : 2800
    const t = setTimeout(() => setVisible(false), ms)
    return () => clearTimeout(t)
  }, [visible, feedback])

  // atajos
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { stop(); setVisible(false) }
      if (e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listening])

  const badge =
    error || feedback?.type === 'error' ? 'bg-rose-500'
    : feedback?.type === 'success' ? 'bg-emerald-500'
    : 'bg-slate-400'

  return (
    <div className={`fixed right-4 top-1/2 -translate-y-1/2 z-[1000] ${className}`} style={{ pointerEvents: 'none' }}>
      <div className="flex flex-col items-end gap-2" style={{ pointerEvents: 'auto' }}>
        {/* Botón mic */}
        <button
          type="button"
          onClick={toggle}
          disabled={!supported}
          title={!supported ? 'Navegador sin Web Speech API' : listening ? 'Detener voz (Esc)' : 'Activar voz (Shift+V)'}
          className={[
            'relative h-12 w-12 rounded-full shadow-lg transition grid place-items-center',
            supported ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-500 opacity-60',
            listening && 'ring-4 ring-indigo-300/60 animate-pulse',
          ].join(' ')}
        >
          <span className="text-white text-lg">{listening ? '⏹️' : '🎤'}</span>
          <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${listening ? 'bg-green-400' : 'bg-slate-400'} ring-2 ring-white`} />
        </button>

        {/* Aviso */}
        {(visible || error) && (
          <div className="w-72 max-w-[85vw] rounded-xl bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Voz relaciones</div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${badge}`} />
                <button className="text-slate-300 hover:text-white text-xs" onClick={() => { /* cerrar */ (setVisible(false)) }}>×</button>
              </div>
            </div>
            <div className="mt-2 text-xs leading-relaxed">
              {error ? (
                <p className="text-rose-300">⚠️ {error}</p>
              ) : feedback ? (
                <p className={
                  feedback.type === 'success' ? 'text-emerald-300'
                  : feedback.type === 'error' ? 'text-rose-300'
                  : 'text-slate-300'
                }>
                  {feedback.message}
                </p>
              ) : (
                <p className="text-slate-300">Tip: “Crea relación uno a muchos de Usuarios a Pedidos”.</p>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Atajos: <kbd className="px-1 py-0.5 bg-slate-800 rounded">Shift</kbd>+<kbd className="px-1 py-0.5 bg-slate-800 rounded">V</kbd>, <kbd className="px-1 py-0.5 bg-slate-800 rounded">Esc</kbd>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
