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
// Reemplaza TldrawSync completo por este:
function TldrawSync({ roomName }) {
  const editor = useEditor()
  const isApplyingRemote = React.useRef(false)
  const rafSend = React.useRef(null)
  const lastSentAt = React.useRef(0)

  // ---- emitir cambios locales (throttle) ----
  useEffect(() => {
    if (!editor) return

    const snapshot = () => {
      // Solo shapes visibles en la página actual; datos mínimos
      return editor.getCurrentPageShapes().map(s => ({
        id: s.id,
        type: s.type,
        parentId: s.parentId,
        x: s.x,
        y: s.y,
        rotation: s.rotation,
        index: s.index,
        props: s.props,
      }))
    }

    const send = () => {
      try {
        socket.emit('shapeChange', { roomName, from: socket.id, shapes: snapshot() })
      } catch (err) {
        console.error('[sync] emit error:', err)
      }
    }

    const onLocalChange = () => {
      if (isApplyingRemote.current) return // no emitir mientras aplico remoto
      const now = performance.now()
      if (now - lastSentAt.current < 33) return // ~30fps
      lastSentAt.current = now

      if (rafSend.current) return
      rafSend.current = requestAnimationFrame(() => {
        rafSend.current = null
        send()
      })
    }

    const unsub = editor.store.listen(onLocalChange, { source: 'user' })
    return () => {
      unsub?.()
      if (rafSend.current) cancelAnimationFrame(rafSend.current)
    }
  }, [editor, roomName])

  // ---- recibir y aplicar del servidor ----
  useEffect(() => {
    if (!editor) return

    const upsert = (s) => {
      const existing = editor.getShape?.(s.id)
      if (existing) {
        if (typeof editor.updateShape === 'function') editor.updateShape(s)
        else editor.updateShapes?.([s])
      } else {
        if (typeof editor.createShape === 'function') editor.createShape(s)
        else editor.createShapes?.([s])
      }
    }

    const applyRemote = (shapes) => {
      const run = () => { for (const s of shapes) { try { upsert(s) } catch (e) { console.warn('[sync] upsert fail', e) } } }
      // aplica en lote para no disparar listeners por cada shape
      if (typeof editor.store.mergeRemoteChanges === 'function') editor.store.mergeRemoteChanges(run)
      else if (typeof editor.batch === 'function') editor.batch(run)
      else run()
    }

    const handleReceiveShapes = ({ from, shapes }) => {
      try {
        if (from === socket.id) return          // ignora eco
        if (!Array.isArray(shapes) || !shapes.length) return
        isApplyingRemote.current = true
        applyRemote(shapes)
      } catch (err) {
        console.error('[sync] apply error:', err)
      } finally {
        isApplyingRemote.current = false
      }
    }

    socket.on('receiveShapes', handleReceiveShapes)
    return () => socket.off('receiveShapes', handleReceiveShapes)
  }, [editor, roomName])

  return null
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