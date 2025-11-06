import * as React from 'react'
import {
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
  TLShapeId,
  TLShapePartial,
  idValidator,
  useEditor,
  useValue,
  createShapeId,
} from 'tldraw'
import type { EntityTableShapeType } from './EntityTableShape'


/* ============================
   Helpers para asociativa N:N
   ============================ */

const MANY_SET = ['1..*', '0..*', 'N', 'n', 'M', 'm']

function isMany(card?: string): boolean {
  if (!card) return false
  return MANY_SET.includes(card.trim())
}

/*====================================
Helpers
=====================================*/

function calcHeight(attrCount: number) {
  return 60 + attrCount * 28
}

async function createAssociativeEntityAndRelations(
  editor: any,
  aId: TLShapeId,
  bId: TLShapeId,
  opts?: { assocName?: string; removeOriginalRelationId?: TLShapeId }
) {
  const aShape = editor.getShape(aId)
  const bShape = editor.getShape(bId)
  if (!aShape || !bShape) return null

  const aBounds = editor.getShapePageBounds(aShape)
  const bBounds = editor.getShapePageBounds(bShape)
  if (!aBounds || !bBounds) return null

  const mid = {
    x: (aBounds.x + bBounds.x + bBounds.w + aBounds.w) / 2 / 2,
    y: (aBounds.y + bBounds.y + aBounds.h + bBounds.h) / 2 / 2,
  }

  const aName = (aShape.props?.name ?? "A").replace(/\s+/g, "_")
  const bName = (bShape.props?.name ?? "B").replace(/\s+/g, "_")
  const assocName = opts?.assocName ?? `Detalle_${aName}_${bName}`

  // Tabla asociativa con PK compuesta (id_A + id_B)
  // Esto permite agregar atributos adicionales sin necesidad de un ID surrogate
  const assocAttrs = [
    { id: createShapeId(), name: `id_${aName}`, type: "uuid", pk: true, unique: false, nullable: false },  // ✅ Parte 1 de PK compuesta
    { id: createShapeId(), name: `id_${bName}`, type: "uuid", pk: true, unique: false, nullable: false },  // ✅ Parte 2 de PK compuesta
  ]

  const assocShape: TLShapePartial<any> = {
    id: createShapeId(),
    type: "entity-table",
    x: mid.x - 160,
    y: mid.y - 80,
    props: {
      w: 320,
      h: calcHeight(assocAttrs.length),
      name: assocName,
      attrs: assocAttrs,
    },
  }

  const relA: TLShapePartial<any> = {
    id: createShapeId(),
    type: "relation-edge",
    x: assocShape.x,
    y: assocShape.y,
    props: {
      aEntityId: assocShape.id,
      bEntityId: aId,
      aCard: "1..*",  // CORREGIDO: Muchos detalles
      bCard: "1",     // CORREGIDO: Un libro
      relationType: "association",
      name: `${assocName}_${aName}`,
    },
  }

  const relB: TLShapePartial<any> = {
    id: createShapeId(),
    type: "relation-edge",
    x: assocShape.x,
    y: assocShape.y,
    props: {
      aEntityId: assocShape.id,
      bEntityId: bId,
      aCard: "1..*",  // CORREGIDO: Muchos detalles
      bCard: "1",     // CORREGIDO: Un usuario
      relationType: "association",
      name: `${assocName}_${bName}`,
    },
  }

  editor.createShapes([assocShape, relA, relB])

  if (opts?.removeOriginalRelationId) {
    editor.deleteShapes([opts.removeOriginalRelationId])
  }

  return { assocId: assocShape.id, relAId: relA.id, relBId: relB.id }
}



/* =====================================
   Tipos y constantes
===================================== */
export type Cardinality = '1' | '0..1' | '1..*' | '0..*' | '-1' | '-2' | '-3'
const CARDINALITIES: Cardinality[] = ['1', '0..1', '1..*', '0..*', '-1', '-2', '-3']
export type RelationType = 'association' | 'inheritance' | 'composition' | 'aggregation'

