import { useState } from "react";
import { xml2js } from "xml-js";
import { generarAngularProyecto } from "./angularGenerator";
function DiagramViewer() {
  const [clases, setClases] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [modo, setModo] = useState("drawio");
  const [formularios, setFormularios] = useState({});

  const handleFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop();

    const reader = new FileReader();
    reader.onload = (e) => {
      const contenido = e.target.result;

      if (ext === "mdj") {
        setModo("staruml");
        const json = JSON.parse(contenido);
        ML(json);
      } else {
        setModo("drawio");
        const xml = xml2js(contenido, { compact: true });
        procesarDrawio(xml);
      }
    };

    reader.readAsText(file);
  };

  const procesarDrawio = (xml) => {
    const root = xml?.mxfile?.diagram?.mxGraphModel?.root?.mxCell || [];
    const nodos = [];
    const edges = [];

    root.forEach((cell) => {
      const attr = cell?._attributes || {};
      const value = attr.value || "";
      const style = attr.style || "";

      if (attr.vertex === "1") {
        nodos.push({
          id: attr.id,
          name: value,
          x: cell.mxGeometry?._attributes?.x || 0,
          y: cell.mxGeometry?._attributes?.y || 0,
        });
      } else if (attr.edge === "1") {
        edges.push({
          source: attr.source,
          target: attr.target,
        });
      }
    });

    setClases(nodos);
    setConexiones(edges);
  };

  // Mantengo tu función ML para StarUML
  const ML = (json) => {
    const clasesDetectadas = [];

    const buscarClases = (obj) => {
      if (obj._type === "UMLClass") {
        clasesDetectadas.push({
          id: obj._id,
          name: obj.name,
          atributos: (obj.attributes || []).map((a) => a.name),
          operaciones: (obj.operations || []).map((o) => o.name),
        });
      }

      if (Array.isArray(obj.ownedElements)) {
        obj.ownedElements.forEach((elem) => buscarClases(elem));
      }
    };

    buscarClases(json);
    setClases(clasesDetectadas);

    const nuevoFormularios = {};
    clasesDetectadas.forEach((clase) => {
      nuevoFormularios[clase.name] = {
        form: {},
        data: [],
        editIndex: null,
      };
    });
    setFormularios(nuevoFormularios);
    setConexiones([]);
  };

  const actualizarFormulario = (clase, cambios) => {
    setFormularios((prev) => ({
      ...prev,
      [clase]: {
        ...prev[clase],
        form: { ...prev[clase].form, ...cambios },
      },
    }));
  };

  const enviarFormulario = (clase) => {
    setFormularios((prev) => {
      const { form, data, editIndex } = prev[clase];
      const nuevaData = [...data];

      if (editIndex !== null) {
        nuevaData[editIndex] = form;
      } else {
        nuevaData.push(form);
      }

      return {
        ...prev,
        [clase]: {
          form: {},
          data: nuevaData,
          editIndex: null,
        },
      };
    });
  };

  const editarElemento = (clase, index) => {
    setFormularios((prev) => ({
      ...prev,
      [clase]: {
        ...prev[clase],
        form: prev[clase].data[index],
        editIndex: index,
      },
    }));
  };

  const eliminarElemento = (clase, index) => {
    setFormularios((prev) => {
      const nuevaData = prev[clase].data.filter((_, i) => i !== index);
      return {
        ...prev,
        [clase]: {
          ...prev[clase],
          data: nuevaData,
        },
      };
    });
  };

  const generarHTMLFormulario = (clase) => {
    const formHTML = `
      <form>
        ${clase.atributos
          .map(
            (attr) => `
              <div>
                <label>${attr}:</label>
                <input type="text" name="${attr}" />
              </div>
            `
          )
          .join("")}
        <button type="submit">${formularios[clase.name]?.editIndex !== null ? "Actualizar" : "Agregar"}</button>
      </form>
    `;
    return formHTML.trim();
  };

  return (
    <div className="p-8 font-sans bg-gray-900 min-h-screen">
      <h1 className="text-4xl font-bold mb-10 text-center text-blue-700">Visor de Diagramas: Draw.io & StarUML</h1>
      
      <div className="flex justify-center mb-12">
        <input
          type="file"
          accept=".drawio,.xml,.mdj"
          onChange={handleFile}
          className="block w-full max-w-sm text-sm text-gray-700 border-2 border-gray-400 rounded-lg cursor-pointer bg-white p-3 shadow"
        />
      </div>
  {/* 🚨 Botón para generar el proyecto Angular */}
  {modo === "staruml" && clases.length > 0 && (
        <div className="flex justify-center mb-12">
          <button
            onClick={() => generarAngularProyecto(clases.map(c => ({ name: c.name, atributos: c.atributos })))}
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-semibold shadow"
          >
            📦 Generar Proyecto Angular
          </button>
        </div>
      )}
      {modo === "drawio" && (
        <div className="space-y-10">
          <div>
            <h2 className="text-3xl font-semibold mb-4 text-gray-800">🧾 Clases encontradas:</h2>
            <ul className="list-disc list-inside bg-white p-4 rounded-lg shadow border border-gray-300">
              {[...new Set(clases.map((c) => c.name).filter(Boolean))].map((nombre, idx) => (
                <li key={idx} className="text-gray-700">📦 <strong>{nombre}</strong></li>
              ))}
            </ul>
          </div>
  
          <div>
            <h2 className="text-3xl font-semibold mb-4 text-gray-800">📌 Nodos detectados:</h2>
            <ul className="space-y-2 bg-white p-4 rounded-lg shadow border border-gray-300">
              {clases.map((nodo) => (
                <li key={nodo.id} className="text-gray-700">
                  🟦 <strong>{nodo.name}</strong> (x: {nodo.x}, y: {nodo.y})
                </li>
              ))}
            </ul>
          </div>
  
          <div>
            <h2 className="text-3xl font-semibold mb-4 text-gray-800">🔗 Conexiones:</h2>
            <ul className="space-y-2 bg-white p-4 rounded-lg shadow border border-gray-300">
              {conexiones.map((con, index) => (
                <li key={index} className="text-gray-700">
                  {con.source} ➝ {con.target}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
  
      {modo === "staruml" && (
        <div className="space-y-14">
          <div>
            <h2 className="text-3xl font-semibold mb-6 text-gray-800">🧾 Clases en StarUML:</h2>
            <ul className="space-y-8">
  {clases.map((clase, idx) => (
    <li key={idx} className="grid grid-cols-2 gap-6 bg-white p-6 rounded-lg shadow-lg border border-gray-300">
      {/* Columna Izquierda: Clases */}
      <div>
        <h3 className="text-2xl font-bold mb-3 text-blue-700">📦 {clase.name}</h3>
        <ul className="space-y-1 text-gray-800">
          {clase.atributos.map((a, i) => (
            <li key={i}>🔸 <span className="font-medium">Atributo:</span> {a}</li>
          ))}
          {clase.operaciones.map((o, i) => (
            <li key={i}>⚙️ <span className="font-medium">Operación:</span> {o}</li>
          ))}
        </ul>
      </div>

      {/* Columna Derecha: Código HTML */}
      <div>
        <h4 className="font-semibold mb-2 text-gray-700">📝 Código HTML del formulario:</h4>
        <textarea
          readOnly
          rows={10}
          className="w-full h-full p-3 border-2 border-gray-400 rounded bg-gray-800 text-green-300 font-mono text-sm shadow resize-none"
          value={generarHTMLFormulario(clase)}
        ></textarea>
      </div>
    </li>
  ))}
</ul>
          </div>
  
          <div>
            <h2 className="text-3xl font-semibold mb-6 text-gray-800">🛠 CRUD dinámico por clase</h2>
            {clases.map((clase, idx) => {
              const formState = formularios[clase.name];
              if (!formState) return null;
  
              return (
                <div key={idx} className="bg-white p-8 rounded-lg shadow-lg border border-gray-300 mb-10">
                  <h3 className="text-2xl font-bold mb-5 text-blue-700">📦 {clase.name}</h3>
  
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      enviarFormulario(clase.name);
                    }}
                    className="space-y-4"
                  >
                    {clase.atributos.map((attr, i) => (
                      <div key={i} className="flex flex-col">
                        <label className="mb-1 font-medium">{attr}:</label>
                        <input
                          type="text"
                          name={attr}
                          value={formState.form[attr] || ""}
                          onChange={(e) => actualizarFormulario(clase.name, { [attr]: e.target.value })}
                          className="border-2 border-gray-400 rounded p-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 text-sm font-semibold shadow"
                    >
                      {formState.editIndex !== null ? "Actualizar" : "Agregar"}
                    </button>
                  </form>
  
                  {formState.data.length > 0 && (
                    <table className="table-auto w-full mt-6 border border-gray-300 text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          {clase.atributos.map((attr, idx) => (
                            <th key={idx} className="border px-4 py-2">{attr}</th>
                          ))}
                          <th className="border px-4 py-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formState.data.map((item, idx) => (
                          <tr key={idx} className="text-center">
                            {clase.atributos.map((attr, i) => (
                              <td key={i} className="border px-4 py-2">{item[attr]}</td>
                            ))}
                            <td className="border px-4 py-2 space-x-2">
                              <button
                                onClick={() => editarElemento(clase.name, idx)}
                                className="bg-yellow-400 px-3 py-1 rounded hover:bg-yellow-500 text-black"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => eliminarElemento(clase.name, idx)}
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DiagramViewer;