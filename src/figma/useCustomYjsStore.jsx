import { createTLStore, defaultShapeUtils } from '@tldraw/tldraw'
import { applyUpdate } from 'yjs'
// Hook personalizado para sincronizar Tldraw con Yjs
export function useCustomYjsStore(doc) {
  const store = createTLStore({ shapeUtils: defaultShapeUtils })

  const yMap = doc.getMap('tldraw-data')

  // Cargar estado previo si existe
  const existingData = yMap.get('snapshot')
  if (existingData) {
    store.loadSnapshot(existingData)
  }

  // Escuchar cambios remotos de Yjs
  doc.on('update', () => {
    const data = yMap.get('snapshot')
    if (data) {
      store.loadSnapshot(data)
    }
  })

  // Guardar cambios locales en Yjs
  store.listen(() => {
    yMap.set('snapshot', store.getSnapshot())
  })

  return store
}