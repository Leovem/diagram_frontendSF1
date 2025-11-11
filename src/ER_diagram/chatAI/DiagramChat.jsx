import React, { useState, useRef, useEffect } from "react"
import { useDiagramAI } from "./useDiagramAI"
import { motion, AnimatePresence } from "framer-motion"

export default function DiagramChat({ onClose }) {
  const { processInstruction, loading, error } = useDiagramAI()
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "👋 Hola, soy tu asistente de diagramas.\nPuedo ayudarte con tu modelo ER.\n\nEjemplos:\n• \"Crea tabla Libro con título, autor y año\"\n• \"Agrega relación muchos a muchos entre Libro y Usuario\"\n• \"Añade atributo fecha_creacion a Usuario\"\n\nTambién puedes usar 🎤 voz.",
    },
  ])
  const [input, setInput] = useState("")
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)

  // === Scroll automático al final ===
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // === Inicializar reconocimiento de voz ===
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      console.warn("🎤 SpeechRecognition no soportado en este navegador.")
      return
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = "es-ES"
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (e) => {
      console.error("Error en reconocimiento de voz:", e)
      setListening(false)
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      console.log("🎙️ Instrucción detectada:", transcript)
      setInput(transcript)
      setTimeout(() => handleSend(transcript), 300)
    }

    recognitionRef.current = recognition
  }, [])

  const handleSend = async (text) => {
    const userText = (text || input).trim()
    if (!userText) return

    setInput("")
    setMessages((msgs) => [...msgs, { role: "user", text: userText }])

    try {
      const response = await processInstruction(userText)
      setMessages((msgs) => [
        ...msgs,
        {
          role: "assistant",
          text: `✅ He aplicado tu instrucción: "${userText}".\n\nEl diagrama ha sido actualizado.`,
        },
      ])
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", text: `❌ Error: ${err.message}` },
      ])
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("🎤 Tu navegador no soporta reconocimiento de voz.")
      return
    }
    if (listening) recognitionRef.current.stop()
    else recognitionRef.current.start()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute left-20 top-6 w-[380px] h-[480px] flex flex-col rounded-2xl bg-gray-900/90 border border-gray-700/70 shadow-2xl backdrop-blur-lg overflow-hidden z-[2000]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/70 bg-gray-800/60 backdrop-blur-md">
          <div className="font-medium text-gray-200 flex items-center gap-2">
            💬 Asistente ER
            <motion.span
              animate={listening ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
              transition={{ repeat: listening ? Infinity : 0, duration: 1 }}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                listening ? "bg-emerald-500/60" : "bg-gray-600/50"
              }`}
            >
              {listening ? "Escuchando..." : "Listo"}
            </motion.span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleListening}
              className={`text-lg transition ${
                listening
                  ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                  : "text-gray-400 hover:text-gray-100"
              }`}
              title={listening ? "Detener micrófono" : "Hablar con IA"}
            >
              🎤
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 text-lg px-2"
                title="Cerrar"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700/50 scrollbar-track-transparent">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`rounded-2xl px-3 py-2 max-w-[80%] whitespace-pre-wrap leading-relaxed text-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-800/80 text-gray-100 border border-gray-700/50"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="text-xs text-gray-400 italic">Procesando...</div>
          )}
          {error && (
            <div className="text-xs text-rose-400 italic">{error}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700/70 bg-gray-800/70 px-3 py-2 flex gap-2 items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Escribe o dicta una instrucción..."
            className="flex-1 resize-none rounded-xl p-2 text-sm bg-gray-900/60 text-gray-100 border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[45px]"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl shadow transition-all"
          >
            {loading ? "..." : "▶️"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
