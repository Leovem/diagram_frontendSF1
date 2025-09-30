// DiagramViewer.jsx
import { useCallback, useMemo, useState } from "react";
import { xml2js } from "xml-js";
import pako from "pako";
import he from "he";
import { generarSpringBootProyecto } from "./backendGenerator";

// ---------- Utils ----------
const ensureArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const decodeHtmlLabel = (raw) =>
  (he.decode(raw || "").replace(/<[^>]+>/g, "").trim()) || "";

const textOrCdata = (diagram) => {
  if (!diagram) return null;
  return diagram._text ?? diagram._cdata ?? null;
};

const kebab = (s) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

// ---------- Draw.io Parser ----------
function decodeDrawioStyle(style) {
  if (!style) return {};
  const map = Object.fromEntries(
    style
      .split(";")
      .filter(Boolean)
      .map((kv) => {
        const [k, v] = kv.split("=");
        return [k, v];
      })
  );

  const endArrow = map["endArrow"];
  const startArrow = map["startArrow"];
  const endFill = map["endFill"];
  const startFill = map["startFill"];
  let kind = "association";

  if (endArrow === "block" && endFill === "1") kind = "generalization";
  if ((startArrow === "diamond" || endArrow === "diamond") && (startFill === "0" || endFill === "0"))
    kind = "aggregation";
  if ((startArrow === "diamond" || endArrow === "diamond") && (startFill === "1" || endFill === "1"))
    kind = "composition";
  if (map["dashed"] === "1") kind = "dependency";

  return { kind };
}

function parseDrawio(content) {
  const xml = xml2js(content, { compact: true });
  let diagram = xml?.mxfile?.diagram;
  const diagrams = ensureArray(diagram);
  let chosen = diagrams[0];

  // Si el diagrama está comprimido
  const compressed = textOrCdata(chosen);
  if (compressed) {
    const inflated = pako.inflateRaw(
      Uint8Array.from(atob(compressed), (c) => c.charCodeAt(0)),
      { to: "string" }
    );
    const inner = xml2js(inflated, { compact: true });
    chosen = inner;
  }

  // mxCell(s)
  const cells = ensureArray(chosen?.mxGraphModel?.root?.mxCell);
  const classes = [];
  const rels = [];

  for (const cell of cells) {
    const attr = cell?._attributes ?? {};
    const isVertex = attr.vertex === "1";
    const isEdge = attr.edge === "1";

    if (isVertex) {
      const rawValue = attr.value || attr.label || "";
      const name = decodeHtmlLabel(rawValue) || `Node_${attr.id ?? ""}`.trim();
      classes.push({
        id: String(attr.id ?? crypto.randomUUID()),
        name,
        attributes: [],
        operations: [],
      });
    } else if (isEdge) {
      const id = String(attr.id ?? crypto.randomUUID());
      const sourceId = String(attr.source ?? "");
      const targetId = String(attr.target ?? "");
      const { kind = "association" } = decodeDrawioStyle(attr.style);
      if (sourceId && targetId) rels.push({ id, sourceId, targetId, kind });
    }
  }

  return { classes, rels };
}

// ---------- StarUML .mdj Parser ----------
function parseStarUmlMdj(jsonText) {
  const root = JSON.parse(jsonText);
  const index = {};

  (function buildIndex(obj) {
    if (obj && typeof obj === "object") {
      if (obj._id) index[obj._id] = obj;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (Array.isArray(v)) v.forEach(buildIndex);
        else if (v && typeof v === "object") buildIndex(v);
      }
    }
  })(root);

  const classes = [];
  const rels = [];

  (function walk(obj) {
    if (!obj || typeof obj !== "object") return;

    if (obj._type === "UMLClass") {
      const attributes = ensureArray(obj.attributes).map((a) => {
        const t = a?.type && index[a.type?.$ref];
        const typeName = t?.name ?? a?.typeExpression ?? undefined;
        const mult = a?.multiplicity
          ? Array.isArray(a.multiplicity)
            ? a.multiplicity.join("..")
            : String(a.multiplicity)
          : undefined;
        return { name: a?.name ?? "", type: typeName, multiplicity: mult };
      });

      const operations = ensureArray(obj.operations).map((o) => {
        const params = ensureArray(o.parameters).map((p) => {
          const t = p?.type && index[p.type?.$ref];
          return { name: p?.name ?? "", type: t?.name ?? p?.typeExpression ?? undefined };
        });
        const ret = params.find((p) => p.name === "return");
        const realParams = params.filter((p) => p.name !== "return");
        return { name: o?.name ?? "", params: realParams, returnType: ret?.type };
      });

      classes.push({
        id: obj._id,
        name: obj.name ?? "(anon)",
        attributes,
        operations,
      });
    }

    const relTypes = new Set([
      "UMLAssociation",
      "UMLGeneralization",
      "UMLAggregation",
      "UMLComposition",
      "UMLDependency",
    ]);

    if (relTypes.has(obj._type)) {
      const id = obj._id ?? crypto.randomUUID();
      let kind = "association";
      if (obj._type === "UMLGeneralization") kind = "generalization";
      if (obj._type === "UMLAggregation") kind = "aggregation";
      if (obj._type === "UMLComposition") kind = "composition";
      if (obj._type === "UMLDependency") kind = "dependency";

      const sourceId = obj.source?.$ref ?? "";
      const targetId = obj.target?.$ref ?? "";
      if (sourceId && targetId) rels.push({ id, sourceId, targetId, kind });
    }

    ensureArray(obj.ownedElements).forEach(walk);
  })(root);

  return { classes, rels };
}

