import { Rect, Text } from 'react-konva';
import { useEditorStore } from './useEditorStore';
import { ELEMENT_TYPES } from './types/elementTypes';

export default function ElementRenderer({ element }) {
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setEditing = useEditorStore((s) => s.setEditing);
  const isSelected = selectedId === element.id;

  const commonProps = {
    x: element.x,
    y: element.y,
    width: element.width,
    rotation: element.rotation,
    fill: element.fill,
    draggable: true,
    onClick: () => setSelectedId(element.id),
    onDragEnd: (e) => {
      updateElement(element.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
  };

  // 🟦 Rectángulo normal
  if (element.type === ELEMENT_TYPES.RECT) {
    return (
      <Rect
        {...commonProps}
        height={element.height} // solo RECT usa height
        stroke={isSelected ? 'cyan' : undefined}
        strokeWidth={2}
      />
    );
  }

  // 📝 Texto editable
  if (element.type === ELEMENT_TYPES.TEXT) {
    return (
      <Text
        {...commonProps}
        text={element.text}
        fontSize={20}
        align="left"
        verticalAlign="top"
        onClick={() => {
          setSelectedId(element.id);
          setTimeout(() => setEditing(true), 50);
        }}
        onDblTap={() => {
          setSelectedId(element.id);
          setTimeout(() => setEditing(true), 50); // soporte móvil
        }}
        stroke={isSelected ? 'cyan' : undefined}
      />
    );
  }

  return null;
}