import { Tldraw, TldrawEditor, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from './socketService'; 

function GenerateCodePanel({ setHtmlCode, setCssCode, roomName }) {
  const editor = useEditor();

  const handleGenerateCode = () => {
    const shapes = editor.getCurrentPageShapes();
    let html = '';
    let css = '';
    let counter = 1;
    const usedTextIds = new Set();

    shapes.forEach((shape) => {
      const customId = `element-${counter++}`;

      if (shape.type === 'geo') {
        const possibleText = shapes.find(s =>
          s.type === 'text' &&
          s.x >= shape.x && s.x <= shape.x + shape.props.w &&
          s.y >= shape.y && s.y <= shape.y + shape.props.h
        );

        if (possibleText) {
          const textValue = possibleText.props.richText?.content?.[0]?.content?.[0]?.text || '';
          if (['enviar', 'submit', 'ok'].includes(textValue.toLowerCase())) {
            html += `<button class="${customId}">${textValue}</button>\n`;
            usedTextIds.add(possibleText.id);
          } else {
            html += `<div class="${customId}"></div>\n`;
          }
        } else {
          html += `<div class="${customId}"></div>\n`;
        }

        css += `.${customId} {
  position: absolute;
  top: ${shape.y}px;
  left: ${shape.x}px;
  width: ${shape.props.w}px;
  height: ${shape.props.h}px;
  background-color: ${shape.props.fill === 'none' ? 'transparent' : shape.props.fill};
  border: 1px solid #000;
}
        `;
      }

      if (shape.type === 'text' && !usedTextIds.has(shape.id)) {
        const textCustomId = `element-${counter++}`;
        const textContent = shape.props.richText?.content?.[0]?.content?.[0]?.text || '';
        html += `<p class="${textCustomId}">${textContent}</p>\n`;
        css += `.${textCustomId} {
  position: absolute;
  top: ${shape.y}px;
  left: ${shape.x}px;
  font-size: 16px;
}
        `;
      }
    });

    setHtmlCode(html);
    setCssCode(css);
    socket.emit('codeGenerated', { roomName, htmlCode: html, cssCode: css });
  };

  return (
    <button
      onClick={handleGenerateCode}
      className="absolute top-1 left-85 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition"
    >
      Generar Código
    </button>
  );
}

export default function MyCanvas() {
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  
  const { roomName } = useParams();

  useEffect(() => {
    if (!roomName) {
      console.log("❌ No se detectó roomName");
      return;
    }
  
    console.log(`📢 Intentando unirme a la sala: ${roomName}`);
  
    const handleConnect = () => {
      console.log('✅ Conectado, ahora emitir joinRoom');
      socket.emit('joinRoom', roomName);
    };
  
    if (socket.connected) {
      handleConnect();
    } else {
      socket.once('connect', handleConnect);
    }
    return () => {
        socket.off('connect', handleConnect);
        console.log('🛑 Cleanup sin desconectar');
      };
  }, [roomName]);
  useEffect(() => {
    const handleReceiveCode = ({ htmlCode, cssCode }) => {
      console.log('📩 Código recibido');
      setHtmlCode(htmlCode);
      setCssCode(cssCode);
    };
  
    socket.on('receiveCode', handleReceiveCode);
  
    return () => {
      socket.off('receiveCode', handleReceiveCode);
    };
  }, []);
  return (
    <div className="flex h-screen">
      <div className="flex-2 border-r border-gray-300 relative">
        {/* <TldrawEditor> */}
        <Tldraw>
          <TldrawSync roomName={roomName} />
          <GenerateCodePanel setHtmlCode={setHtmlCode} setCssCode={setCssCode} roomName={roomName} />
        </Tldraw>
        {/* </TldrawEditor> */}
      </div>
      <div className="flex-1 p-6 overflow-auto bg-gray-900 text-white">
        <h3 className="text-xl font-semibold mb-2">HTML</h3>
        <pre className="bg-gray-800 p-4 rounded-md text-sm whitespace-pre-wrap">{htmlCode}</pre>
        <h3 className="text-xl font-semibold mt-6 mb-2">CSS</h3>
        <pre className="bg-gray-800 p-4 rounded-md text-sm whitespace-pre-wrap">{cssCode}</pre>
      </div>
    </div>
  );
}



function TldrawSync({ roomName }) {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    // 🔵 Cuando el usuario crea/mueve/edita shapes, enviamos al server
    const onShapeChange = (snapshot) => {
      if (!snapshot) return;

      const allShapes = Array.from(editor.store.allRecords())
        .filter(record => record.typeName === 'shape'); // solo los shapes

      socket.emit('shapeChange', { roomName, shapes: allShapes }); // enviamos correctamente
    };

    const unsubscribe = editor.store.listen(onShapeChange, { source: 'user' });

    return () => {
      unsubscribe(); // limpiar
    };
  }, [editor, roomName]);

  useEffect(() => {
    if (!editor) return;

    // 🔵 Cuando recibimos shapes de otros usuarios
    const handleReceiveShapes = ({ shapes }) => {
      if (!Array.isArray(shapes)) {
        console.error('shapes no es un array:', shapes);
        return;
      }

      // 🔵 Actualizar editor con los nuevos shapes
      shapes.forEach(shape => {
        try {
          const existingShape = editor.getShape(shape.id);
          if (existingShape) {
            editor.updateShape(shape); // si ya existe, actualizar
          } else {
            editor.createShape(shape); // si no existe, crear
          }
        } catch (error) {
          console.error('Error aplicando shape recibido:', error);
        }
      });
    };

    socket.on('receiveShapes', handleReceiveShapes);

    return () => {
      socket.off('receiveShapes', handleReceiveShapes);
    };
  }, [editor, roomName]);

  return null; // no pinta nada en pantalla
}
