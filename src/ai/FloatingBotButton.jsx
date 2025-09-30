// src/ai/FloatingBotButton.jsx
export default function FloatingBotButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-indigo-600 shadow-2xl grid place-items-center
                 hover:scale-105 transition transform active:scale-95"
      title="Abrir asistente"
    >
      <span className="text-2xl">🤖</span>
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></span>
    </button>
  );
}