type Pt = { x: number; y: number }

export type RelationEdgeShapeType = TLBaseShape<
  'relation-edge',
  {
    aEntityId: TLShapeId | null
    bEntityId: TLShapeId | null
    aFree: Pt
    bFree: Pt
    aCard: Cardinality
    bCard: Cardinality
    waypoints: Pt[]
    orthogonal?: boolean
    identifying?: boolean
    name: string
    isDragging?: boolean
    hoveredSegment?: number
    relationType: RelationType
  }
>

const HANDLE_R = 4
const WAYPOINT_R = 2
const SEGMENT_HOVER_WIDTH = 12
const SNAP_DISTANCE = 30

/* =====================================
   Utils geométricos
===================================== */
const geom = {
  clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)),

  distance: (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y),

  projectPointOnSegment: (point: Pt, segStart: Pt, segEnd: Pt): { point: Pt; t: number } => {
    const dx = segEnd.x - segStart.x
    const dy = segEnd.y - segStart.y
    const length2 = dx * dx + dy * dy
    if (length2 === 0) return { point: { ...segStart }, t: 0 }
    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / length2
    t = Math.max(0, Math.min(1, t))
    return { point: { x: segStart.x + t * dx, y: segStart.y + t * dy }, t }
  },

  getEntityBounds: (editor: ReturnType<typeof useEditor>, id: TLShapeId | null) => {
    if (!id) return null
    const s = editor.getShape(id)
    if (!s || s.type !== 'entity-table') return null
    return editor.getShapePageBounds(s)
  },

  rectPorts: (r: { x: number; y: number; w: number; h: number }) => {
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    return [
      { x: r.x, y: cy },
      { x: r.x + r.w, y: cy },
      { x: cx, y: r.y },
      { x: cx, y: r.y + r.h },
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h },
    ]
  },

  closestPortTowards: (
    rect: { x: number; y: number; w: number; h: number },
    towards: Pt
  ): Pt => {
    const ports = geom.rectPorts(rect)
    let best = ports[0]
    let bestDot = -Infinity
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const dir = { x: towards.x - cx, y: towards.y - cy }
    const len = Math.hypot(dir.x, dir.y) || 1
    const ux = dir.x / len
    const uy = dir.y / len
    for (const p of ports) {
      const vx = p.x - cx
      const vy = p.y - cy
      const l = Math.hypot(vx, vy) || 1
      const dot = (vx / l) * ux + (vy / l) * uy
      if (dot > bestDot) {
        bestDot = dot
        best = p
      }
    }
    return best
  },

  orthogonalRoute: (a: Pt, b: Pt, wps: Pt[]): Pt[] => {
    if (wps.length > 0) return [a, ...wps, b]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx > dy) {
      const midX = (a.x + b.x) / 2
      return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]
    } else {
      const midY = (a.y + b.y) / 2
      return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]
    }
  },

  straightRoute: (a: Pt, b: Pt, wps: Pt[]): Pt[] => (wps.length > 0 ? [a, ...wps, b] : [a, b]),

  tangentAtEnd: (points: Pt[], atEnd: 'start' | 'end'): Pt => {
    if (points.length < 2) return { x: 1, y: 0 }
    if (atEnd === 'start') {
      const p0 = points[0], p1 = points[1]
      const vx = p1.x - p0.x, vy = p1.y - p0.y
      const len = Math.hypot(vx, vy) || 1
      return { x: vx / len, y: vy / len }
    } else {
      const n = points.length
      const p0 = points[n - 2], p1 = points[n - 1]
      const vx = p1.x - p0.x, vy = p1.y - p0.y
      const len = Math.hypot(vx, vy) || 1
      return { x: vx / len, y: vy / len }
    }
  },

  distanceToRect: (p: Pt, r: { x: number; y: number; w: number; h: number }) => {
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
    const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
    return Math.hypot(dx, dy)
  },
}

