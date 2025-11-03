// src/ER_diagram/MyEditor.jsx
import React, { useEffect, useState } from 'react';
import { Tldraw, useEditor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useParams } from 'react-router-dom';
import { saveAs } from 'file-saver';

import { socket } from './socketService';
import { generateFlutterProject } from '../services/authService';

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
  const [loadingFlutter, setLoadingFlutter] = useState(false);

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

  async function generateAndDownloadFlutterProject() {
    try {
      setLoadingFlutter(true);

      const erGraph = shapesToERGraph(editor);
      console.log('ERGraph generado (JSON):', JSON.stringify(erGraph, null, 2));
      const payload = generatePayload(erGraph);
      console.log('Payload generado (JSON):', JSON.stringify(payload, null, 2));

      const zipBlob = await generateFlutterProject(payload);

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getTimestampedName("flutter_project", "zip");
      a.click();
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setLoadingFlutter(false);
    }
  }

  function generatePayload(erGraph) {
    const classes = erGraph.entities.map((entity) => {
      return {
        id: entity.id,
        name: entity.name,
        attributes: entity.attributes.map((attr) => ({
          name: attr.name,
          type: mapTypeToBackend(attr.type),
        })),
      };
    });

    const relationships = erGraph.relations.map((relation) => {
      const endA = relation.ends[0];
      const endB = relation.ends[1];

      return {
        id: relation.id,
        sourceId: endA.entityId,
        targetId: endB.entityId,
        type: determineRelationshipType(endA.cardinality, endB.cardinality),
      };
    });

    return {
      classes,
      relationships
    };
  }

  function determineRelationshipType(cardA, cardB) {
    const cA = cardA.toLowerCase();
    const cB = cardB.toLowerCase();

    if (cA === '-1' || cB === '-1') {
      return 'inheritance';
    }

    if (cA === '-2' || cB === '-2') {
      return 'composition';
    }

    if (cA === '-3' || cB === '-3') {
      return 'aggregation';
    }

    const isMany = (card) => card === 'n' || card === 'm' || card === '1..*';

    const isOne = (card) => card === '1' || card === '0-1';

    if (isOne(cA) && isOne(cB)) {
      return 'one_to_one';
    }

    if (isMany(cA) && isMany(cB)) {
      return 'many_to_many';
    }

    if (isOne(cA) && isMany(cB)) {
      return 'one_to_many';
    }

    if (isMany(cA) && isOne(cB)) {
      return 'one_to_many';
    }

    return 'unknown_relationship';
  }

  function mapTypeToBackend(internalType) {
    const type = internalType.toLowerCase();

    if (type === 'string' || type === 'text') return 'String';
    if (type === 'integer' || type === 'int') return 'Long';
    if (type === 'long' || type === 'bigint') return 'Long';
    if (type === 'boolean') return 'Boolean';
    if (type === 'date' || type === 'datetime') return 'Date';
    if (type === 'float' || type === 'double') return 'Double';
    if (type === 'uuid') return 'Long';

    return 'String';
  }

  function getTimestampedName(baseName, extension) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    return `${baseName}_${timestamp}.${extension}`;
  }

  return (
    <div className="absolute top-2 left-2 z-[1000] flex gap-2">
      <button
        onClick={onGenerate}
        disabled={loading}
        className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-lg transition"
      >
        {loading ? 'Generando…' : 'Generar Backend (SQL + ZIP)'}
      </button>
      <button
        onClick={generateAndDownloadFlutterProject}
        disabled={loadingFlutter}
        className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-lg transition"
      >
        {loading ? 'Generando…' : 'Generar Frontend (ZIP)'}
      </button>
    </div>
  );
}