// ---------- Componente ----------
export default function DiagramViewer() {
  const [clases, setClases] = useState([]);
  const [rels, setRels] = useState([]);
  const [modo, setModo] = useState("drawio"); // "drawio" | "staruml"
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);

  const handleFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = String(e.target?.result ?? "");

        if (ext === "mdj") {
          setModo("staruml");
          const { classes, rels } = parseStarUmlMdj(content);
          setClases(classes);
          setRels(rels);
        } else {
          setModo("drawio");
          const { classes, rels } = parseDrawio(content);
          setClases(classes);
          setRels(rels);
        }
      } catch (err) {
        console.error(err);
        setError(`No se pudo procesar el archivo: ${err?.message ?? err}`);
        setClases([]);
        setRels([]);
      }
    };
    reader.readAsText(file);
  }, []);

  const classNamesSet = useMemo(
    () => [...new Set(clases.map((c) => c.name).filter(Boolean))],
    [clases]
  );

  const badgeColor =
    modo === "staruml"
      ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
      : "bg-cyan-600/20 text-cyan-300 border-cyan-500/40";

  return (
    <div className="min-h-screen bg-[#0b1220] text-gray-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-[#0b1220]/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            CASE • Generador de <span className="text-indigo-400">Backend Spring Boot</span>
          </h1>
          <div
            className={`px-3 py-1 rounded-full text-sm border ${badgeColor}`}
            title="Modo según el archivo cargado"
          >
            Modo: {modo === "staruml" ? "StarUML (.mdj)" : "Draw.io / XML"}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Uploader */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Cargar diagrama</h2>
              <p className="text-sm text-gray-400">
                Acepta <code>.drawio</code>, <code>.xml</code> o <code>.mdj</code>.
              </p>
              {fileName && (
                <p className="text-xs text-gray-400 mt-1">Archivo: <span className="text-gray-200">{fileName}</span></p>
              )}
            </div>
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <span className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition shadow">
                Seleccionar archivo
              </span>
              <input
                type="file"
                accept=".drawio,.xml,.mdj"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/40 border border-red-500/30 text-red-100">
              {error}
            </div>
          )}

          {!error && clases.length === 0 && rels.length === 0 && (
            <div className="mt-6 text-gray-400">
              Carga un diagrama para extraer clases y relaciones. Luego podrás generar un proyecto
              Spring Boot con entidades, repos, servicios, controladores y DTOs.
            </div>
          )}
        </section>

        {/* Acciones */}
        {clases.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Generar proyecto</h2>
                <p className="text-sm text-gray-400">
                  Se usará el modelo extraído para construir un backend Spring Boot listo para correr.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    generarSpringBootProyecto(
                      { classes: clases, rels },
                      {
                        groupId: "com.misa.case",
                        artifactId: kebab(fileName?.split(".")[0] || "case-backend"),
                        packageBase: "com.misa.case",
                        db: "h2", // cambia a "postgres" si quieres datasource PG por defecto
                      }
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 transition shadow font-medium"
                  title="Genera un ZIP con el proyecto Maven"
                >
                  Generar Backend Spring Boot (ZIP)
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Resumen de modelo */}
        {clases.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-base font-semibold mb-3">🧾 Clases detectadas</h3>
              <ul className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {classNamesSet.map((n) => (
                  <li key={n} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-base font-semibold mb-3">🔗 Relaciones</h3>
              {rels.length === 0 ? (
                <p className="text-sm text-gray-400">No se detectaron relaciones.</p>
              ) : (
                <ul className="space-y-2 max-h-[360px] overflow-auto pr-1">
                  {rels.map((r) => (
                    <li
                      key={r.id}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                    >
                      <span className="text-gray-300">{r.sourceId}</span>
                      <span className="mx-2 text-gray-500">→</span>
                      <span className="text-gray-300">{r.targetId}</span>
                      <span className="ml-2 text-xs text-indigo-300">({r.kind})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Ayuda */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-base font-semibold mb-2">Notas</h3>
          <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
            <li>
              <strong>Draw.io:</strong> los nombres de clase se extraen del label; el tipo de relación se infiere del
              <code> style </code> (p. ej., <code>endArrow=block;endFill=1</code> ≈ generalización).
            </li>
            <li>
              <strong>StarUML:</strong> se resuelven tipos de atributos y parámetros vía referencias <code>$ref</code>.
            </li>
            <li>
              El ZIP contiene: <em>pom.xml</em>, <em>application.properties</em>, entidades JPA, repos, servicios,
              controladores, DTOs y colección Postman.
            </li>
          </ul>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} CASE Generator — Spring Boot
      </footer>
    </div>
  );
}
