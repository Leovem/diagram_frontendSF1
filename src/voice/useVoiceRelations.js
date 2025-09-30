// src/ai/useVoiceRelations.js
import { useCallback, useEffect, useRef, useState } from 'react'

/** =========================
 *  Compat + utilidades
 *  ========================= */
// IDs sin depender de editor.createShapeId
function newShapeId(kind = '') {
  const rnd = globalThis.crypto?.randomUUID?.()
    ?? (Math.random().toString(36).slice(2) + Date.now().toString(36))
  // Siempre empieza con "shape:"
  return `shape:${kind ? kind + '_' : ''}${rnd}`
}

// createShape compatible con varias versiones de tldraw
function createShapeCompat(editor, shape) {
  if (typeof editor?.createShape === 'function') return editor.createShape(shape)
  if (typeof editor?.createShapes === 'function') return editor.createShapes([shape])
  throw new Error('Editor no tiene createShape(s). ¿Está dentro de <Tldraw>?')
}

// Web Speech
function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// Texto
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"']/g, '')
    .trim()
}
function tokens(s) {
  return normalize(s).split(/[\s\-_/.,;:]+/).filter(Boolean)
}
function includesAny(haystack, arr) {
  const h = normalize(haystack)
  return arr.some(a => h.includes(normalize(a)))
}

/** =========================
 *  Cardinalidades
 *  ========================= */
const CARDS = {
  '1': ['uno', '1', '1 a 1', 'uno a uno', '1..1'],
  '0..1': ['cero a uno', '0 a 1', '0..1', 'opcional uno', 'opc 1'],
  '1..*': ['uno a muchos', 'uno a varios', '1 a n', '1 a muchos', '1..*'],
  '0..*': ['cero a muchos', '0 a n', '0..*', 'opcional muchos', 'opc n', 'opc muchos'],
  '*': ['muchos', 'varios', 'n', '*'],
}
function detectCardPhrase(text) {
  const n = normalize(text)
  if (/(^|\s)(1\s*a\s*1|uno\s*a\s*uno|1\.\.\s*1)($|\s)/.test(n)) return ['1', '1']
  if (/(^|\s)(1\s*a\s*n|uno\s*a\s*(muchos|varios)|1\.\.\*)($|\s)/.test(n)) return ['1', '1..*']
  if (/(^|\s)(n\s*a\s*1|(muchos|varios)\s*a\s*uno|\*\s*a\s*1)($|\s)/.test(n)) return ['1..*', '1']
  if (/(^|\s)(n\s*a\s*n|(muchos|varios)\s*a\s*(muchos|varios)|\*\s*a\s*\*)($|\s)/.test(n)) return ['1..*', '1..*']
  if (/(^|\s)(0\s*a\s*1|cero\s*a\s*uno|0\.\.1)($|\s)/.test(n)) return ['0..1', '1']
  const m = n.match(/(0\.\.1|0\.\.\*|1\.\.\*|1|\*|n|muchos|varios)\s*a\s*(0\.\.1|0\.\.\*|1\.\.\*|1|\*|n|muchos|varios)/)
  if (m) {
    const map = (t) => (t === '1' ? '1'
      : (t === '0..1' ? '0..1'
      : (t === '0..*' ? '0..*' : '1..*')))
    return [map(m[1]), map(m[2])]
  }
  const left = includesAny(n, CARDS['0..1']) ? '0..1'
    : includesAny(n, CARDS['1..*']) ? '1..*'
    : includesAny(n, CARDS['0..*']) ? '0..*'
    : '1'
  const right = includesAny(n, ['a muchos', 'a n', 'a varios', '1..*', '0..*']) ? '1..*' : '1'
  return [left, right]
}

/** =========================
 *  Parseo de “A a B”
 *  ========================= */
