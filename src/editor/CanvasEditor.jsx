import { Stage, Layer } from 'react-konva';
import { useEditorStore } from './useEditorStore';
import ElementRenderer from './ElementRenderer';
import MoveableWrapper from './MoveableWrapper';
import FloatingToolbar from './FloatingToolbar';
import TextEditorOverlay from './TextEditorOverlay';

export default function CanvasEditor() {
  const elements = useEditorStore((s) => s.elements);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);

  const selectedElement = elements.find((el) => el.id === selectedId);

  return (
    <div className="w-full h-full flex-1 bg-slate-800 relative">
      <Stage
        width={window.innerWidth}
        height={500}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            setSelectedId(null);
          }
        }}
        className="cursor-default"
      >
        <Layer>
          {elements.map((el) => (
            <ElementRenderer key={el.id} element={el} />
          ))}
        </Layer>
      </Stage>

      {selectedElement && <MoveableWrapper element={selectedElement} />}
      <FloatingToolbar />
      <TextEditorOverlay />
    </div>
  );
}