import { useEditorStore } from './useEditorStore';
import { ELEMENT_TYPES } from './types/elementTypes';

export default function Toolbar() {
  const addElement = useEditorStore((s) => s.addElement);

  return (
    <div className="flex gap-4 p-4 bg-slate-900 text-white">
      <button onClick={() => addElement(ELEMENT_TYPES.RECT)} className="bg-blue-600 px-4 py-2 rounded">
        Agregar Rect
      </button>
      <button onClick={() => addElement(ELEMENT_TYPES.TEXT)} className="bg-green-600 px-4 py-2 rounded">
        Agregar Texto
      </button>
    </div>
  );
}