function extractAB(text) {
  const n = normalize(text)
  let m = n.match(/(?:de|desde)\s+(?:"|“)?(.+?)(?:"|”)?\s+(?:a|hasta|hacia)\s+(?:"|“)?(.+?)(?:"|”)?(?:$|\s+con|\s+llamada|\s+ident|$)/)
  if (m) return { a: m[1].trim(), b: m[2].trim() }
  m = n.match(/entre\s+(?:"|“)?(.+?)(?:"|”)?\s+y\s+(?:"|“)?(.+?)(?:"|”)?(?:$|\s+con|\s+llamada|\s+ident|$)/)
  if (m) return { a: m[1].trim(), b: m[2].trim() }
  const ws = tokens(n).filter(w => !['relacion','relación','conecta','conectar','vincula','vincular','une','crear','crea','haz','traza','dibuja','de','a','hasta','hacia','entre','y'].includes(w))
  if (ws.length >= 2) return { a: ws[0], b: ws[1] }
  return null
}
function extractName(text) {
  const m = normalize(text).match(/(?:llamada|con nombre|nombre)\s+(.+?)$/)
  return m ? m[1].trim() : ''
}
function extractFlags(text) {
  const n = normalize(text)
  return {
    viceversa: /\bviceversa\b/.test(n) || /\binvertir\b/.test(n),
    identifying: /\bidentificadora?\b/.test(n) || /\bidentifying\b/.test(n),
    orthogonal: /\bortogonal(es)?\b/.test(n),
    straight: /\brecta(s)?\b/.test(n) || /\blineal(es)?\b/.test(n),
  }
}

/** =========================
 *  Buscar entidades en el canvas
 *  ========================= */
function getEntities(editor) {
  return editor.getCurrentPageShapes().filter(s => String(s.type).includes('entity'))
}
function displayNameOfEntity(entity) {
  return entity?.props?.name || entity?.props?.title || entity?.id || ''
}
function bestMatchEntity(query, entities) {
  const q = normalize(query)
  let best = null, bestScore = -Infinity
  for (const e of entities) {
    const name = normalize(displayNameOfEntity(e))
    if (!name) continue
    let score = name.includes(q) ? 2 : 0
    const nt = new Set(tokens(name)), qt = new Set(tokens(q))
    let inter = 0; qt.forEach(t => { if (nt.has(t)) inter++ })
    const jaccard = inter / Math.max(1, nt.size + qt.size - inter)
    score += jaccard
    if (score > bestScore) { bestScore = score; best = e }
  }
  return best
}

/** =========================
 *  Crear relation-edge
 *  ========================= */
function executeRelation(editor, cmd) {
  const { aName, bName, aCard, bCard, viceversa, identifying, orthogonal, straight, relName } = cmd
  if (!editor) throw new Error('Editor no disponible.')

  const ents = editor.getCurrentPageShapes().filter(s => s.type === 'entity-table')
  if (!ents.length) throw new Error('No hay entidades en la página.')
  if (ents.length === 1) throw new Error(`Solo hay una entidad (“${ents[0]?.props?.name || ents[0].id}”).`)

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const toks = s => norm(s).split(/[\s\-_/.,;:]+/).filter(Boolean)
  const disp = e => e?.props?.name || e?.props?.title || e?.id || ''
  const score = (q, e) => {
    const n = norm(disp(e)), qn = norm(q)
    let sc = n.includes(qn) ? 2 : 0
    const nt = new Set(toks(n)), qt = new Set(toks(qn))
    let inter = 0; qt.forEach(t => { if (nt.has(t)) inter++ })
    return sc + inter / Math.max(1, nt.size + qt.size - inter)
  }
  const best = (q) => ents.slice().sort((a,b)=>score(q,b)-score(q,a))[0]

  const A = best(aName), B = best(bName)
  if (!A) throw new Error(`No encontré la entidad "${aName}".`)
  if (!B) throw new Error(`No encontré la entidad "${bName}".`)
  if (A.id === B.id) throw new Error('Debes indicar dos entidades distintas.')

  const flipped = viceversa ? { a: B, b: A, aCard: bCard, bCard: aCard } : { a: A, b: B, aCard, bCard }
  const routeOrthogonal = straight ? false : (orthogonal ? true : true)

  // Coloca el origin del edge cerca del medio entre A y B (por si tu HTMLContainer dependiera de la posición)
  const aB = editor.getShapePageBounds(A), bB = editor.getShapePageBounds(B)
  const mid = aB && bB ? { x: (aB.x + aB.w/2 + bB.x + bB.w/2)/2, y: (aB.y + aB.h/2 + bB.y + bB.h/2)/2 } : { x: 0, y: 0 }

  const id = newShapeId('rel')
  const parentId = editor.getCurrentPageId?.() || editor.getCurrentPage?.()?.id
  const payload = {
    id,
    type: 'relation-edge',
    parentId,           // ✅ fuerza página actual
    x: mid.x || 0,      // ✅ origen razonable
    y: mid.y || 0,
    props: {
      aEntityId: flipped.a.id,
      bEntityId: flipped.b.id,
      aFree: { x: -80, y: 0 },
      bFree: { x:  80, y: 0 },
      aCard: flipped.aCard,
      bCard: flipped.bCard,
      waypoints: [],
      orthogonal: routeOrthogonal,
      identifying: !!identifying,
      name: (relName || '').trim(),
    },
  }

  const doCreate = () => createShapeCompat(editor, payload)
  if (typeof editor.batch === 'function') editor.batch(doCreate); else doCreate()

  // ✅ sanity check: si no quedó en el store, explica por qué
  const created = editor.getShape?.(id)
  if (!created) {
    throw new Error('La relación no pudo crearse. Revisa: (1) que `RelationEdgeShapeUtil` esté en `shapeUtils`, (2) que el `type` sea exactamente "relation-edge".')
  }

  try {
    editor.setSelectedShapes?.([flipped.a.id, flipped.b.id, id])
    editor.zoomToSelection?.({ duration: 200 })
  } catch {}
}

