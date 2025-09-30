import { useEditor } from 'tldraw'
import { useEffect } from 'react'

export default function ERDeleteHotkeys() {
  const editor = useEditor()

  useEffect(() => {
    if (!editor) return

    const isTyping = () => {
      const el = document.activeElement
      return !!el && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      )
    }

    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping()) {
        const ids = editor.getSelectedShapeIds?.() ?? []
        if (!ids.length) return
        e.preventDefault()
        if (typeof editor.deleteShapes === 'function') editor.deleteShapes(ids)
        else if (typeof editor.deleteShape === 'function') ids.forEach(id => editor.deleteShape(id))
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  return null
}
