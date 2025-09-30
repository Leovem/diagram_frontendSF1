// src/ai/BotAI.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useGemini } from "./useGemini";
import { buildPrompt } from "./buildPrompt";

export default function BotAI() {
  const { generateTextStream, loading, error } = useGemini();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "¡Hola! Soy tu asistente. ¿En qué te ayudo hoy?" },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [animPulse, setAnimPulse] = useState(false);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef((typeof window !== "undefined" && window.speechSynthesis) || null);

  useEffect(() => { const el=listRef.current; if(el) el.scrollTop=el.scrollHeight; }, [messages, loading]);

  const supportsSTT = useMemo(() =>
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window),
  []);

  useEffect(() => {
    if (!supportsSTT) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "es-ES"; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e) => {
      let t=""; for (let i=e.resultIndex;i<e.results.length;i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
  }, [supportsSTT]);

  const startListening = () => { if(recognitionRef.current){ setIsListening(true); recognitionRef.current.start(); } };
  const stopListening  = () => { if(recognitionRef.current){ recognitionRef.current.stop(); setIsListening(false); } };

  const speak = (text) => {
    if (!ttsEnabled || !synthRef.current) return;
    const u = new SpeechSynthesisUtterance(text); u.lang="es-ES";
    synthRef.current.cancel(); synthRef.current.speak(u);
  };

  const buildContext = (msgs) =>
    msgs.map(m => `${m.role==="user"?"Usuario":"Asistente"}: ${m.content}`).join("\n") + "\nAsistente:";

  /*const handleSend = async () => {
    const prompt = input.trim(); if (!prompt || loading) return;
    const userMsg = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMsg]); setInput(""); setAnimPulse(true);

    let streamed = "";
    const onChunk = (chunk) => {
      streamed += chunk;
      setMessages(prev => {
        const last = prev[prev.length-1];
        if (last?.role==="assistant" && last.typing) {
          const copy=[...prev]; copy[copy.length-1]={...last, content:streamed}; return copy;
        }
        return [...prev, { role:"assistant", content: streamed, typing:true }];
      });
    };

    try {
      await generateTextStream(buildContext([...messages, userMsg]), onChunk, "gemini-2.5-flash");
      setMessages(prev => {
        const copy=[...prev]; const last=copy[copy.length-1];
        if (last?.role==="assistant") copy[copy.length-1]={ role:"assistant", content:last.content };
        return copy;
      });
      setAnimPulse(false); speak(streamed);
    } catch {
      setAnimPulse(false);
      setMessages(prev => [...prev, { role:"assistant", content:"Ups, ocurrió un problema." }]);
    }
  };*/
  const handleSend = async () => {
  const promptText = input.trim();
  if (!promptText || loading) return;

  const userMsg = { role: "user", content: promptText };
  setMessages(prev => [...prev, userMsg]);
  setInput("");
  setAnimPulse(true);

  let streamed = "";
  const onChunk = (chunk) => {
    streamed += chunk;
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.typing) {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: streamed, typing: true };
        return copy;
      }
      return [...prev, { role: "assistant", content: streamed, typing: true }];
    });
  };
  const prompt = buildPrompt({
    message: promptText,
    page: window.location.pathname,
    role: /* si tienes decode del JWT */ undefined,
    selection: /* ej: tu estado de entidad seleccionada */ undefined,
  });

  try {
    await generateTextStream(prompt, onChunk, "gemini-2.5-flash");
    setMessages(prev => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") copy[copy.length - 1] = { role: "assistant", content: last.content };
      return copy;
    });
    setAnimPulse(false);
    speak(streamed);
  } catch {
    setAnimPulse(false);
    setMessages(prev => [...prev, { role: "assistant", content: "Ups, ocurrió un problema." }]);
  }
};

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full bg-indigo-500/90 grid place-items-center shadow ${animPulse?"animate-pulse":""}`}>
            <span>🤖</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-indigo-300">Bot AI</div>
            <div className="text-[11px] text-white/60">Gemini · Streaming · Voz</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>setTtsEnabled(v=>!v)}
            className={`px-2 py-1 rounded text-xs border ${ttsEnabled?"bg-emerald-600 border-emerald-500":"bg-gray-800 border-gray-700"}`}
          >
            🔊 {ttsEnabled?"ON":"OFF"}
          </button>
          {supportsSTT ? (
            <button
              onClick={isListening?stopListening:startListening}
              className={`px-2 py-1 rounded text-xs border ${isListening?"bg-rose-600 border-rose-500":"bg-gray-800 border-gray-700"}`}
            >
              {isListening?"🎙️ Grabando":"🎤 Dictar"}
            </button>
          ) : <span className="text-[11px] text-white/50">Mic no soportado</span>}
        </div>
      </div>

      {/* Mensajes */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-white/5 backdrop-blur">
        {messages.map((m,i)=>(
          <Bubble key={i} role={m.role} typing={m.typing}>{m.content}</Bubble>
        ))}
        {loading && <div className="text-white/70 text-sm flex items-center gap-2">Elaborando… <Dots/></div>}
        {error && <div className="text-rose-400 text-sm">Error: {error}</div>}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 bg-black/30 p-2">
        <div className="flex gap-2">
          <input
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&handleSend()}
            placeholder="Escribe tu mensaje…"
            className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-xl px-3 py-2 outline-none border border-white/10 focus:border-indigo-400"
          />
          <button
            onClick={handleSend} disabled={loading||!input.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 shadow"
          >➤</button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, children, typing }) {
  const isUser = role==="user";
  return (
    <div className={`w-full flex ${isUser?"justify-end":"justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow transition ${typing?"animate-pulse":""} ${
        isUser? "bg-indigo-600 text-white rounded-br-sm" : "bg-white/10 border border-white/10 text-white rounded-bl-sm"
      }`}>
        {!isUser && <div className="text-[11px] text-white/60 mb-1">Asistente</div>}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
function Dots(){return(
  <span className="inline-flex gap-1 items-center">
    <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:120ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:240ms]" />
  </span>
);}