function selectIds(editor: any, ids: TLShapeId[]) {
  if (typeof editor.setSelectedShapes === 'function') editor.setSelectedShapes(ids)
  else if (typeof editor.select === 'function') editor.select(ids)
}



/* =====================================
   Marcadores (cardinalidades) - CORREGIDOS
===================================== */
const Markers = React.memo(({ at, dir, card, color, size = 16, relationType, isAEnd }: { at: Pt; dir: Pt; card: Cardinality; color: string; size?: number; relationType: RelationType; isAEnd: boolean }) => {
  const n = React.useMemo(() => ({ x: -dir.y, y: dir.x }), [dir.x, dir.y])
  const W = size * 0.6
  const barOff = size
  const circleR = size * 0.25
  const elements: React.ReactNode[] = []

  const drawBar = (offset: number = 0) => {
    const off = { x: -dir.x * (barOff + offset), y: -dir.y * (barOff + offset) }
    const p1 = { x: at.x + n.x * W + off.x, y: at.y + n.y * W + off.y }
    const p2 = { x: at.x - n.x * W + off.x, y: at.y - n.y * W + off.y }
    elements.push(<line key={`bar-${offset}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} />)
  }

  const drawCrow = () => {
    const tip = { x: at.x + dir.x * size, y: at.y + dir.y * size }
    const left = { x: at.x + n.x * W + dir.x * (size - 2), y: at.y + n.y * W + dir.y * (size - 2) }
    const right = { x: at.x - n.x * W + dir.x * (size - 2), y: at.y - n.y * W + dir.y * (size - 2) }
    elements.push(
      <line key="c1" x1={at.x} y1={at.y} x2={left.x} y2={left.y} stroke={color} strokeWidth={2} />,
      <line key="c2" x1={at.x} y1={at.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={2} />,
      <line key="c3" x1={at.x} y1={at.y} x2={right.x} y2={right.y} stroke={color} strokeWidth={2} />,
    )
  }

  const drawCircle = (offset: number = 0) => {
    const off = { x: -dir.x * (barOff + offset), y: -dir.y * (barOff + offset) }
    elements.push(<circle key={`circle-${offset}`} cx={at.x + off.x} cy={at.y + off.y} r={circleR} stroke={color} fill="none" strokeWidth={2} />)
  }

  const drawTriangle = () => {
    const V = size
    const H = size * 0.7
    const p0 = { x: at.x, y: at.y }
    const p1 = {
      x: at.x - dir.x * V + n.x * H / 2,
      y: at.y - dir.y * V + n.y * H / 2
    }
    const p2 = {
      x: at.x - dir.x * V - n.x * H / 2,
      y: at.y - dir.y * V - n.y * H / 2
    }
    elements.push(
      <polygon
        key="triangle"
        points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
        stroke={color}
        strokeWidth={2}
        fill="#ffffff"
      />
    )
  }

  const drawDiamond = (filled: boolean) => {
    const R = size * 0.4
    const L = size * 0.8

    const p0 = { x: at.x, y: at.y }
    const p1 = {
      x: at.x - dir.x * L / 2 + n.x * R,
      y: at.y - dir.y * L / 2 + n.y * R
    }
    const p2 = {
      x: at.x - dir.x * L,
      y: at.y - dir.y * L
    }
    const p3 = {
      x: at.x - dir.x * L / 2 - n.x * R,
      y: at.y - dir.y * L / 2 - n.y * R
    }

    elements.push(
      <polygon
        key="diamond"
        points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
        stroke={color}
        strokeWidth={2}
        fill={filled ? color : '#ffffff'}
      />
    )
  }

  // LÓGICA CORREGIDA: Los símbolos especiales solo se dibujan en el extremo B (isAEnd=false)
  if (relationType === 'inheritance') {
    if (!isAEnd) {
      drawTriangle()
    }
  } else if (relationType === 'composition') {
    if (!isAEnd) {
      drawDiamond(true)
    }
  } else if (relationType === 'aggregation') {
    if (!isAEnd) {
      drawDiamond(false)
    }
  } else if (relationType === 'association') {
    // Para asociaciones, dibujamos cardinalidades en ambos extremos
    switch (card) {
      case '1': drawBar(); break
      case '0..1': drawBar(); drawCircle(6); break
      case '1..*': drawBar(); drawCrow(); break
      case '0..*': drawCircle(); drawCrow(); break
    }
  }

  return <g>{elements}</g>
})

/* =====================================
   Hook de drag
===================================== */
const useRelationDrag = (shape: RelationEdgeShapeType, editor: ReturnType<typeof useEditor>, getPointsMemo: () => { points: Pt[]; aTarget: Pt; bTarget: Pt }) => {
  type DragState =
    | { kind: 'end'; end: 'a' | 'b' }
    | { kind: 'wp'; index: number; start: Pt }
    | { kind: 'segment'; segmentIndex: number; initialPoint: Pt }
    | { kind: 'path'; start: Pt; a0: Pt; b0: Pt; wps0: Pt[]; aConn: boolean; bConn: boolean }

  const dragState = React.useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [hoveredSegment, _setHoveredSegment] = React.useState<number | undefined>()
  const hoverRaf = React.useRef<number | null>(null)

  const setHoveredSegment = (v: number | undefined) => {
    if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current)
    hoverRaf.current = requestAnimationFrame(() => _setHoveredSegment(v))
  }

  const patch = React.useCallback((patchProps: Partial<RelationEdgeShapeType['props']>) => {
    const next = { ...shape.props, ...patchProps }
    if (next === shape.props) return
    editor.updateShape({ id: shape.id, type: shape.type, props: next } as TLShapePartial<RelationEdgeShapeType>)
  }, [editor, shape.id, shape.type, shape.props])

  const getPagePoint = React.useCallback((e: React.PointerEvent): Pt => {
    const p = editor.screenToPage({ x: e.clientX, y: e.clientY })
    return { x: p.x, y: p.y }
  }, [editor])

  const findClosestSegment = React.useCallback((point: Pt, points: Pt[]): number => {
    let closestSegment = -1
    let minDistance = Infinity
    for (let i = 0; i < points.length - 1; i++) {
      const projection = geom.projectPointOnSegment(point, points[i], points[i + 1])
      const distance = geom.distance(point, projection.point)
      if (distance < minDistance && distance < SEGMENT_HOVER_WIDTH) {
        minDistance = distance
        closestSegment = i
      }
    }
    return closestSegment
  }, [])

  const handlePointerDown = React.useCallback((e: React.PointerEvent, type: DragState['kind'], data?: any) => {
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget as HTMLElement

    if ('setPointerCapture' in el) el.setPointerCapture(e.pointerId)
    try {
      const current = (editor.getSelectedShapeIds?.() ?? []) as TLShapeId[]
      if (!current.includes(shape.id as TLShapeId)) {
        selectIds(editor, [shape.id as TLShapeId])
      }
    } catch { }

    const pagePoint = getPagePoint(e)

    switch (type) {
      case 'end':
        dragState.current = { kind: 'end', end: data }
        break

      case 'wp': {
        const wp0 = shape.props.waypoints[data]
        dragState.current = { kind: 'wp', index: data, start: { x: wp0.x, y: wp0.y } }
        break
      }

      case 'segment': {
        const { points } = getPointsMemo()
        const segmentIndex = findClosestSegment(pagePoint, points)
        if (segmentIndex !== -1) {
          const projection = geom.projectPointOnSegment(pagePoint, points[segmentIndex], points[segmentIndex + 1])
          const newWaypoint = { x: projection.point.x - shape.x, y: projection.point.y - shape.y }
          const newWaypoints = [...shape.props.waypoints]
          newWaypoints.splice(segmentIndex, 0, newWaypoint)
          patch({ waypoints: newWaypoints })
          dragState.current = { kind: 'wp', index: segmentIndex, start: newWaypoint }
        }
        break
      }

      case 'path': {
        const bothConn = !!shape.props.aEntityId && !!shape.props.bEntityId
        if (bothConn && shape.props.waypoints.length === 0) {
          const { points } = getPointsMemo()
          const segIdx = findClosestSegment(pagePoint, points)
          const idx = segIdx !== -1 ? segIdx : Math.floor((points.length - 1) / 2)
          const baseP = segIdx !== -1
            ? geom.projectPointOnSegment(pagePoint, points[idx], points[idx + 1]).point
            : { x: (points[0].x + points[points.length - 1].x) / 2, y: (points[0].y + points[points.length - 1].y) / 2 }
          const wp = { x: baseP.x - shape.x, y: baseP.y - shape.y }
          const wps = [...shape.props.waypoints]
          wps.splice(idx, 0, wp)
          patch({ waypoints: wps })
          dragState.current = { kind: 'wp', index: idx, start: wp }
        } else {
          dragState.current = {
            kind: 'path',
            start: pagePoint,
            a0: { ...shape.props.aFree },
            b0: { ...shape.props.bFree },
            wps0: shape.props.waypoints.map(w => ({ ...w })),
            aConn: !!shape.props.aEntityId,
            bConn: !!shape.props.bEntityId,
          }
        }
        break
      }
    }

    setIsDragging(true)
    patch({ isDragging: true })
  }, [getPagePoint, getPointsMemo, patch, findClosestSegment, shape.props])

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    const { points } = getPointsMemo()

    if (!dragState.current) {
      const pagePoint = getPagePoint(e)
      const segmentIndex = findClosestSegment(pagePoint, points)
      setHoveredSegment(segmentIndex !== -1 ? segmentIndex : undefined)
      return
    }

    e.stopPropagation()
    e.preventDefault()
    const pagePoint = getPagePoint(e)
    const state = dragState.current
    const localPoint = { x: pagePoint.x - shape.x, y: pagePoint.y - shape.y }

    switch (state.kind) {
      case 'end': {
        if (state.end === 'a') patch({ aEntityId: null, aFree: localPoint })
        else patch({ bEntityId: null, bFree: localPoint })
        break
      }

      case 'wp': {
        let { x, y } = localPoint
        if (e.shiftKey) {
          const s = state.start
          const dx = Math.abs(localPoint.x - s.x)
          const dy = Math.abs(localPoint.y - s.y)
          if (dx > dy) y = s.y
          else x = s.x
        }
        const wps = [...shape.props.waypoints]
        if (wps[state.index].x !== x || wps[state.index].y !== y) {
          wps[state.index] = { x, y }
          patch({ waypoints: wps })
        }
        break
      }

      case 'path': {
        const { start, a0, b0, wps0, aConn, bConn } = state
        const dx = pagePoint.x - start.x
        const dy = pagePoint.y - start.y
        const next: Partial<RelationEdgeShapeType['props']> = {}
        if (!aConn) next.aFree = { x: a0.x + dx, y: a0.y + dy }
        if (!bConn) next.bFree = { x: b0.x + dx, y: b0.y + dy }
        next.waypoints = wps0.map(w => ({ x: w.x + dx, y: w.y + dy }))
        patch(next)
        break
      }
    }
  }, [getPointsMemo, getPagePoint, patch, shape.x, shape.y, shape.props.waypoints])

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    e.stopPropagation()
    e.preventDefault()

    const state = dragState.current
    dragState.current = null
    setIsDragging(false)
    patch({ isDragging: false, hoveredSegment: undefined })

    if (state.kind === 'end') {
      const pagePoint = getPagePoint(e)
      const entities = editor.getCurrentPageShapes().filter(s => s.type === 'entity-table') as EntityTableShapeType[]
      const target = entities.find(s => {
        const b = editor.getShapePageBounds(s)
        return b && geom.distanceToRect(pagePoint, b) <= SNAP_DISTANCE
      })
      if (target) {
        if (state.end === 'a') patch({ aEntityId: target.id })
        else patch({ bEntityId: target.id })
      }

      setTimeout(async () => {
        const aId = (shape.props.aEntityId ?? (state.kind === 'end' && state.end === 'a' ? target?.id : null)) as TLShapeId | null
        const bId = (shape.props.bEntityId ?? (state.kind === 'end' && state.end === 'b' ? target?.id : null)) as TLShapeId | null

        if (aId && bId) {
          if (shape.props.relationType === 'association' && isMany(shape.props.aCard) && isMany(shape.props.bCard)) {
            try {
              await createAssociativeEntityAndRelations(editor, aId, bId, { assocName: undefined, removeOriginalRelationId: shape.id })
            } catch (err) {
              console.error('Error creando entidad intermedia:', err)
            }
          }
        }
      }, 0)
    }
  }, [editor, getPagePoint, patch])

  React.useEffect(() => () => {
    if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current)
  }, [])

  return {
    isDragging,
    hoveredSegment,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}

/* =====================================
   Componente principal - LÍNEAS CORREGIDAS
===================================== */
const RelationEdgeComponent: React.FC<{ shape: RelationEdgeShapeType }> = ({ shape }) => {
  const editor = useEditor()
  const showCardText = shape.props.relationType === 'association';

  const selected = useValue(
    'rel-selected',
    () => editor.getSelectedShapeIds().includes(shape.id),
    [editor, shape.id]
  )

  const aBounds = useValue(
    'a-bounds',
    () => geom.getEntityBounds(editor, shape.props.aEntityId),
    [editor, shape.props.aEntityId]
  )
  const bBounds = useValue(
    'b-bounds',
    () => geom.getEntityBounds(editor, shape.props.bEntityId),
    [editor, shape.props.bEntityId]
  )

  const getPoints = React.useCallback(() => {
    const aTarget: Pt = shape.props.aEntityId && bBounds
      ? geom.closestPortTowards(aBounds!, { x: bBounds.x + bBounds.w / 2, y: bBounds.y + bBounds.h / 2 })
      : { x: shape.x + shape.props.aFree.x, y: shape.y + shape.props.aFree.y }

    const bTarget: Pt = shape.props.bEntityId && aBounds
      ? geom.closestPortTowards(bBounds!, { x: aBounds.x + aBounds.w / 2, y: aBounds.y + aBounds.h / 2 })
      : { x: shape.x + shape.props.bFree.x, y: shape.y + shape.props.bFree.y }

    const points = (shape.props.orthogonal ? geom.orthogonalRoute : geom.straightRoute)(aTarget, bTarget, shape.props.waypoints)
    return { points, aTarget, bTarget }
  }, [aBounds, bBounds, shape.props.aEntityId, shape.props.bEntityId, shape.props.aFree.x, shape.props.aFree.y, shape.props.bFree.x, shape.props.bFree.y, shape.props.orthogonal, shape.props.waypoints, shape.x, shape.y])

  const { points, aTarget, bTarget } = React.useMemo(getPoints, [getPoints])

  const d = React.useMemo(() => {
    if (points.length < 2) return ''
    let path = `M ${points[0].x - shape.x} ${points[0].y - shape.y}`
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x - shape.x} ${points[i].y - shape.y}`
    }
    return path
  }, [points, shape.x, shape.y])

  const tStart = React.useMemo(() => geom.tangentAtEnd(points, 'start'), [points])
  const tEnd = React.useMemo(() => geom.tangentAtEnd(points, 'end'), [points])

  // ESTILOS DE LÍNEA CORREGIDOS SEGÚN TIPO DE RELACIÓN
  const color = selected ? '#007ACC' : (shape.props.isDragging ? '#2B6CB0' : '#6B7280')
  const width = shape.props.identifying ? 2.2 : 1.8
  
  // Estilos específicos por tipo de relación:
  // - Association (1:1, 1:*, M:M): línea continua
  // - Inheritance: línea continua (con triángulo vacío)
  // - Composition: línea continua (con diamante relleno) 
  // - Aggregation: línea continua (con diamante vacío)
  const dashArray = 'none' // Todas las relaciones usan línea continua

  const segmentOverlays = React.useMemo(() => {
    const items: React.ReactNode[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      const segmentD = `M ${p1.x - shape.x} ${p1.y - shape.y} L ${p2.x - shape.x} ${p2.y - shape.y}`
      items.push(
        <path
          key={`segment-${i}`}
          d={segmentD}
          stroke="transparent"
          strokeWidth={SEGMENT_HOVER_WIDTH}
          fill="none"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onPointerDown={(e) => e.currentTarget.dispatchEvent(new PointerEvent('pointerdown', e.nativeEvent))}
          data-seg-idx={i}
        />
      )
    }
    return items
  }, [points, shape.x, shape.y])

  const { handlePointerDown, handlePointerMove, handlePointerUp, hoveredSegment } =
    useRelationDrag(shape, editor, () => ({ points, aTarget, bTarget }))

  const onSegmentPointerDown = React.useCallback((e: React.PointerEvent<SVGPathElement>) => {
    handlePointerDown(e, 'segment')
  }, [handlePointerDown])

  return (
    <HTMLContainer>
      <div
        style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'auto' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
          {/* Área de arrastre global */}
          <path
            d={d}
            stroke="transparent"
            strokeWidth={SEGMENT_HOVER_WIDTH + 10}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'move' }}
            onPointerDown={(e) => handlePointerDown(e, 'path')}
            onDoubleClick={(e) => {
              e.stopPropagation()
              const next = !shape.props.orthogonal
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                props: { ...shape.props, orthogonal: next },
              } as TLShapePartial<RelationEdgeShapeType>)
            }}
          />

          {/* Segmentos clickables con hover */}
          {points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1]
            const segmentD = `M ${p1.x - shape.x} ${p1.y - shape.y} L ${p2.x - shape.x} ${p2.y - shape.y}`
            return (
              <path
                key={`seg-hit-${i}`}
                d={segmentD}
                stroke="transparent"
                strokeWidth={SEGMENT_HOVER_WIDTH}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer', opacity: hoveredSegment === i ? 0.3 : 0 }}
                onPointerDown={(e) => handlePointerDown(e, 'segment')}
              />
            )
          })}

          {/* Línea principal - SIEMPRE CONTINUA */}
          <path 
            d={d} 
            stroke={color} 
            strokeWidth={width} 
            fill="none" 
            strokeDasharray={dashArray}
            style={{ pointerEvents: 'none' }} 
          />

          {/* Marcadores de cardinalidad o símbolos especiales */}
          <Markers
            at={{ x: points[0].x - shape.x, y: points[0].y - shape.y }}
            dir={{ x: -tStart.x, y: -tStart.y }}
            card={shape.props.aCard}
            relationType={shape.props.relationType}
            color={color}
            isAEnd={true}
          />
          <Markers
            at={{ x: points[points.length - 1].x - shape.x, y: points[points.length - 1].y - shape.y }}
            dir={tEnd}
            card={shape.props.bCard}
            relationType={shape.props.relationType}
            color={color}
            isAEnd={false}
          />

          {/* Waypoints */}
          {shape.props.waypoints.map((p, i) => (
            <g key={i} transform={`translate(${p.x}, ${p.y})`}>
              <circle
                r={WAYPOINT_R}
                fill="#ffffff"
                stroke={color}
                strokeWidth={2}
                onPointerDown={(e) => {
                  if (e.altKey || e.button === 1) {
                    e.stopPropagation()
                    e.preventDefault()
                    const wps = [...shape.props.waypoints]
                    wps.splice(i, 1)
                    editor.updateShape({
                      id: shape.id,
                      type: shape.type,
                      props: { ...shape.props, waypoints: wps },
                    } as TLShapePartial<RelationEdgeShapeType>)
                  } else {
                    handlePointerDown(e, 'wp', i)
                  }
                }}
                style={{ cursor: 'grab' }}
              />
            </g>
          ))}

          {/* Handles de extremos */}
          <g transform={`translate(${aTarget.x - shape.x}, ${aTarget.y - shape.y})`}>
            <circle r={HANDLE_R} fill="#ffffff" stroke={color} strokeWidth={2} onPointerDown={(e) => handlePointerDown(e, 'end', 'a')} style={{ cursor: 'grab' }} />
          </g>
          <g transform={`translate(${bTarget.x - shape.x}, ${bTarget.y - shape.y})`}>
            <circle r={HANDLE_R} fill="#ffffff" stroke={color} strokeWidth={2} onPointerDown={(e) => handlePointerDown(e, 'end', 'b')} style={{ cursor: 'grab' }} />
          </g>
        </svg>

        {/* Etiquetas de cardinalidad - SOLO PARA ASSOCIATION */}
        {showCardText && (
          <div style={{
            position: 'absolute', left: aTarget.x - shape.x + 12, top: aTarget.y - shape.y - 20,
            fontSize: 12, fontWeight: 600, color, pointerEvents: 'none',
            background: 'white', padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}`,
          }}>{shape.props.aCard}</div>
        )}

        {showCardText && (
          <div style={{
            position: 'absolute', left: bTarget.x - shape.x + 12, top: bTarget.y - shape.y - 20,
            fontSize: 12, fontWeight: 600, color, pointerEvents: 'none',
            background: 'white', padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}`,
          }}>{shape.props.bCard}</div>
        )}
      </div>
    </HTMLContainer>
  )
}

