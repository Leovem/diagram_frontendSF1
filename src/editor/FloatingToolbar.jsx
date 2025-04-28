import { useEditorStore } from './useEditorStore';

export default function FloatingToolbar() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const elements = useEditorStore((s) => s.elements);
  const updateElement = useEditorStore((s) => s.updateElement);
  const deleteElement = useEditorStore((s) => s.deleteElement);

  const selected = elements.find((el) => el.id === selectedId);

  if (!selected) return null;

  const changeColor = () => {
    const color = prompt('Nuevo color (hex o nombre):', selected.fill);
    if (color) updateElement(selected.id, { fill: color });
  };

  return (
    <div className="absolute top-2 right-2 z-50 flex gap-2">
      <button
        onClick={changeColor}
        className="bg-yellow-500 hover:bg-yellow-600 text-sm text-white px-3 py-1 rounded shadow"
      >
        🎨 Color
      </button>
      <button
        onClick={() => deleteElement(selected.id)}
        className="bg-red-500 hover:bg-red-600 text-sm text-white px-3 py-1 rounded shadow"
      >
        🗑 Eliminar
      </button>
    </div>
  );
}