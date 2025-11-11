// src/ER_diagram/editorStore.js
let _editor = null

export function setEditor(editorInstance) {
  if (!editorInstance) {
    console.warn("⚠️ setEditor() recibió un valor nulo.")
    return
  }
  _editor = editorInstance
  //console.log("🧩 Editor global registrado.")
}

export function getEditor() {
  if (!_editor) {
    console.warn("⚠️ getEditor() llamado antes de inicializar el editor.")
  }
  return _editor
}
