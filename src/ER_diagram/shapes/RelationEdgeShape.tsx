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
} from 'tldraw'
import type { EntityTableShapeType } from './EntityTableShape'

/* =====================================
   Tipos y constantes
===================================== */
export type Cardinality = '1' | '0..1' | '1..*' | '0..*'
const CARDINALITIES: Cardinality[] = ['1', '0..1', '1..*', '0..*']

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
  }
>

const HANDLE_R = 8
const WAYPOINT_R = 6
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

  // Puertos discretos (centros de lados + esquinas) para anclar extremos
  rectPorts: (r: { x: number; y: number; w: number; h: number }) => {
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    return [
      // centros de lados
      { x: r.x, y: cy }, // left
      { x: r.x + r.w, y: cy }, // right
      { x: cx, y: r.y }, // top
      { x: cx, y: r.y + r.h }, // bottom
      // esquinas
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h },
    ]
  },

  // El puerto más cercano en función de hacia dónde "mira" la arista
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

  // Distancia mínima de un punto a un rectángulo (0 si está dentro)
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
   Marcadores (cardinalidades)
===================================== */
const Markers = React.memo(({ at, dir, card, color, size = 16 }: { at: Pt; dir: Pt; card: Cardinality; color: string; size?: number }) => {
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

  switch (card) {
    case '1': drawBar(); break
    case '0..1': drawBar(); drawCircle(6); break
    case '1..*': drawBar(); drawCrow(); break
    case '0..*': drawCircle(); drawCrow(); break
  }
  return <g>{elements}</g>
})

/* =====================================
   Hook de drag (opt)
===================================== */
const useRelationDrag = (shape: RelationEdgeShapeType, editor: ReturnType<typeof useEditor>, getPointsMemo: () => { points: Pt[]; aTarget: Pt; bTarget: Pt }) => {
  type DragState =
    | { kind: 'end'; end: 'a' | 'b' }
    | { kind: 'wp'; index: number; start: Pt } // guarda inicio para bloqueo con Shift
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
      } catch {}

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
      // hover de segmento (throttled RAF)
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

    // Snap a entidad si soltaste un extremo
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
   Componente principal
===================================== */
const RelationEdgeComponent: React.FC<{ shape: RelationEdgeShapeType }> = ({ shape }) => {
  const editor = useEditor()

  // Reacciona a selección sin forzar renders extra
  const selected = useValue(
    'rel-selected',
    () => editor.getSelectedShapeIds().includes(shape.id),
    [editor, shape.id]
  )

  // Bounds reactivos de entidades conectadas
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

  // Memo: targets + puntos de la ruta
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

  const d = React.useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - shape.x} ${p.y - shape.y}`).join(' '),
    [points, shape.x, shape.y]
  )

  const tStart = React.useMemo(() => geom.tangentAtEnd(points, 'start'), [points])
  const tEnd = React.useMemo(() => geom.tangentAtEnd(points, 'end'), [points])

  const color = selected ? '#0ea5e9' : (shape.props.isDragging ? '#60a5fa' : '#334155')
  const width = shape.props.identifying ? 3 : 2

  // Pre-render de overlays de segmentos (memorizado)
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

  // Delegamos el click de segmentos a handlePointerDown('segment')
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
          {/* 1) Área de arrastre global + DblClick alterna ortogonal */}
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

          {/* 2) Segmentos "clickables" (inserción/drag de waypoint) */}
          {/* además, sombreado al hover */}
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

          {/* 3) Línea principal */}
          <path d={d} stroke={color} strokeWidth={width} fill="none" style={{ pointerEvents: 'none' }} />

          {/* 4) Marcadores */}
          <Markers at={{ x: points[0].x - shape.x, y: points[0].y - shape.y }} dir={{ x: -tStart.x, y: -tStart.y }} card={shape.props.aCard} color={color} />
          <Markers at={{ x: points[points.length - 1].x - shape.x, y: points[points.length - 1].y - shape.y }} dir={tEnd} card={shape.props.bCard} color={color} />

          {/* 5) Waypoints (Alt/Middle click para borrar) */}
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

          {/* 6) Handles de extremos */}
          <g transform={`translate(${aTarget.x - shape.x}, ${aTarget.y - shape.y})`}>
            <circle r={HANDLE_R} fill="#ffffff" stroke={color} strokeWidth={2} onPointerDown={(e) => handlePointerDown(e, 'end', 'a')} style={{ cursor: 'grab' }} />
          </g>
          <g transform={`translate(${bTarget.x - shape.x}, ${bTarget.y - shape.y})`}>
            <circle r={HANDLE_R} fill="#ffffff" stroke={color} strokeWidth={2} onPointerDown={(e) => handlePointerDown(e, 'end', 'b')} style={{ cursor: 'grab' }} />
          </g>
        </svg>

        {/* Etiquetas de cardinalidad */}
        <div style={{
          position: 'absolute', left: aTarget.x - shape.x + 12, top: aTarget.y - shape.y - 20,
          fontSize: 12, fontWeight: 600, color, pointerEvents: 'none',
          background: 'white', padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}`,
        }}>{shape.props.aCard}</div>

        <div style={{
          position: 'absolute', left: bTarget.x - shape.x + 12, top: bTarget.y - shape.y - 20,
          fontSize: 12, fontWeight: 600, color, pointerEvents: 'none',
          background: 'white', padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}`,
        }}>{shape.props.bCard}</div>

        {/* Nombre de la relación */}
        {shape.props.name && (
          <div
            style={{
              position: 'absolute',
              left: (aTarget.x + bTarget.x) / 2 - shape.x,
              top: (aTarget.y + bTarget.y) / 2 - shape.y - 25,
              transform: 'translate(-50%, -50%)',
              fontSize: 12, fontWeight: 600, color,
              pointerEvents: 'none', background: 'white', padding: '4px 8px',
              borderRadius: 4, border: `1px solid ${color}`, whiteSpace: 'nowrap',
            }}
          >
            {shape.props.name}
          </div>
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

/* (opcionales) estilos/reusables */
const btnPrimary: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
}

const MenuBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} style={{ display: 'block', width: 240, textAlign: 'left', padding: '10px 12px', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
    {label}
  </button>
)
