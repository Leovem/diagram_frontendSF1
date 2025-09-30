// src/ER_diagram/MyEditor.jsx
import React, { useEffect, useState } from 'react';
import { Tldraw, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useParams } from 'react-router-dom';
import { saveAs } from 'file-saver';

import { socket } from './socketService';

// Shapes personalizados - IMPORTA LOS UTILS, NO LOS SHAPES
import { EntityTableShapeUtil } from './shapes/EntityTableShape';
import { RelationEdgeShapeUtil } from './shapes/RelationEdgeShape';

// UI extra
import ERPalette from './ui/ERPalette';
import ERInspector from './ui/ERInspector';
import ERDeleteHotkeys from './ui/ERDeleteHotkeys'


// Parser ER
import { shapesToERGraph } from './erParser';

// Generador (SQL + Spring ZIP como Blob)
import { generateAll } from '../Diagram/generatorback';


/* =========================
   Botón para generar backend
========================= */
function GenerateBackendPanel({ roomName, setSql, setZipBlob }) {
  const editor = useEditor();
  const [loading, setLoading] = useState(false);

  const onGenerate = async () => {
    try {
      setLoading(true);
      const erGraph = shapesToERGraph(editor);

      // difunde snapshot ER opcionalmente
      socket.emit('graphGenerated', { roomName, graph: erGraph });

      const { sql, zipBlob } = await generateAll(erGraph, {
        packageBase: 'com.misa.case',
        projectName: 'er-backend',
      });

      setSql(sql);
      setZipBlob(zipBlob);
    } catch (e) {
      console.error(e);
      alert('Error al generar backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-2 left-2 z-[1000] flex gap-2">
      <button
        onClick={onGenerate}
        disabled={loading}
        className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-lg transition"
      >
        {loading ? 'Generando…' : 'Generar Backend (SQL + ZIP)'}
      </button>
    </div>
  );
}

/* =========================
   Sincronización colaborativa
========================= */
function TldrawSync({ roomName }) {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;
    
    const onShapeChange = () => {
      const allShapes = Array.from(editor.store.allRecords())
        .filter((r) => r.typeName === 'shape');
      socket.emit('shapeChange', { roomName, shapes: allShapes });
    };
    
    const unsub = editor.store.listen(onShapeChange, { source: 'user' });
    return () => unsub();
  }, [editor, roomName]);

  useEffect(() => {
    if (!editor) return;
    
    const handleReceiveShapes = ({ shapes }) => {
      if (!Array.isArray(shapes)) return;
      
      shapes.forEach((s) => {
        try {
          const existing = editor.getShape(s.id);
          if (existing) {
            editor.updateShape(s);
          } else {
            editor.createShape(s);
          }
        } catch (err) {
          console.error('Error aplicando shape recibido:', err);
        }
      });
    };
    
    socket.on('receiveShapes', handleReceiveShapes);
    return () => socket.off('receiveShapes', handleReceiveShapes);
  }, [editor, roomName]);

  return null;
}

/* =========================
   Editor principal
========================= */
export default function MyEditor() {
  const { roomName } = useParams();
  const [sql, setSql] = useState('');
  const [zipBlob, setZipBlob] = useState(null);

  // Configuración de shapes personalizados
  const customShapeUtils = [EntityTableShapeUtil, RelationEdgeShapeUtil];

  // join de sala
  useEffect(() => {
    if (!roomName) return;
    
    const onConnect = () => socket.emit('joinRoom', roomName);
    
    if (socket.connected) {
      onConnect();
    } else {
      socket.once('connect', onConnect);
    }
    
    return () => socket.off('connect', onConnect);
  }, [roomName]);

  // recibir ER de otros (opcional)
  useEffect(() => {
    const handleReceiveGraph = ({ graph }) => {
      console.log('📩 ER Graph recibido:', graph);
    };
    
    socket.on('receiveGraph', handleReceiveGraph);
    return () => socket.off('receiveGraph', handleReceiveGraph);
  }, []);

  const downloadSql = () => {
    if (!sql) return;
    saveAs(new Blob([sql], { type: 'text/sql;charset=utf-8' }), 'schema.sql');
  };

  const downloadZip = () => {
    if (!zipBlob) return;
    saveAs(zipBlob, 'spring-backend.zip');
  };

  const Noop = () => null;
  
  return (
    <div className="flex h-screen">
      {/* Canvas */}
      <div className="flex-2 border-r border-gray-300 relative">
        <Tldraw
            licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY} 
            shapeUtils={customShapeUtils}
            hideUi
            components={{
                Toolbar:      Noop,
                StylePanel:   Noop,
                ActionsMenu:  Noop,
                MainMenu:     Noop,
                //ContextMenu:  Noop,
                QuickActions: Noop,
                Minimap:      Noop,
                ZoomMenu:     Noop,
                PageMenu:     Noop,
                KeyboardShortcutsDialog: Noop,
                HelperButtons: Noop,
        }}
        options={{
        maxShapes: 1000,
        maxPages: 10,
        }}
>
  {/* Tu UI personalizada se mantiene */}
  <TldrawSync roomName={roomName} />
  <ERPalette />
  <ERInspector />
  <ERDeleteHotkeys />

  <GenerateBackendPanel 
    roomName={roomName} 
    setSql={setSql} 
    setZipBlob={setZipBlob} 
  />
    </Tldraw>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 p-6 overflow-auto bg-gray-900 text-white">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={downloadSql}
            disabled={!sql}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-2 rounded transition-colors"
          >
            📄 Descargar SQL
          </button>
          <button
            onClick={downloadZip}
            disabled={!zipBlob}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded transition-colors"
          >
            📦 Descargar Spring ZIP
          </button>
        </div>

        <h3 className="text-xl font-semibold mb-2">SQL generado</h3>
        <pre className="bg-gray-800 p-4 rounded-md text-sm whitespace-pre-wrap max-h-[60vh] overflow-auto border border-gray-700">
{sql || '// Usa la paleta para crear Entidades y Relaciones, luego presiona "Generar Backend".'}
        </pre>

        {zipBlob && (
          <div className="mt-4">
            <h4 className="text-lg font-medium mb-2">Spring Boot Backend</h4>
            <p className="text-sm text-gray-400">
              ZIP generado con {Math.round(zipBlob.size / 1024)} KB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}