import { SYSTEM_PROMPT, FAQ_SNIPPETS, FEW_SHOT_EXAMPLES } from "./assistantConstants";

export function buildPrompt({
  message,
  page,
  selection,
  role,
}: {
  message: string;
  page?: string;        // ej: window.location.pathname
  selection?: any;      // ej: { type:"entity", name:"Cliente" }
  role?: string;        // ej: "ADMIN" | "USER"
}) {
  const pageBlock = `\n[Contexto de página]\n- Ruta: ${page || "desconocida"}\n- Rol: ${role || "USER"}\n- Selección: ${selection ? JSON.stringify(selection).slice(0,400) : "n/a"}`;

  const kbBlock = `\n[Conocimiento del producto]\n${FAQ_SNIPPETS.map(s => `• ${s.title}: ${s.text}`).join("\n")}`;

  const examplesBlock = `\n[Ejemplos]\n${FEW_SHOT_EXAMPLES.map(e => `Usuario: ${e.user}\nAsistente: ${e.assistant}`).join("\n---\n")}`;

  const userBlock = `\n[Pregunta del usuario]\n${message}\n\n[Formato de respuesta]\n- Usa pasos 1., 2., 3.\n- Menciona botones/rutas si aplica.\n- Da tips/atajos si ayudan.\n`;

  // Concatenamos y, si quieres, recortas para no pasar de tokens.
  let final = `${SYSTEM_PROMPT}${pageBlock}${kbBlock}${examplesBlock}${userBlock}`;
  // recorte sencillo si el prompt se hiciera muy largo (opcional)
  if (final.length > 12000) final = final.slice(0, 12000) + "\n(Contenido truncado por longitud)";
  return final;
}