/** =========================
 *  Parse completo
 *  ========================= */
const TRIGGERS = /(relacion|relación|relaciona|conecta|conectar|vincula|vincular|une|crear|crea|haz|traza|dibuja)/
function parseRelationCommand(text) {
  const base = normalize(text)
  if (!TRIGGERS.test(base)) return null
  const AB = extractAB(base); if (!AB) return null
  const [leftCard, rightCard] = detectCardPhrase(base)
  const flags = extractFlags(base)
  const relName = extractName(base)
  return {
    aName: AB.a,
    bName: AB.b,
    aCard: leftCard,
    bCard: rightCard,
    viceversa: flags.viceversa,
    identifying: flags.identifying,
    orthogonal: flags.orthogonal,
    straight: flags.straight,
    relName,
  }
}

/** =========================
 *  Hook principal
 *  ========================= */
export function useVoiceRelations(editor, { lang = 'es-419', onFeedback, keepAlive = true } = {}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(!!getSpeechRecognition())
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const shouldRunRef = useRef(false)

  useEffect(() => setSupported(!!getSpeechRecognition()), [])

  const stop = useCallback(() => {
    shouldRunRef.current = false
    setListening(false)
    const rec = recognitionRef.current
    if (rec) { try { rec.onend = null; rec.stop() } catch {} recognitionRef.current = null }
  }, [])

  const start = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) {
      const msg = 'Este navegador no soporta reconocimiento de voz.'
      setError(msg); onFeedback?.({ type: 'error', message: msg }); return
    }
    if (!editor) {
      const msg = 'Editor no listo.'; setError(msg); onFeedback?.({ type: 'error', message: msg }); return
    }

    setError(null)
    const rec = new SR()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    shouldRunRef.current = true

    rec.onstart = () => setListening(true)
    rec.onend = () => {
      setListening(false)
      if (keepAlive && shouldRunRef.current) { try { rec.start() } catch {} }
    }
    rec.onerror = (e) => {
      const msg = e?.error || 'Error de reconocimiento'
      setError(msg); onFeedback?.({ type: 'error', message: `Voz: ${msg}` })
      if (keepAlive && shouldRunRef.current) { try { rec.stop(); rec.start() } catch {} }
      else stop()
    }
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (!res.isFinal) continue
        const txt = res[0]?.transcript ?? ''
        const cmd = parseRelationCommand(txt)
        if (cmd) {
          try {
            executeRelation(editor, cmd)
            onFeedback?.({ type: 'success', message: `Relación ${cmd.aCard} → ${cmd.bCard} entre "${cmd.aName}" y "${cmd.bName}"${cmd.viceversa ? ' (viceversa)' : ''}.` })
          } catch (err) {
            onFeedback?.({ type: 'error', message: err?.message || 'No se pudo crear la relación.' })
          }
        } else {
          onFeedback?.({ type: 'hint', message: 'No entendí. Ej: "Crea relación uno a muchos de Usuarios a Pedidos".' })
        }
      }
    }

    recognitionRef.current = rec
    try { rec.start() } catch { const msg = 'No se pudo iniciar el micrófono.'; setError(msg); onFeedback?.({ type: 'error', message: msg }) }
  }, [editor, keepAlive, lang, onFeedback, stop])

  const parseText = useCallback((t) => parseRelationCommand(t), [])

  return { supported, listening, error, start, stop, parseText }
}
