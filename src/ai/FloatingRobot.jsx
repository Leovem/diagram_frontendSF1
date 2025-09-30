import { useEffect, useRef, useState } from "react";

/**
 * Robot flotante que abre el panel de IA.
 * - Parpadea, flota y saluda en hover.
 * - Incluye anillo "pulse" y tooltip minimal.
 */
export default function FloatingRobot({ onClick, className = "" }) {
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ringRef = useRef(null);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className={`fixed top-1/2 right-5 -translate-y-1/2 z-50 ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Anillo pulsante */}
      <div
        ref={ringRef}
        className="absolute inset-0 translate-x-1 translate-y-1 pointer-events-none"
        aria-hidden="true"
      >
        <span
          className="rb-pulse absolute inset-0 rounded-full bg-indigo-500/30"
          style={{
            animation: "rb_pulse 1.8s ease-out infinite",
            filter: "blur(2px)",
          }}
        />
      </div>

      {/* Botón principal */}
      <button
        onClick={onClick}
        aria-label="Abrir asistente"
        className="relative h-16 w-16 rounded-full grid place-items-center 
                   shadow-2xl border border-white/10
                   bg-gradient-to-br from-indigo-600 to-indigo-700
                   hover:from-indigo-500 hover:to-indigo-700
                   active:scale-95 transition"
      >
        {/* Cuerpo del robot (SVG) */}
        <div
          className="rb-anim"
          style={{ animation: "rb_bob 2.6s ease-in-out infinite" }}
        >
          <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
            {/* Antena */}
            <circle cx="32" cy="8" r="3" fill="#FBBF24" />
            <rect x="31" y="10" width="2" height="6" rx="1" fill="#FBBF24" />

            {/* Cabeza */}
            <rect x="16" y="18" width="32" height="20" rx="10" fill="#0EA5E9" />
            <rect x="16" y="18" width="32" height="20" rx="10" stroke="white" opacity=".15"/>

            {/* Ojos */}
            <g transform="translate(0,0)">
              <circle cx="26" cy="28" r="4" fill="white" />
              <circle cx="38" cy="28" r="4" fill="white" />
              <rect x="24" y="26" width="4" height="4" rx="2" fill="#1F2937"
                    className="rb-blink" style={{ transformOrigin: "26px 28px", animation: "rb_blink 4s linear infinite" }}/>
              <rect x="36" y="26" width="4" height="4" rx="2" fill="#1F2937"
                    className="rb-blink" style={{ transformOrigin: "38px 28px", animation: "rb_blink 4.2s linear infinite" }}/>
            </g>

            {/* Boca */}
            <rect x="26" y="34" width="12" height="2" rx="1" fill="white" opacity=".8" />

            {/* Cuerpo */}
            <rect x="20" y="40" width="24" height="16" rx="8" fill="#1E293B" />
            <rect x="20" y="40" width="24" height="16" rx="8" stroke="white" opacity=".1"/>
            <circle cx="28" cy="48" r="2" fill="#22C55E" />
            <circle cx="36" cy="48" r="2" fill="#F43F5E" />

            {/* Brazo derecho (saludo) */}
            <g transform="translate(44,44)">
              <rect x="0" y="-2" width="10" height="4" rx="2" fill="#0EA5E9"
                className="rb-wave"
                style={{ transformOrigin: "0px 0px", animation: hover ? "rb_wave 900ms ease-in-out" : "none" }}
              />
              <circle cx="10" cy="0" r="2.6" fill="#0EA5E9" />
            </g>

            {/* Piernas (simple sombra) */}
            <ellipse cx="32" cy="58" rx="10" ry="3" fill="black" opacity=".2"/>
          </svg>
        </div>
      </button>

      {/* Tooltip */}
      <div
        className={`absolute right-20 bottom-3 select-none 
                    px-3 py-1 rounded-lg text-xs bg-black/70 text-white shadow
                    transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}
      >
        Abrir asistente
      </div>
    </div>
  );
}
