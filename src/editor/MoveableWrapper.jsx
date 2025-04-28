import Moveable from 'react-moveable';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './useEditorStore';

export default function MoveableWrapper({ element }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const ref = useRef(null);
  const [frame, setFrame] = useState({
    translate: [element.x, element.y],
    rotate: element.rotation,
  });

  useEffect(() => {
    setFrame({ translate: [element.x, element.y], rotate: element.rotation });
  }, [element]);

  return (
    <>
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: `rotate(${frame.rotate}deg)`
        }}
      />

      <Moveable
        target={ref.current}
        draggable
        resizable
        rotatable
        throttleDrag={0}
        throttleResize={0}
        throttleRotate={0}
        onDrag={({ beforeTranslate }) => {
          updateElement(element.id, {
            x: beforeTranslate[0],
            y: beforeTranslate[1],
          });
        }}
        onResize={({ width, height, drag, target }) => {
          // Limpia transform visual que Moveable aplica por defecto
          target.style.transform = '';
        
          // Aplica cambios reales al estado
          updateElement(element.id, {
            width: parseFloat(width),
            height: parseFloat(height),
            x: drag.beforeTranslate[0],
            y: drag.beforeTranslate[1],
          });
        }}
        onRotate={({ beforeRotate }) => {
          updateElement(element.id, {
            rotation: beforeRotate,
          });
        }}
        renderDirections={["nw", "ne", "sw", "se"]}
        keepRatio={false}
        edge={false}
      />
    </>
  );
}