/* =========================
   Sincronización colaborativa
========================= */
function TldrawSync({ roomName }) {
  const editor = useEditor()
  const isApplyingRemote = React.useRef(false)

  // ids que vimos en el último envío local (para detectar deletes locales)
  const prevIdsRef = React.useRef(new Set())
  // tombstones: id -> expiresAt (ms) para evitar “revivir” tras un delete
  const tombstonesRef = React.useRef(new Map())

  // ---------- emitir cambios locales (throttle ~30fps) ----------
  useEffect(() => {
    if (!editor) return

    let raf = null
    let lastSent = 0

    const snapshotUpserts = () =>
      editor.getCurrentPageShapes().map(s => ({
        id: s.id,
        type: s.type,
        parentId: s.parentId,
        x: s.x, y: s.y, rotation: s.rotation, index: s.index,
        props: s.props,
      }))

    const computeDeletes = (currIds) => {
      const prev = prevIdsRef.current
      const dels = []
      for (const id of prev) if (!currIds.has(id)) dels.push(id)
      // actualiza prevIds para el próximo diff
      prevIdsRef.current = new Set(currIds)
      return dels
    }

    const send = () => {
      const shapes = editor.getCurrentPageShapes()
      const currIds = new Set(shapes.map(s => s.id))
      const upserts = shapes.map(s => ({
        id: s.id,
        type: s.type,
        parentId: s.parentId,
        x: s.x, y: s.y, rotation: s.rotation, index: s.index,
        props: s.props,
      }))
      const deletes = computeDeletes(currIds)

      socket.emit('shapeChange', { roomName, upserts, deletes })
    }

    const onLocalChange = () => {
      if (isApplyingRemote.current) return
      const now = performance.now()
      if (now - lastSent < 33) return // ~30fps
      lastSent = now

      if (raf) return
      raf = requestAnimationFrame(() => { raf = null; send() })
    }

    // Inicializa prevIds al montar (para que los primeros deletes se calculen bien)
    prevIdsRef.current = new Set(editor.getCurrentPageShapes().map(s => s.id))

    const unsub = editor.store.listen(onLocalChange, { source: 'user' })
    return () => {
      unsub?.()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [editor, roomName])

  // ---------- recibir cambios remotos ----------
  useEffect(() => {
    if (!editor) return

    const upsertOne = (s) => {
      const existing = editor.getShape?.(s.id)
      if (existing) {
        if (typeof editor.updateShape === 'function') editor.updateShape(s)
        else editor.updateShapes?.([s])
      } else {
        if (typeof editor.createShape === 'function') editor.createShape(s)
        else editor.createShapes?.([s])
      }
    }

    const applyRemote = ({ from, ts, upserts = [], deletes = [] }) => {
      if (from === socket.id) return
      isApplyingRemote.current = true
      const now = Date.now()

      const run = () => {
        // 1) upserts (ignorando los que están en tombstone vigente)
        for (const s of upserts) {
          const tomb = tombstonesRef.current.get(s.id)
          if (tomb && tomb > now) continue // sigue “borrada”, no la revivas
          try { upsertOne(s) } catch (e) { console.warn('[sync] upsert fail', e) }
        }
        // 2) deletes (al final, para que ganen)
        if (deletes.length) {
          try {
            if (typeof editor.deleteShapes === 'function') editor.deleteShapes(deletes)
            else deletes.forEach(id => editor.deleteShape?.(id))
          } catch (e) { console.warn('[sync] delete fail', e) }
          // marca tombstones por 2s
          const expire = now + 2000
          for (const id of deletes) tombstonesRef.current.set(id, expire)
        }
      }

      if (typeof editor.store.mergeRemoteChanges === 'function') editor.store.mergeRemoteChanges(run)
      else if (typeof editor.batch === 'function') editor.batch(run)
      else run()

      // Actualiza prevIds local para que el próximo diff no “resucite” lo borrado
      const currIds = new Set(editor.getCurrentPageShapes().map(s => s.id))
      prevIdsRef.current = currIds

      isApplyingRemote.current = false
    }

    socket.on('receiveShapes', applyRemote)
    return () => socket.off('receiveShapes', applyRemote)
  }, [editor])

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
            Toolbar: Noop,
            StylePanel: Noop,
            ActionsMenu: Noop,
            MainMenu: Noop,
            //ContextMenu:  Noop,
            QuickActions: Noop,
            Minimap: Noop,
            ZoomMenu: Noop,
            PageMenu: Noop,
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