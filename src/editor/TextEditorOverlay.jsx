import { useEditorStore } from './useEditorStore';
import { useEffect, useRef } from 'react';

export default function TextEditorOverlay() {
  const elements = useEditorStore((s) => s.elements);
  const selectedId = useEditorStore((s) => s.selectedId);
  const updateElement = useEditorStore((s) => s.updateElement);
  const editing = useEditorStore((s) => s.editing);
  const setEditing = useEditorStore((s) => s.setEditing);
  const inputRef = useRef(null);

  const selected = elements.find((el) => el.id === selectedId && el.type === 'text');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setEditing(false);
      }
    };
    if (editing) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing]);

  if (!selected || !editing) return null;

  // ✅ Posicionamiento absoluto respecto al canvas
  const canvas = document.querySelector('canvas');
  const bounds = canvas.getBoundingClientRect();

  const top = bounds.top + selected.y;
  const left = bounds.left + selected.x;
  //console.log('Renderizando input editable', { editing, selected });
  return (
    <input
      ref={inputRef}
      autoFocus
      value={selected.text}
      onChange={(e) => updateElement(selected.id, { text: e.target.value })}
      onBlur={() => setEditing(false)}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${selected.width}px`,
        height: '30px',
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#0f172a',
        background: '#f8fafc',
        padding: '6px',
        borderRadius: '6px',
        outline: 'none',
        border: '2px solid #38bdf8',
        zIndex: 9999,
        pointerEvents: 'auto', // 👈 asegúrate de esto
      }}
    />
  );
}