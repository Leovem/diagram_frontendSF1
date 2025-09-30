import { useEffect } from 'react'
import { useEditor } from 'tldraw'

export default function ERUndoRedoHotkeys() {
  const editor = useEditor()

  useEffect(() => {
    if (typeof window === 'undefined' || !editor) return

    const isTyping = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable === true
      )
    }

    const undoCompat = () => {
      try {
        if (typeof editor.undo === 'function') editor.undo()
        else if (editor.history && typeof editor.history.undo === 'function') editor.history.undo()
      } catch (err) {
        console.error('[ERUndoRedoHotkeys] undo error:', err)
      }
    }

    const redoCompat = () => {
      try {
        if (typeof editor.redo === 'function') editor.redo()
        else if (editor.history && typeof editor.history.redo === 'function') editor.history.redo()
      } catch (err) {
        console.error('[ERUndoRedoHotkeys] redo error:', err)
      }
    }

    const onKey = (e) => {
      try {
        if (isTyping()) return
        if (!(e.metaKey || e.ctrlKey)) return

        const k = (e.key || '').toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          undoCompat()
          return
        }
        if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault()
          redoCompat()
          return
        }
      } catch (err) {
        console.error('[ERUndoRedoHotkeys] key handler error:', err)
      }
    }

    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [editor])

  return null
}
