// src/ER_diagram/shapes/EntityTableShapeUtil.tsx
import * as React from 'react'
import {
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
  useEditor,
  TLShapePartial,
  stopEventPropagation,
} from 'tldraw'

/* =====================================
   Tipos
===================================== */
export type EntityAttr = {
  id: string
  name: string
  type: string
  pk?: boolean
  unique?: boolean
  nullable?: boolean
}

export type EntityTableShapeType = TLBaseShape<
  'entity-table',
  {
    w: number
    h: number
    name: string
    attrs: EntityAttr[]
  }
>

/* =====================================
   Constantes de UI
===================================== */
const ROW_H = 34
const HEADER_H = 52
const PADDING = 16
const MIN_H = 160
const DATA_TYPES = ['uuid', 'string', 'text', 'int', 'float', 'boolean', 'date', 'timestamp']

const calcHeight = (rows: number) => Math.max(MIN_H, HEADER_H + PADDING + rows * ROW_H)
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const sanitizeIdent = (s: string) => {
  const t = (s ?? '').trim()
  if (!t) return ''
  const basic = t.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(basic) ? basic : '_' + basic
}

/* =====================================
   Conectores (tipo y helpers)
===================================== */
export type Pt = { x: number; y: number }
export type EntityConnPoint = {
  key: string
  x: number // coordenada local (dentro del rectángulo de la entidad)
  y: number // coordenada local
  kind: 'corner' | 'mid' | 'row'
  side?: 'top' | 'right' | 'bottom' | 'left'
  rowIndex?: number // si kind === 'row'
}

/** Puntos locales (esquinas, medios y por-fila izquierda/derecha) */
export function getEntityLocalConnectionPoints(shape: EntityTableShapeType): EntityConnPoint[] {
  const { w, h, attrs } = shape.props
  const pts: EntityConnPoint[] = []

  // Esquinas
  pts.push({ key: 'corner-tl', x: 0, y: 0, kind: 'corner', side: 'top' })
  pts.push({ key: 'corner-tr', x: w, y: 0, kind: 'corner', side: 'top' })
  pts.push({ key: 'corner-bl', x: 0, y: h, kind: 'corner', side: 'bottom' })
  pts.push({ key: 'corner-br', x: w, y: h, kind: 'corner', side: 'bottom' })

  // Medios de cada lado
  pts.push({ key: 'mid-top', x: w / 2, y: 0, kind: 'mid', side: 'top' })
  pts.push({ key: 'mid-right', x: w, y: h / 2, kind: 'mid', side: 'right' })
  pts.push({ key: 'mid-bottom', x: w / 2, y: h, kind: 'mid', side: 'bottom' })
  pts.push({ key: 'mid-left', x: 0, y: h / 2, kind: 'mid', side: 'left' })

  // Por fila (centro vertical de cada fila), conectores en izquierda y derecha
  const bodyTop = HEADER_H + 10
  attrs.forEach((_, idx) => {
    const cy = bodyTop + idx * ROW_H + ROW_H / 2
    if (cy >= 0 && cy <= h) {
      pts.push({ key: `row-${idx}-L`, x: 0, y: cy, kind: 'row', side: 'left', rowIndex: idx })
      pts.push({ key: `row-${idx}-R`, x: w, y: cy, kind: 'row', side: 'right', rowIndex: idx })
    }
  })

  return pts
}

/** Puntos en coordenadas de página (usa los bounds de la forma) */
export function getEntityPageConnectionPoints(
  editor: ReturnType<typeof useEditor>,
  shape: EntityTableShapeType
): (EntityConnPoint & { pageX: number; pageY: number })[] {
  const bounds = editor.getShapePageBounds(shape)!
  const locals = getEntityLocalConnectionPoints(shape)
  return locals.map((p) => ({
    ...p,
    pageX: bounds.x + p.x,
    pageY: bounds.y + p.y,
  }))
}

