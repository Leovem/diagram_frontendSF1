import React, { useState } from 'react'
import { useGeminiVision } from './useGeminiVision'
import { convertToShapes, validateAIJson, fixAIJsonIssues } from './shapeConverter'
import { useEditor } from 'tldraw'

export default function ImageUpload() {
  const editor = useEditor()
  const { analyzeImage, loading, error } = useGeminiVision()
  const [log, setLog] = useState("")

  const handleImage = async (file) => {
    if (!file) return
    
    setLog("🔍 Analizando imagen con Gemini Vision...")

    try {
      //  Usar el prompt por defecto del hook (mejorado)
      // Si necesitas personalizar, pasa un segundo parámetro
      const responseText = await analyzeImage(file)

      //  Log de respuesta original
      console.log("🧠 Respuesta de Gemini Vision:", responseText)
      setLog("📥 Respuesta recibida de la IA")

      // 🧹 Limpiar respuesta antes de parsear
      const cleanResponse = responseText
        .replace(/<\/?[^>]+(>|$)/g, "") // eliminar HTML
        .replace(/^[^{]+/, "") // eliminar texto antes del primer '{'
        .replace(/[^}]+$/, "") // eliminar texto después del último '}'
        .trim()

      //  Parsear JSON
      let data
      try {
        data = JSON.parse(cleanResponse)
      } catch (parseErr) {
        console.error("❌ Error al parsear JSON:", cleanResponse)
        setLog("❌ La IA no devolvió un JSON válido.\n\nRespuesta:\n" + cleanResponse)
        throw new Error("Respuesta inválida de la IA. Por favor, intenta con otra imagen.")
      }

      //  Validar estructura del JSON
      setLog("🔍 Validando estructura del JSON...")
      const validation = validateAIJson(data)
      
      if (!validation.valid) {
        console.warn("⚠️ Errores de validación:", validation.errors)
        setLog(" Advertencias detectadas:\n" + validation.errors.join("\n") + "\n\n Intentando corregir automáticamente...")
        
        // Intentar corrección automática
        data = fixAIJsonIssues(data)
        
        // Validar de nuevo después de correcciones
        const revalidation = validateAIJson(data)
        if (!revalidation.valid) {
          setLog((l) => l + "\n\n❌ No se pudo corregir automáticamente:\n" + revalidation.errors.join("\n"))
          throw new Error("El JSON tiene errores que no se pueden corregir automáticamente")
        }
        
        setLog((l) => l + "\n Correcciones aplicadas exitosamente")
      } else {
        setLog(" JSON válido recibido")
      }

      //  Mostrar resumen de datos detectados
      const summary = `
 Resumen del modelo:
• ${data.entities?.length || 0} entidades detectadas
• ${data.relations?.length || 0} relaciones detectadas
${data.entities?.filter(e => e.isJoinTable).length > 0 ? `• ${data.entities.filter(e => e.isJoinTable).length} tablas intermedias` : ''}

Entidades:
${data.entities?.map(e => {
  const pkStr = e.primaryKeys?.join(', ') || 'sin PK'
  const joinStr = e.isJoinTable ? ' [TABLA INTERMEDIA]' : ''
  return `  • ${e.name} (${e.attributes?.length || 0} atributos, PK: ${pkStr})${joinStr}`
}).join('\n')}
      `.trim()

      setLog((l) => l + "\n\n" + summary)
      console.log("📊 Datos procesados:", data)

      //  Convertir a shapes de Tldraw
      setLog((l) => l + "\n\n Generando diagrama...")
      convertToShapes(data, editor)
      
      setLog((l) => l + "\n✨ Diagrama insertado correctamente en el canvas")

    } catch (err) {
      console.error("❌ Error en handleImage:", err)
      setLog((l) => l + "\n\n❌ Error: " + err.message)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImage(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  return (
    <div 
      className="p-6 rounded-xl bg-zinc-900 text-gray-100 border border-zinc-700"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <h3 className="font-semibold mb-2 text-lg">
        🧠 Reconocimiento de diagrama ER con IA
      </h3>
      
      <p className="text-sm text-gray-400 mb-4">
        Sube una imagen de tu diagrama (manuscrito o digital)
      </p>

      <div className="mb-4">
        <label 
          htmlFor="image-upload" 
          className="block cursor-pointer"
        >
          <div className="border-2 border-dashed border-zinc-600 rounded-lg p-6 text-center hover:border-zinc-500 transition-colors">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400 mb-2" 
              stroke="currentColor" 
              fill="none" 
              viewBox="0 0 48 48"
            >
              <path 
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                strokeWidth={2} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
            <p className="text-sm text-gray-300">
              Click para seleccionar o arrastra una imagen aquí
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WEBP (máx. 10MB)
            </p>
          </div>
        </label>
        
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={(e) => handleImage(e.target.files[0])}
          className="hidden"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-blue-400 mb-3">
          <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <span className="text-sm">Procesando con IA...</span>
        </div>
      )}

      {log && (
        <div className="bg-zinc-800 rounded-lg p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-300">Registro de proceso</h4>
            <button
              onClick={() => setLog("")}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Limpiar
            </button>
          </div>
          <pre className="text-xs max-h-80 overflow-y-auto whitespace-pre-wrap text-gray-300 font-mono">
            {log}
          </pre>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
          <p className="text-red-400 text-sm">
            ❌ {error}
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-zinc-700">
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-300">
             Consejos para mejores resultados
          </summary>
          <ul className="mt-2 space-y-1 ml-4 list-disc">
            <li>Usa imágenes con buena iluminación y contraste</li>
            <li>Asegúrate de que el texto sea legible</li>
            <li>Incluye las cardinalidades en las relaciones (1, *, 1..*, etc.)</li>
            <li>Marca claramente las claves primarias (subrayadas o con "PK")</li>
            <li>Funciona con diagramas manuscritos y digitales</li>
          </ul>
        </details>
      </div>
    </div>
  )
}