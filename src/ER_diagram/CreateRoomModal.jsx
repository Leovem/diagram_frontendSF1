import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

/* ============================
   Gestor global de body scroll
============================ */
let __modalScrollLocks = 0
let __prevBodyOverflow = ''

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (__modalScrollLocks === 0) {
    __prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  __modalScrollLocks++
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  __modalScrollLocks = Math.max(0, __modalScrollLocks - 1)
  if (__modalScrollLocks === 0) {
    document.body.style.overflow = __prevBodyOverflow
  }
}

/**
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onCreate: ({ name, slug, visibility }) => (void|Promise<void>)
 * - roomInput: string
 * - setRoomInput: (v: string) => void
 * - existingSlugs?: string[]
 * - allowCustomSlug?: boolean        // default: true
 * - initialVisibility?: 'private'|'public' // default: 'private'
 */
export default function CreateRoomModal({
  isOpen,
  onClose,
  onCreate,
  roomInput,
  setRoomInput,
  existingSlugs = [],
  allowCustomSlug = true,
  initialVisibility = 'private',
}) {
  if (typeof document === 'undefined') return null

  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const slugRef = useRef(null)
  const lastFocusedRef = useRef(null)

  const [slugEdited, setSlugEdited] = useState(false)
  const [slugValue, setSlugValue] = useState('')
  const [visibility, setVisibility] = useState(initialVisibility)
  const [errorMsg, setErrorMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  // Slugs normalizados (mejora rendimiento)
  const normalizedSlugsSet = useMemo(
    () => new Set((existingSlugs || []).map((s) => String(s || '').toLowerCase())),
    [existingSlugs]
  )

  // ---------- Utils ----------
  const slugify = useCallback((s) => {
    const base = String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/[^a-z0-9\-_\s]/g, '')                   // quita chars raros
      .trim()
      .replace(/\s+/g, '-')                             // espacios -> guiones
      .replace(/-+/g, '-')                              // colapsa guiones
      .replace(/^[-_]+|[-_]+$/g, '')                    // bordes
    return base || 'sala'
  }, [])

  const uniqueSlug = useCallback((base) => {
    const b = String(base || '').toLowerCase()
    if (!normalizedSlugsSet.has(b)) return base
    let i = 1
    while (normalizedSlugsSet.has(`${b}-${i}`)) i++
    return `${base}-${i}`
  }, [normalizedSlugsSet])

  const validateName = useCallback((name) => {
    const n = String(name || '')
    if (!n.trim()) return 'El nombre no puede estar vacío.'
    if (n.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres.'
    if (n.length > 64) return 'El nombre no debe exceder 64 caracteres.'
    return null
  }, [])

  const validateSlug = useCallback((slug) => {
    const s = String(slug || '')
    if (!s) return 'Slug vacío.'
    if (!/^[a-z0-9]([a-z0-9-_]*[a-z0-9])?$/.test(s)) {
      return 'El slug solo permite a-z, 0-9, - y _. Debe iniciar y terminar en alfanumérico.'
    }
    if (s.length < 3) return 'El slug debe tener al menos 3 caracteres.'
    if (s.length > 72) return 'El slug no debe exceder 72 caracteres.'
    if (normalizedSlugsSet.has(s.toLowerCase())) return 'Ya existe una sala con ese slug.'
    return null
  }, [normalizedSlugsSet])

  // ---------- Derivados ----------
  const autoSlug = useMemo(() => uniqueSlug(slugify(roomInput || '')), [roomInput, slugify, uniqueSlug])

  // Sincroniza slugValue mientras no haya edición manual
  useEffect(() => {
    if (!slugEdited) setSlugValue(autoSlug)
  }, [autoSlug, slugEdited])

  // Validación en vivo
  useEffect(() => {
    const nameErr = validateName(roomInput || '')
    if (nameErr) { setErrorMsg(nameErr); return }
    const slugErr = validateSlug(slugValue || '')
    setErrorMsg(slugErr)
  }, [roomInput, slugValue, validateName, validateSlug])

  /* =========================================================
     Bloqueo/desbloqueo de scroll y manejo de foco según isOpen
  ========================================================== */
  useEffect(() => {
    if (isOpen) {
      // Lock scroll
      lockBodyScroll()
      // Guardar foco y enfocar input
      lastFocusedRef.current = document.activeElement || null
      const t = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          if (inputRef.current.select) inputRef.current.select()
        }
      }, 0)
      return () => {
        clearTimeout(t)
        // Al cerrar (o desmontar), restaurar foco y desbloquear scroll
        if (lastFocusedRef.current && lastFocusedRef.current.focus) {
          lastFocusedRef.current.focus()
        }
        unlockBodyScroll()
      }
    }
    // Si isOpen pasa a false (y el componente sigue montado), asegúrate de liberar el lock.
    unlockBodyScroll()
    return undefined
  }, [isOpen])

  // Focus trap cuando está abierto
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return
    if (e.key === 'Escape' && !loading) {
      e.stopPropagation()
      if (onClose) onClose()
      return
    }
    if (e.key === 'Enter') {
      if (!errorMsg && roomInput && roomInput.trim() !== '' && !loading) {
        handleCreate()
      }
      return
    }
    if (e.key === 'Tab') {
      const dlg = dialogRef.current
      if (!dlg) return
      const focusable = dlg.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }, [isOpen, loading, errorMsg, roomInput, onClose])

  // Cerrar al click fuera (solo si abierto y no cargando)
  const handleOverlayMouseDown = useCallback((e) => {
    if (!isOpen || loading) return
    if (e.target === overlayRef.current) {
      if (onClose) onClose()
    }
  }, [isOpen, loading, onClose])

  // Crear
  const handleCreate = useCallback(async () => {
    if (loading) return
    const nameErr = validateName(roomInput || '')
    const s = slugValue || ''
    const slugErr = validateSlug(s)

    if (nameErr || slugErr) {
      setErrorMsg(nameErr || slugErr)
      const el = nameErr ? inputRef.current : slugRef.current
      if (el && el.focus) el.focus()
      return
    }

    try {
      setLoading(true)
      if (onCreate) {
        await Promise.resolve(onCreate({
          name: roomInput.trim(),
          slug: s,
          visibility
        }))
      }
      setLoading(false)
      if (onClose) onClose()
    } catch (err) {
      setLoading(false)
      const msg = (err && err.message) ? err.message : 'No se pudo crear la sala.'
      setErrorMsg(msg)
    }
  }, [loading, onCreate, onClose, roomInput, slugValue, validateName, validateSlug, visibility])

  const titleId = 'create-room-title'
  const descId = 'create-room-desc'
  const errId = 'create-room-error'

  // Si no está abierto, no pintamos el modal (pero el efecto ya gestionó el unlock)
  if (!isOpen) return null

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 px-4 overflow-y-auto overscroll-contain"
      onMouseDown={handleOverlayMouseDown}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl outline-none my-8
                   max-h-[calc(100vh-4rem)] overflow-y-auto
                   dark:bg-slate-900 dark:text-slate-100"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
          <h2 id={titleId} className="text-2xl font-bold mb-2">
            Crear sala
          </h2>
          <p id={descId} className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Define un nombre. El <span className="font-semibold">slug</span> se generará automáticamente y debe ser único.
          </p>

          {/* Nombre */}
          <label className="block text-sm font-medium mb-2">Nombre de la sala</label>
          <input
            ref={inputRef}
            type="text"
            value={roomInput}
            onChange={(e) => {
              const v = e.target.value
              setRoomInput(v)
              if (!v) setSlugEdited(false)
            }}
            placeholder="Ej. equipo-diseno-1"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2
                       text-gray-900 placeholder-gray-400 shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
                       dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
                       dark:placeholder-slate-400"
          />

          {/* Slug */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Slug (URL)</label>
              {allowCustomSlug && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugEdited(false)
                    setSlugValue(uniqueSlug(slugify(roomInput || '')))
                    if (slugRef.current && slugRef.current.focus) slugRef.current.focus()
                  }}
                  className="text-xs text-cyan-700 hover:underline disabled:opacity-50"
                  disabled={loading}
                >
                  Re-generar
                </button>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <input
                ref={slugRef}
                type="text"
                value={slugValue}
                onChange={(e) => {
                  setSlugEdited(true)
                  setSlugValue(slugify(e.target.value))
                }}
                readOnly={!allowCustomSlug}
                className={`w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none
                  ${allowCustomSlug
                    ? 'border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-800 dark:border-slate-700'
                    : 'border-gray-200 bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                aria-invalid={!!errorMsg}
                aria-describedby={errorMsg ? errId : undefined}
              />
              {!allowCustomSlug && (
                <span className="text-xs text-gray-500 dark:text-slate-400 select-none">auto</span>
              )}
            </div>

            {/* Sugerencia si existe */}
            {normalizedSlugsSet.has((slugValue || '').toLowerCase()) && (
              <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Ese slug ya existe. Prueba <code>{uniqueSlug(slugValue)}</code>.
              </div>
            )}
          </div>

          {/* Visibilidad */}
          <div className="mt-5">
            <label className="block text-sm font-medium mb-2">Visibilidad</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`px-3 py-1.5 rounded-lg border transition
                  ${visibility === 'private'
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
                  }
                  dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700`}
                aria-pressed={visibility === 'private'}
              >
                Privada
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`px-3 py-1.5 rounded-lg border transition
                  ${visibility === 'public'
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
                  }
                  dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700`}
                aria-pressed={visibility === 'public'}
              >
                Pública
              </button>
            </div>
          </div>

          {/* Error */}
          <div
            id={errId}
            role={errorMsg ? 'alert' : undefined}
            aria-live="polite"
            className="min-h-[1.25rem] mt-3 text-sm text-red-600 dark:text-red-400"
          >
            {errorMsg || ' '}
          </div>

          {/* Acciones */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 hover:bg-gray-300
                         dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!!errorMsg || !roomInput || roomInput.trim() === '' || loading}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
            >
              {loading && (
                <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              )}
              Crear
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