/** Punto de conexión más cercano a un punto de página (si está a <= maxDist) */
export function getNearestEntityConnectionPoint(
  editor: ReturnType<typeof useEditor>,
  shape: EntityTableShapeType,
  pagePoint: Pt,
  maxDist = 28
): null | {
  point: EntityConnPoint & { pageX: number; pageY: number }
  offset: Pt // offset local dentro de la entidad (para anclar exacto)
  distance: number
} {
  const pts = getEntityPageConnectionPoints(editor, shape)
  let best: any = null
  let bestD = Infinity
  for (const p of pts) {
    const dx = pagePoint.x - p.pageX
    const dy = pagePoint.y - p.pageY
    const d = Math.hypot(dx, dy)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  if (best && bestD <= maxDist) {
    return {
      point: best,
      offset: { x: best.x, y: best.y }, // local offset dentro de la entidad
      distance: bestD,
    }
  }
  return null
}

/* =====================================
   Shape Util
===================================== */
export class EntityTableShapeUtil extends ShapeUtil<EntityTableShapeType> {
  static override type = 'entity-table' as const

  static override props: RecordProps<EntityTableShapeType> = {
    w: T.number,
    h: T.number,
    name: T.string,
    attrs: T.arrayOf(
      T.object({
        id: T.string,
        name: T.string,
        type: T.string,
        pk: T.boolean.optional(),
        unique: T.boolean.optional(),
        nullable: T.boolean.optional(),
      })
    ),
  }

  override getDefaultProps(): EntityTableShapeType['props'] {
    return {
      w: 320,
      h: MIN_H,
      name: 'Entidad',
      attrs: [],
    }
  }

  override getGeometry(shape: EntityTableShapeType) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  /* ===== Resize soportado (handles del bounding box) ===== */
  override canResize(): boolean {
    return true
  }

  // tldraw invoca esta función durante el resize; devolvemos nuevos w/h
  override onResize(shape: EntityTableShapeType, info: { scaleX: number; scaleY: number }) {
    const rows = shape.props.attrs?.length ?? 0
    const minH = calcHeight(rows)
    const nextW = clamp(Math.round(shape.props.w * info.scaleX), 220, 1600)
    const nextH = clamp(Math.round(shape.props.h * info.scaleY), minH, 2400)
    return { props: { w: nextW, h: nextH } }
  }

  /* ===== Exportación a SQL ===== */
  private exportToSQL(shape: EntityTableShapeType): string {
    const table = sanitizeIdent(shape.props.name) || 'tabla'
    const cols = (shape.props.attrs ?? [])
      .filter((a) => (a?.name ?? '').trim())
      .map((a) => {
        const name = sanitizeIdent(a.name)
        const type = a.type || 'text'
        const flags: string[] = []
        if (a.pk) flags.push('PRIMARY KEY')
        if (a.unique && !a.pk) flags.push('UNIQUE')
        if (a.nullable === false) flags.push('NOT NULL')
        return `${name} ${type}${flags.length ? ' ' + flags.join(' ') : ''}`
      })
    return cols.length ? `CREATE TABLE ${table} (\n  ${cols.join(',\n  ')}\n);` : `CREATE TABLE ${table} ();`
  }

  /* ===== Render principal ===== */
  override component(shape: EntityTableShapeType) {
    const editor = useEditor()
    const { w, h, name, attrs } = shape.props
    const selected = editor.getSelectedShapeIds().includes(shape.id)

    // refs seguros
    const nameRef = React.useRef<HTMLInputElement | null>(null)
    const attrNameRefs = React.useRef<Map<string, HTMLInputElement>>(new Map())
    const setAttrNameRef = React.useCallback((id: string, el: HTMLInputElement | null) => {
      if (!el) attrNameRefs.current.delete(id)
      else attrNameRefs.current.set(id, el)
    }, [])
    const focusAttrName = React.useCallback((id: string) => {
      const el = attrNameRefs.current.get(id)
      if (el) {
        el.focus()
        el.select()
      }
    }, [])

    // helpers update
    const updateShape = React.useCallback(
      (partial: Partial<EntityTableShapeType['props']>) => {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { ...shape.props, ...partial },
        } as TLShapePartial<EntityTableShapeType>)
      },
      [editor, shape]
    )

    const addAttrAt = React.useCallback(
      (index?: number) => {
        const newAttr: EntityAttr = {
          id: crypto.randomUUID(),
          name: 'campo',
          type: 'string',
          pk: false,
          unique: false,
          nullable: true,
        }
        const list = [...attrs]
        if (index == null || index < 0 || index > list.length) list.push(newAttr)
        else list.splice(index, 0, newAttr)
        updateShape({ attrs: list, h: calcHeight(list.length) })
        setTimeout(() => focusAttrName(newAttr.id), 0)
      },
      [attrs, updateShape, focusAttrName]
    )

    const delAttr = React.useCallback(
      (id: string) => {
        const list = attrs.filter((a) => a.id !== id)
        updateShape({ attrs: list, h: calcHeight(list.length) })
      },
      [attrs, updateShape]
    )

    const patchAttr = React.useCallback(
      (id: string, changes: Partial<EntityAttr>) => {
        const list = attrs.map((a) => (a.id === id ? { ...a, ...changes } : a))
        updateShape({ attrs: list })
      },
      [attrs, updateShape]
    )

    const moveAttr = React.useCallback(
      (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= attrs.length || to >= attrs.length) return
        const list = [...attrs]
        const [row] = list.splice(from, 1)
        list.splice(to, 0, row)
        updateShape({ attrs: list })
      },
      [attrs, updateShape]
    )

    // copiar SQL
    const onCopySQL = React.useCallback(() => {
      const sql = this.exportToSQL(shape)
      navigator.clipboard?.writeText(sql).catch(() => {})
    }, [shape])

    // hotkeys (solo si shape seleccionado y no hay input activo)
    React.useEffect(() => {
      if (!editor.getSelectedShapeIds().includes(shape.id)) return
      const onKey = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null
        const editing =
          !!active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'SELECT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !editing) {
          e.preventDefault()
          onCopySQL()
        }
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [editor, onCopySQL, shape.id])

    // DnD reorder
    const dragIndexRef = React.useRef<number | null>(null)

    // Menú contextual
    const [ctxMenu, setCtxMenu] = React.useState<{
      open: boolean
      x: number
      y: number
      attrId?: string
    }>({ open: false, x: 0, y: 0 })
    const openAttrMenu = (e: React.MouseEvent, attrId: string) => {
      e.preventDefault()
      e.stopPropagation()
      setCtxMenu({ open: true, x: e.clientX, y: e.clientY, attrId })
    }
    React.useEffect(() => {
      const close = () => setCtxMenu((s) => (s.open ? { ...s, open: false } : s))
      window.addEventListener('pointerdown', close)
      return () => window.removeEventListener('pointerdown', close)
    }, [])

    /* ========= Render ========= */
    return (
      <HTMLContainer>
        {/* Contenedor raíz – permite arrastrar desde el header */}
        <div
          style={{
            pointerEvents: 'all',
            position: 'absolute',
            width: w,
            height: h,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.06)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header: zona de arrastre y doble click para editar nombre */}
          <div
            onDoubleClick={() => {
              nameRef.current?.focus()
              nameRef.current?.select()
            }}
            title="Arrastra aquí para mover la tabla"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'linear-gradient(180deg, #eef2ff 0%, #e2e8f0 100%)',
              borderBottom: '1px solid #d8dee9',
              cursor: 'grab',
              position: 'relative',
            }}
          >
            {/* franja lateral decorativa */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background:
                  'linear-gradient(180deg, rgba(99,102,241,0.9) 0%, rgba(14,165,233,0.9) 100%)',
              }}
            />
            <input
              ref={nameRef}
              defaultValue={name}
              onBlur={(e) =>
                updateShape({ name: e.currentTarget.value.trim() || 'Entidad' })
              }
              onPointerDown={stopEventPropagation}
              onKeyDownCapture={stopEventPropagation}
              placeholder="Entidad"
              aria-label="Nombre de la entidad"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontWeight: 700,
                fontSize: 14,
                color: '#0f172a',
                paddingLeft: 4,
              }}
            />
            <button
              onPointerDown={stopEventPropagation}
              onClick={onCopySQL}
              title="Copiar como SQL"
              aria-label="Copiar estructura de la tabla como SQL"
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
              }}
            >
              SQL
            </button>
          </div>

          {/* Body: bloquea propagación para que NO mueva el shape */}
          <div
            onPointerDown={stopEventPropagation}
            onPointerUp={stopEventPropagation}
            onDoubleClick={stopEventPropagation}
            onWheel={stopEventPropagation}
            style={{ padding: 10, height: h - HEADER_H, overflowY: 'auto', fontSize: 13 }}
          >
            <datalist id={`dt-${shape.id}`}>
              {DATA_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>

            {attrs.map((a, idx) => (
              <div
                key={a.id}
                data-row
                onDoubleClick={() => focusAttrName(a.id)}
                onContextMenu={(e) => openAttrMenu(e, a.id)}
                draggable
                onDragStart={() => (dragIndexRef.current = idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragIndexRef.current
                  if (from == null) return
                  moveAttr(from, idx)
                  dragIndexRef.current = null
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16px 1.5fr 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 6px',
                  borderRadius: 8,
                  background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                  transition: 'background 0.12s ease, box-shadow 0.12s ease',
                }}
                onPointerEnter={(e) =>
                  (e.currentTarget.style.boxShadow =
                    'inset 0 0 0 1px rgba(2,132,199,0.15)')
                }
                onPointerLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* handle de fila */}
                <span
                  title="Arrastrar para reordenar"
                  style={{ cursor: 'grab', userSelect: 'none', color: '#64748b', fontSize: 14 }}
                >
                  ⋮⋮
                </span>

                {/* Nombre */}
                <input
                  ref={(el) => setAttrNameRef(a.id, el)}
                  data-attr-id={a.id}
                  name="attr-name"
                  defaultValue={a.name}
                  onBlur={(e) => patchAttr(a.id, { name: e.currentTarget.value || 'campo' })}
                  onKeyDownCapture={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    stopEventPropagation(e as any)
                    const v = (e.currentTarget.value ?? '').trim()
                    if (e.key === 'Backspace' && v === '') {
                      e.preventDefault()
                      delAttr(a.id)
                    } else if (e.key === 'Delete') {
                      e.preventDefault()
                      delAttr(a.id)
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      addAttrAt(idx + 1)
                    } else if (e.key === 'ArrowDown') {
                      const row = e.currentTarget.closest('[data-row]') as HTMLElement | null
                      const next = row?.nextElementSibling as HTMLElement | null
                      const nextEl = next?.querySelector<HTMLInputElement>('input[name="attr-name"]')
                      nextEl?.focus()
                      nextEl?.select()
                    } else if (e.key === 'ArrowUp') {
                      const row = e.currentTarget.closest('[data-row]') as HTMLElement | null
                      const prev = row?.previousElementSibling as HTMLElement | null
                      const prevEl = prev?.querySelector<HTMLInputElement>('input[name="attr-name"]')
                      prevEl?.focus()
                      prevEl?.select()
                    }
                  }}
                  placeholder="campo"
                  aria-label={`Nombre del atributo ${a.name}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 12,
                    boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
                  }}
                />

                {/* Tipo (con datalist) */}
                <input
                  list={`dt-${shape.id}`}
                  defaultValue={a.type}
                  onBlur={(e) => patchAttr(a.id, { type: e.currentTarget.value })}
                  onKeyDownCapture={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    stopEventPropagation(e as any)
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addAttrAt(idx + 1)
                    } else if (e.key === 'ArrowDown') {
                      const row = e.currentTarget.closest('[data-row]') as HTMLElement | null
                      const next = row?.nextElementSibling as HTMLElement | null
                      const nextEl = next?.querySelector<HTMLInputElement>('input[name="attr-name"]')
                      nextEl?.focus()
                      nextEl?.select()
                    } else if (e.key === 'ArrowUp') {
                      const row = e.currentTarget.closest('[data-row]') as HTMLElement | null
                      const prev = row?.previousElementSibling as HTMLElement | null
                      const prevEl = prev?.querySelector<HTMLInputElement>('input[name="attr-name"]')
                      prevEl?.focus()
                      prevEl?.select()
                    }
                  }}
                  placeholder="tipo"
                  aria-label={`Tipo de dato del atributo ${a.name}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 12,
                    boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
                  }}
                />

                {/* Chips de acciones */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Chip
                    active={!!a.pk}
                    label="PK"
                    title="Primary Key"
                    onClick={() => patchAttr(a.id, { pk: !a.pk, nullable: false })}
                    activeBg="rgba(250, 204, 21, 0.25)"
                    activeBorder="rgba(234, 179, 8, 0.8)"
                  />
                  <Chip
                    active={!!a.unique}
                    label="UQ"
                    title="Unique"
                    onClick={() => patchAttr(a.id, { unique: !a.unique })}
                    activeBg="rgba(16, 185, 129, 0.18)"
                    activeBorder="rgba(16, 185, 129, 0.8)"
                  />
                  <Chip
                    active={a.nullable !== false}
                    label={a.nullable === false ? 'NOT' : 'NULL'}
                    title="Nullable"
                    onClick={() => patchAttr(a.id, { nullable: !(a.nullable !== false) })}
                    activeBg="rgba(59, 130, 246, 0.15)"
                    activeBorder="rgba(59, 130, 246, 0.8)"
                  />
                  <button
                    onClick={() => delAttr(a.id)}
                    title="Eliminar atributo"
                    aria-label={`Eliminar atributo ${a.name}`}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      minWidth: 26,
                      boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => addAttrAt()}
              aria-label="Agregar nuevo atributo"
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: '#06b6d4',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                width: '100%',
                boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
              }}
            >
              + Agregar Atributo
            </button>
          </div>

          {/* Overlay de puntos de conexión (solo cuando la entidad está seleccionada) */}
          {selected && (
            <svg
              width={w}
              height={h}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none', // no bloquea interacciones
              }}
            >
              {getEntityLocalConnectionPoints(shape).map((p) => (
                <g key={p.key} transform={`translate(${p.x}, ${p.y})`}>
                  <circle r={5} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                </g>
              ))}
            </svg>
          )}

          {/* Context menu */}
          {ctxMenu.open && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                position: 'fixed',
                left: ctxMenu.x,
                top: ctxMenu.y,
                zIndex: 99999,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                overflow: 'hidden',
              }}
            >
              <MenuBtn
                label="✏️ Renombrar"
                onClick={() => {
                  setCtxMenu((s) => ({ ...s, open: false }))
                  if (ctxMenu.attrId) focusAttrName(ctxMenu.attrId)
                }}
              />
              <MenuBtn
                label="📄 Duplicar"
                onClick={() => {
                  const id = ctxMenu.attrId!
                  const idx = attrs.findIndex((x) => x.id === id)
                  if (idx >= 0) {
                    const src = attrs[idx]
                    const dup: EntityAttr = {
                      ...src,
                      id: crypto.randomUUID(),
                      name: src.name + '_copy',
                    }
                    const list = [...attrs]
                    list.splice(idx + 1, 0, dup)
                    updateShape({ attrs: list, h: calcHeight(list.length) })
                    setTimeout(() => focusAttrName(dup.id), 0)
                  }
                  setCtxMenu((s) => ({ ...s, open: false }))
                }}
              />
              <MenuBtn
                label="🗑️ Eliminar"
                danger
                onClick={() => {
                  if (ctxMenu.attrId) delAttr(ctxMenu.attrId)
                  setCtxMenu((s) => ({ ...s, open: false }))
                }}
              />
              <Divider />
              <MenuBtn
                label="⬆️ Mover arriba"
                onClick={() => {
                  const id = ctxMenu.attrId!
                  const idx = attrs.findIndex((x) => x.id === id)
                  if (idx > 0) moveAttr(idx, idx - 1)
                  setCtxMenu((s) => ({ ...s, open: false }))
                }}
              />
              <MenuBtn
                label="⬇️ Mover abajo"
                onClick={() => {
                  const id = ctxMenu.attrId!
                  const idx = attrs.findIndex((x) => x.id === id)
                  if (idx >= 0 && idx < attrs.length - 1) moveAttr(idx, idx + 1)
                  setCtxMenu((s) => ({ ...s, open: false }))
                }}
              />
              <Divider />
              <MenuBtn
                label="🔑 Alternar PK"
                onClick={() => {
                  const id = ctxMenu.attrId!
                  const row = attrs.find((x) => x.id === id)
                  if (row) patchAttr(id, { pk: !row.pk, nullable: false })
                  setCtxMenu((s) => ({ ...s, open: false }))
                }}
              />
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: EntityTableShapeType) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5,5"
      />
    )
  }

  override canEdit() {
    return true
  }
  override canReceiveNewChildrenOfType() {
    return false
  }
}

/* =====================================
   Mini componentes
===================================== */
const Chip: React.FC<{
  active: boolean
  label: string
  title: string
  onClick: () => void
  activeBg: string
  activeBorder: string
}> = ({ active, label, title, onClick, activeBg, activeBorder }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    style={{
      padding: '6px 10px',
      borderRadius: 999,
      border: `1px solid ${active ? activeBorder : '#e5e7eb'}`,
      background: active ? activeBg : '#ffffff',
      fontSize: 11,
      fontWeight: 700,
      cursor: 'pointer',
      minWidth: 36,
      boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
    }}
  >
    {label}
  </button>
)

const MenuBtn: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({
  label,
  onClick,
  danger,
}) => (
  <button
    onMouseDown={(e) => e.stopPropagation()}
    onClick={onClick}
    style={{
      display: 'block',
      width: 200,
      textAlign: 'left',
      padding: '10px 12px',
      background: danger ? '#fee2e2' : '#fff',
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
    }}
  >
    {label}
  </button>
)

const Divider: React.FC = () => <div style={{ height: 1, background: '#e5e7eb' }} />
