// src/ai/BotAISidebar.jsx
import BotAI from "./BotAI";

export default function BotAISidebar({ open, onClose }) {
  return (
    <>
      {/* Backdrop (mobile/tablet) */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-40 ${open?"opacity-100":"pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      {/* Panel deslizante */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#0b0f1a] text-white border-l border-white/10 z-50
                    transform transition-transform duration-300 ${open?"translate-x-0":"translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm text-white/70">Asistente</div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-sm border px-2 py-1 rounded">
              Cerrar ✕
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <BotAI />
          </div>
        </div>
      </aside>
    </>
  );
}