/* =====================================
   Shape Util
===================================== */
export class RelationEdgeShapeUtil extends ShapeUtil<RelationEdgeShapeType> {
  static override type = 'relation-edge' as const

  static override props: RecordProps<RelationEdgeShapeType> = {
    aEntityId: T.nullable(idValidator('shape')),
    bEntityId: T.nullable(idValidator('shape')),
    aFree: T.object({ x: T.number, y: T.number }),
    bFree: T.object({ x: T.number, y: T.number }),
    aCard: T.literalEnum(...CARDINALITIES),
    bCard: T.literalEnum(...CARDINALITIES),
    waypoints: T.arrayOf(T.object({ x: T.number, y: T.number })),
    orthogonal: T.boolean.optional(),
    identifying: T.boolean.optional(),
    name: T.string,
    isDragging: T.boolean.optional(),
    hoveredSegment: T.number.optional(),
    relationType: T.literalEnum('association', 'inheritance', 'composition', 'aggregation'),
  }

  override getDefaultProps(): RelationEdgeShapeType['props'] {
    return {
      aEntityId: null,
      bEntityId: null,
      aFree: { x: 0, y: 0 },
      bFree: { x: 160, y: 0 },
      aCard: '1',
      bCard: '1..*',
      waypoints: [],
      orthogonal: true,
      identifying: false,
      name: '',
      relationType: 'association',
    }
  }

  override getGeometry(_shape: RelationEdgeShapeType) {
    return new Rectangle2d({ width: 1, height: 1, isFilled: false })
  }

  override component(shape: RelationEdgeShapeType) { return <RelationEdgeComponent shape={shape} /> }
  override indicator(_shape: RelationEdgeShapeType) { return <rect x={0} y={0} width={1} height={1} fill="none" /> }

  override canEdit() { return true }
  override canReceiveNewChildrenOfType() { return false }
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
}

const MenuBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} style={{ display: 'block', width: 240, textAlign: 'left', padding: '10px 12px', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
    {label}
  </button>
)