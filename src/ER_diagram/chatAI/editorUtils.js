// src/ER_diagram/editorUtils.js
import { useEditor } from "tldraw"
import { getEditor } from "./editorStore"
import { shapesToERGraph } from "../erParser" // Ajusta la ruta si es otra

// Versión para usar dentro de componentes montados en <Tldraw>
export function useCurrentGraph() {
  const editor = useEditor()
  if (!editor) {
    // console.warn("⚠️ Editor no disponible en useCurrentGraph()")
    return null
  }
  const graph = shapesToERGraph(editor)
  return graph
}

// Versión global (usable desde IA, chat, fuera de React)
export function getCurrentGraph() {
  const editor = getEditor()
  if (!editor) {
    // console.warn("⚠️ Editor no disponible en getCurrentGraph()")
    return null
  }
  const graph = shapesToERGraph(editor)
  return graph
}
