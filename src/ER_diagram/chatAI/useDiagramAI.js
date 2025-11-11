import { useState, useMemo } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getEditor } from "./editorStore"
import { shapesToERGraph } from "../erParser"
import { convertToShapes } from "../imageRecognition/shapeConverter"

const systemPrompt = `
Eres un asistente experto en modelado Entidad-Relación (ER).

Responde **solo** con un bloque JSON válido (sin explicaciones).
El formato es este:

{
  "entities": [
    {
      "name": "string",
      "attributes": [
        { "name": "string", "type": "string" }
      ],
      "primaryKeys": ["string"],
      "isJoinTable": false
    }
  ],
  "relations": [
    {
      "from": "string",
      "to": "string",
      "aCard": "1|0..1|1..*|0..*",
"bCard": "1|0..1|1..*|0..*",

      "relationType": "association|composition|aggregation|inheritance"
    }
  ]
}

Reglas:
- Usa comillas dobles en todo el JSON.
- No incluyas texto fuera del JSON.
- Si el diagrama está vacío, crea uno nuevo.
- Si existe, modifícalo según la instrucción.
- Todos los identificadores únicos (por ejemplo, id_libro, id_autor, id_usuario, etc.)
  deben generarse en formato UUID v4, por ejemplo:
  "550e8400-e29b-41d4-a716-446655440000".
  ⚠️ Todos los tipos de atributos (fecha, número, booleano, etc.) deben ser convertidos a "string".
`

export function useDiagramAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const genAI = useMemo(() => (apiKey ? new GoogleGenerativeAI(apiKey) : null), [apiKey])

  const ensureReady = () => {
    if (!apiKey) throw new Error("❌ Falta VITE_GEMINI_API_KEY en tu .env.local")
    if (!genAI) throw new Error("⚠️ Cliente Gemini no inicializado correctamente")
  }

  async function processInstruction(instruction) {
    setLoading(true)
    setError(null)

    try {
      ensureReady()

      const editor = getEditor()
      if (!editor) throw new Error("Editor no disponible")

      const erGraph = shapesToERGraph(editor)
      console.log("📊 ERGraph actual antes de enviar a IA:", erGraph)

      const fullPrompt = `
${systemPrompt}

ERGraph actual:
${JSON.stringify(erGraph, null, 2)}

Instrucción del usuario:
"${instruction}"
`

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
      const result = await model.generateContent(fullPrompt)

      const rawText = result.response.text()
      console.log("🧠 Respuesta cruda de Gemini:", rawText)

      // Limpiar respuesta (quitar markdown o texto extra)
      const cleanText = rawText
        .replace(/```(json)?/g, "")
        .replace(/^[^{]*({[\s\S]*})[^}]*$/, "$1")
        .trim()

      console.log("🧩 JSON limpio detectado:")
      console.log(cleanText)

      let data
      try {
        data = JSON.parse(cleanText)
      } catch (err) {
        console.error("❌ Error parseando JSON:", err)
        console.warn("Texto recibido:", cleanText)
        throw new Error("La IA no devolvió un JSON válido.")
      }

      console.log("✅ JSON final enviado a convertToShapes():", data)

      // Insertar shapes en el editor
      // 🧼 Limpiar todos los shapes del canvas antes de actualizar
try {
  const allShapeIds = editor.getCurrentPageShapeIds()
  if (allShapeIds.size > 0) {
    editor.deleteShapes([...allShapeIds])
    console.log(`🧽 Canvas limpiado: ${allShapeIds.size} shapes eliminadas.`)
  } else {
    console.log("🧩 No hay shapes que eliminar (canvas vacío).")
  }
} catch (e) {
  console.warn("⚠️ No se pudo limpiar el canvas:", e)
}

      convertToShapes(data, editor)
      console.log("✨ Diagrama actualizado en el canvas")

      return data
    } catch (err) {
      console.error("❌ Error en processInstruction:", err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { processInstruction, loading, error }
}
