// src/ER_diagram/ui/ERPalette.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from 'tldraw';
import { useVoiceRelations } from '../../voice/useVoiceRelations';
import { useGeminiVision } from '../imageRecognition/useGeminiVision';
import { convertToShapes } from '../imageRecognition/shapeConverter';

const IconBtn = ({ onClick, title, children, className = '', ...rest }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={
      'relative w-10 h-10 grid place-items-center rounded-lg border border-slate-200 bg-white/90 hover:bg-slate-50 shadow-sm transition ' +
      className
    }
    {...rest}
  >
    <span className="text-lg leading-none">{children}</span>
  </button>
);






const ERPalette = () => {
  const editor = useEditor();
  const { analyzeImage, loading, error: visionError } = useGeminiVision();
  const [showRelMenu, setShowRelMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const relMenuRef = useRef(null);

  // ====== VOZ ======
  const [feedback, setFeedback] = useState(null); // { type: 'hint'|'success'|'error', message: string }
  const [showFeedback, setShowFeedback] = useState(false);
  const autohideRef = useRef(null);

  const pushFeedback = (evt) => {
    setFeedback(evt);
    setShowFeedback(true);
  };

  const { supported, listening, error, start, stop } = useVoiceRelations(editor, {
    lang: 'es-419',
    onFeedback: pushFeedback,
    keepAlive: true,
  });

  const toggleMic = () => {
    // al activar, escondemos el aviso previo
    if (!listening) setShowFeedback(false);
    listening ? stop() : start();
  };

  const handleImageUpload = async (file) => {
  if (!file) return;
  try {
    const response = await analyzeImage(file);

    // ✅ Imprimir la respuesta completa de la IA
    console.log('🧠 Respuesta completa de la IA:', response);

    const jsonText = response.replace(/```(json)?/g, '').trim();
    const data = JSON.parse(jsonText);

    convertToShapes(data, editor);
    setFeedback({ type: 'success', message: '✅ Diagrama reconocido e insertado.' });
    setShowFeedback(true);
  } catch (err) {
    console.error('Error IA:', err);
    setFeedback({ type: 'error', message: 'Error analizando imagen con IA.' });
    setShowFeedback(true);
  }
};

  // Autohide según severidad
  useEffect(() => {
    // si llega un error desde el hook, también lo mostramos como feedback
    if (error) {
      setFeedback({ type: 'error', message: error });
      setShowFeedback(true);
    }
  }, [error]);

  useEffect(() => {
    if (!showFeedback) return;
    clearTimeout(autohideRef.current);
    const ms =
      feedback?.type === 'error' ? 5000 :
        feedback?.type === 'success' ? 2800 :
          2800; // hint / success
    autohideRef.current = setTimeout(() => setShowFeedback(false), ms);
    return () => clearTimeout(autohideRef.current);
  }, [showFeedback, feedback]);

  // Atajos: Shift+V (toggle), Esc (stop y cierra feedback)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        stop();
        setShowFeedback(false);
      }
      if (e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listening]);

  // Cerrar menú relaciones al hacer click fuera o con ESC
  useEffect(() => {
    const onDocDown = (e) => {
      if (!showRelMenu) return;
      const el = relMenuRef.current;
      if (el && !el.contains(e.target)) setShowRelMenu(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setShowRelMenu(false);
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [showRelMenu]);

  if (!editor) return null;

  // Crear entidad
  const createEntity = () => {
    try {
      const vb = editor.getViewportPageBounds();
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      editor.createShape({
        type: 'entity-table',
        x: cx - 160,
        y: cy - 100,
        props: {
          w: 320,
          h: 180,
          name: 'Nueva_Entidad',
          attrs: [
            { id: crypto.randomUUID(), name: 'id', type: 'uuid', pk: true, unique: false, nullable: false },
          ],
        },
      });
    } catch (error) {
      console.error('Error creando entidad:', error);
      setFeedback({ type: 'error', message: 'No se pudo crear la entidad.' });
      setShowFeedback(true);
    }
  };

  // Crear relación con preset
  const createRelationPreset = (preset) => {
    console.log(preset);
    try {
      const vb = editor.getViewportPageBounds();
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;

      let aCard = '1', bCard = '1..*', name = 'relacion', relationType = 'association';
      if (preset === '1-1') { aCard = '1'; bCard = '1'; name = 'uno_a_uno'; }
      if (preset === '1-N') { aCard = '1'; bCard = '1..*'; name = 'uno_a_muchos'; }
      if (preset === 'N-N') { aCard = '1..*'; bCard = '1..*'; name = 'muchos_a_muchos'; }

      if (preset === 'inheritance') {
        relationType = 'inheritance'; name = 'hereda'; aCard = '-1'; bCard = '-1';
      }
      if (preset === 'composition') {
        relationType = 'composition'; name = 'compone'; aCard = '-2'; bCard = '-2';
      }
      if (preset === 'aggregation') {
        relationType = 'aggregation'; name = 'agrega'; aCard = '-3'; bCard = '-3';
      }

      editor.createShape({
        type: 'relation-edge',
        x: cx,
        y: cy,
        props: {
          aEntityId: null,
          bEntityId: null,
          aFree: { x: -80, y: 0 },
          bFree: { x: 80, y: 0 },
          aCard,
          bCard,
          waypoints: [],
          orthogonal: false,
          identifying: false,
          name,
          relationType,
        },
      });

      setShowRelMenu(false);
    } catch (error) {
      console.error('Error creando relación:', error);
      setFeedback({ type: 'error', message: 'No se pudo crear la relación.' });
      setShowFeedback(true);
    }
  };

  const zoomToFit = () => editor.zoomToFit();
  const clearCanvas = () => {
    if (!confirm('¿Limpiar todo el canvas?')) return;
    const all = editor.getCurrentPageShapes();
    editor.deleteShapes(all.map((s) => s.id));
  };

  const badgeColor =
    (feedback?.type === 'error') ? 'bg-rose-500' :
      (feedback?.type === 'success') ? 'bg-emerald-500' :
        'bg-slate-400';

  return (
    <div className="absolute top-4 left-4 z-[1000]" style={{ pointerEvents: 'none' }}>
      <div className={`flex ${collapsed ? 'flex-col-reverse' : 'flex-col'} gap-1`} style={{ pointerEvents: 'auto' }}>
        {/* Toggle tamaño */}
        <IconBtn onClick={() => setCollapsed((s) => !s)} title={collapsed ? 'Expandir paleta' : 'Colapsar paleta'} className="backdrop-blur">
          {collapsed ? '▤' : '▦'}
        </IconBtn>

        {/* Toolbar */}
        <div className={`flex ${collapsed ? 'hidden' : 'flex'} flex-col gap-1 p-1 bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow`}>
          <IconBtn onClick={createEntity} title="Nueva entidad (tabla)">🏗️</IconBtn>

          {/* Relación + menú */}
          <div className="relative" ref={relMenuRef}>
            <IconBtn onClick={() => setShowRelMenu((v) => !v)} title="Nueva relación (elegir tipo)">🔗</IconBtn>
            {showRelMenu && (
              <div className="absolute left-12 top-0 bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden" role="menu">
                <button onClick={() => createRelationPreset('1-1')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem">1 — 1 (uno a uno)</button>
                <button onClick={() => createRelationPreset('1-N')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem">1 — N (uno a muchos)</button>
                <button onClick={() => createRelationPreset('N-N')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem" title="M:N – podrás crear tabla intermedia desde la relación">N — N (muchos a muchos)</button>
                <hr className="my-1 border-slate-200" />
                <button onClick={() => createRelationPreset('inheritance')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem">Herencia</button>
                <button onClick={() => createRelationPreset('composition')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem">Composición</button>
                <button onClick={() => createRelationPreset('aggregation')} className="block w-40 text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem">Agregación</button>
              </div>
            )}
          </div>

          <IconBtn onClick={zoomToFit} title="Ajustar vista">🔍</IconBtn>
          <IconBtn onClick={clearCanvas} title="Limpiar todo">🧹</IconBtn>
          {/* IA: reconocimiento de diagrama */}
<div className="relative">
  <IconBtn title="Importar desde imagen (IA)">
    🧠
    <input
      type="file"
      accept="image/*"
      title="Cargar imagen de diagrama ER"
      className="absolute inset-0 opacity-0 cursor-pointer"
      onChange={(e) => handleImageUpload(e.target.files[0])}
    />
  </IconBtn>
  {loading && (
    <div className="absolute left-12 top-0 bg-white text-slate-800 text-xs px-2 py-1 rounded shadow">
      Analizando imagen…
    </div>
  )}
</div>


          {/* Mic */}
          <div className="relative">
            <IconBtn
              onClick={toggleMic}
              title={!supported ? 'Este navegador no soporta Web Speech API' : listening ? 'Detener voz (Esc)' : 'Activar voz (Shift+V)'}
              disabled={!supported}
              className={listening ? 'ring-2 ring-indigo-300 animate-pulse' : ''}
            >
              <span className="relative inline-block">
                {listening ? '⏹️' : '🎤'}
                <span className={`absolute -bottom-1 -right-1 h-2 w-2 rounded-full ${listening ? 'bg-green-500' : 'bg-slate-400'} ring-2 ring-white`} />
              </span>
            </IconBtn>

            {/* Panel feedback — ahora es ocultable */}
            {showFeedback && (feedback || error) && (
              <div className="absolute left-12 top-0 w-72 max-w-[75vw] rounded-lg bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur p-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">Voz relaciones</div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor}`} />
                    <button
                      className="text-slate-300 hover:text-white text-xs px-1 py-0.5 rounded"
                      onClick={() => setShowFeedback(false)}
                      title="Cerrar"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed">
                  <p className={
                    feedback?.type === 'success' ? 'text-emerald-300'
                      : feedback?.type === 'error' ? 'text-rose-300'
                        : 'text-slate-300'
                  }>
                    {feedback?.message || 'Di: "Crea relación uno a muchos de Usuarios a Pedidos".'}
                  </p>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Atajos: <kbd className="px-1 py-0.5 bg-slate-800 rounded">Shift</kbd>+<kbd className="px-1 py-0.5 bg-slate-800 rounded">V</kbd>, <kbd className="px-1 py-0.5 bg-slate-800 rounded">Esc</kbd>
                </div>
              </div>
            )}
          </div>
          {/* /Mic */}
        </div>
      </div>
    </div>
  );
};

export default ERPalette;
