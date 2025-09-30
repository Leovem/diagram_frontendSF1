// src/ER_diagram/ui/ERInspector.jsx (versión robusta)
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, stopEventPropagation } from 'tldraw'

/**
 * ERInspector — Inspector robusto para Entidades y Relaciones
 *
 * Mejoras clave:
 *  - Suscripción reactiva a la selección (sin hacer getSelectedShapes() en cada render)
 *  - Draft local + commit en blur / botones (evita perder foco por updateShape)
 *  - Validaciones y clamps en números
 *  - Acciones rápidas para relaciones: presets 1-1, 1-N, N-N, invertir A/B
 *  - Botón para añadir atributo (desde el inspector)
 *  - Copiar SQL de la entidad (generación simple desde props)
 *  - Bloqueo de propagación de eventos para no interferir con el canvas
 */

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))

export default function ERInspector() {
  const editor = useEditor()

  // ======= Selección reactiva =======
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!editor) return
    const read = () => {
      const sel = editor.getSelectedShapes()
      setSelected(sel && sel.length ? sel[0] : null)
    }
    read()
    const unsub = editor.store.listen(read, { source: 'user' })
    return () => unsub()
  }, [editor])

  // ======= Drafts por tipo =======
  const [entityDraft, setEntityDraft] = useState({ name: '', w: 280, h: 160, count: 0 })
  const [relDraft, setRelDraft] = useState({ name: '', aCard: '1', bCard: '1..*' })
  const [collapsed, setCollapsed] = useState(false)

  // Sincroniza drafts cuando cambia selected
  useEffect(() => {
    if (!selected) return
    if (selected.type === 'entity-table') {
      setEntityDraft({
        name: selected.props?.name ?? 'Entidad',
        w: selected.props?.w ?? 280,
        h: selected.props?.h ?? 160,
        count: Array.isArray(selected.props?.attrs) ? selected.props.attrs.length : 0,
      })
    } else if (selected.type === 'relation-edge') {
      setRelDraft({
        name: selected.props?.name ?? 'relacion',
        aCard: selected.props?.aCard ?? '1',
        bCard: selected.props?.bCard ?? '1..*',
      })
    }
    setCollapsed(false)
  }, [selected])

  const updateProps = (partial) => {
    if (!selected) return
    try {
      editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, ...partial } })
    } catch (e) {
      console.error('Error updating shape:', e)
    }
  }

  // ======= Acciones Entidad =======
  const commitEntity = () => {
    updateProps({ w: clamp(Number(entityDraft.w), 200, 1200), h: clamp(Number(entityDraft.h), 120, 2000), name: entityDraft.name || 'Entidad' })
  }

  const addAttribute = () => {
    if (!selected || selected.type !== 'entity-table') return
    const attrs = Array.isArray(selected.props.attrs) ? [...selected.props.attrs] : []
    attrs.push({ id: crypto.randomUUID(), name: 'campo', type: 'string', pk: false, unique: false, nullable: true })
    const nextH = Math.max(160, 44 + 16 + 34 * attrs.length)
    updateProps({ attrs, h: nextH })
  }

  const copyEntitySQL = async () => {
    if (!selected || selected.type !== 'entity-table') return
    const { name, attrs = [] } = selected.props
    const idRe = /^[A-Za-z_][A-Za-z0-9_]*$/
    const san = (s) => {
      const t = (s || '').trim().replace(/[^A-Za-z0-9_]/g, '_')
      return /^[A-Za-z_]/.test(t) ? t : '_' + t
    }
    const table = san(name || 'tabla')
    const cols = attrs.filter((a) => (a?.name || '').trim()).map((a) => {
      const n = san(a.name)
      const type = a.type || 'text'
      const flags = []
      if (a.pk) flags.push('PRIMARY KEY')
      if (a.unique && !a.pk) flags.push('UNIQUE')
      if (a.nullable === false) flags.push('NOT NULL')
      return `${n} ${type}${flags.length ? ' ' + flags.join(' ') : ''}`
    })
    const sql = cols.length ? `CREATE TABLE ${table} (\n  ${cols.join(',\n  ')}\n);` : `CREATE TABLE ${table} ();`
    try { await navigator.clipboard.writeText(sql) } catch {}
  }

  // ======= Acciones Relación =======
  const commitRelation = () => {
    updateProps({ name: relDraft.name || 'relacion', aCard: relDraft.aCard, bCard: relDraft.bCard })
  }

  const setPreset = (type) => {
    if (type === '1-1') setRelDraft((d) => ({ ...d, aCard: '1', bCard: '1' }))
    else if (type === '1-N') setRelDraft((d) => ({ ...d, aCard: '1', bCard: '1..*' }))
    else if (type === 'N-N') setRelDraft((d) => ({ ...d, aCard: '1..*', bCard: '1..*' }))
  }

  const swapAB = () => {
    if (!selected || selected.type !== 'relation-edge') return
    // Intercambia extremos y cardinalidades
    const { aEntityId, bEntityId, aCard, bCard } = selected.props
    updateProps({ aEntityId: bEntityId, bEntityId: aEntityId, aCard: bCard, bCard: aCard })
    setRelDraft((d) => ({ ...d, aCard: d.bCard, bCard: d.aCard }))
  }

  // ======= UI =======
  if (!selected && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute right-2 top-14 z-[1000] bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg shadow-lg transition-colors"
        title="Mostrar inspector"
      >
        📋
      </button>
    )
  }

  return (
    <div
      className="absolute right-2 top-14 z-[1000] bg-white/95 backdrop-blur-sm dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-w-sm"
      onPointerDown={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      onDoubleClick={stopEventPropagation}
      onWheel={stopEventPropagation}
      style={{ pointerEvents: 'all' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
        <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <span>📋</span>
          Inspector
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded"
          title="Colapsar inspector"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {!selected ? (
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <span>👆</span>
            Selecciona una entidad o relación para editarla
          </div>
        ) : selected.type === 'entity-table' ? (
          <>
            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">🏗️ Entidad seleccionada</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">ID: {String(selected.id).slice(0, 8)}...</div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📝 Nombre de la Entidad</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={entityDraft.name}
                onChange={(e) => setEntityDraft((d) => ({ ...d, name: e.target.value }))}
                onBlur={commitEntity}
                placeholder="Nombre de la entidad"
              />
            </div>

            {/* Dimensiones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📐 Dimensiones</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ancho</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    value={entityDraft.w}
                    onChange={(e) => setEntityDraft((d) => ({ ...d, w: e.target.value }))}
                    onBlur={commitEntity}
                    min="200"
                    max="1200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Alto</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    value={entityDraft.h}
                    onChange={(e) => setEntityDraft((d) => ({ ...d, h: e.target.value }))}
                    onBlur={commitEntity}
                    min="120"
                    max="2000"
                  />
                </div>
              </div>
            </div>

            {/* Resumen y acciones */}
            <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-xs text-green-700 dark:text-green-300"><strong>📊 Atributos:</strong> {entityDraft.count}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={addAttribute}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  ➕ Añadir atributo
                </button>
                <button
                  onClick={copyEntitySQL}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  title="Copiar SQL de esta entidad"
                >
                  📄 Copiar SQL
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">🔗 Relación seleccionada</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">ID: {String(selected.id).slice(0, 8)}...</div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🏷️ Nombre de la Relación</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={relDraft.name}
                onChange={(e) => setRelDraft((d) => ({ ...d, name: e.target.value }))}
                onBlur={commitRelation}
                placeholder="Nombre de la relación"
              />
            </div>

            {/* Cardinalidades */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🔢 Cardinalidades</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entidad A</label>
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800"
                    value={relDraft.aCard}
                    onChange={(e) => setRelDraft((d) => ({ ...d, aCard: e.target.value }))}
                    onBlur={commitRelation}
                  >
                    <option value="1">1 (uno)</option>
                    <option value="0..1">0..1 (cero o uno)</option>
                    <option value="1..*">1..* (uno o más)</option>
                    <option value="0..*">0..* (cero o más)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entidad B</label>
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-800"
                    value={relDraft.bCard}
                    onChange={(e) => setRelDraft((d) => ({ ...d, bCard: e.target.value }))}
                    onBlur={commitRelation}
                  >
                    <option value="1">1 (uno)</option>
                    <option value="0..1">0..1 (cero o uno)</option>
                    <option value="1..*">1..* (uno o más)</option>
                    <option value="0..*">0..* (cero o más)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={() => setPreset('1-1')} className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded text-xs">1–1</button>
                <button onClick={() => setPreset('1-N')} className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded text-xs">1–N</button>
                <button onClick={() => setPreset('N-N')} className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-2 py-1 rounded text-xs">N–N</button>
                <button onClick={swapAB} className="flex-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-700 dark:hover:bg-amber-600 px-2 py-1 rounded text-xs" title="Intercambiar extremos">⇄ A/B</button>
              </div>
            </div>

            {/* Estado */}
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                <strong>🔗 Estado:</strong>{' '}
                {selected.props?.aEntityId && selected.props?.bEntityId ? 'Conectada' : 'Sin conectar'}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {selected.props?.aEntityId && selected.props?.bEntityId ? 'Relación establecida correctamente' : 'Arrastra los extremos a las entidades para conectar'}
              </div>
            </div>
          </>
        )}

        {/* Acciones rápidas comunes */}
        {selected && (
          <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
            <div className="flex gap-2">
              <button
                onClick={() => editor.deleteShapes([selected.id])}
                className="flex-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                🗑️ Eliminar
              </button>
              <button
                onClick={() => {
                  const dup = editor.duplicateShapes([selected.id])
                  if (dup.length > 0) editor.setSelectedShapes([dup[0].id])
                }}
                className="flex-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                📋 Duplicar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
