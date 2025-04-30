import { useEffect, useRef, useState } from 'react';

export default function OcradReader() {
  const canvasRef = useRef(null);
  const [text, setText] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/ocrad.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      setTimeout(() => {
        const detectedText = window.OCRAD(canvas);
        setText(detectedText);
        generateFormHTML(detectedText);
      }, 100);
    };
    img.src = URL.createObjectURL(file);
  };

  const generateFormHTML = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let html = `<form #form="ngForm">\n`;

    lines.forEach(line => {
      const lower = line.toLowerCase();

      if (lower.includes('nombre')) {
        html += `  <label for="nombre">Nombre</label>\n  <input type="text" id="nombre" name="nombre" [(ngModel)]="nombre" /><br/>\n\n`;
      } else if (lower.includes('correo') || lower.includes('email')) {
        html += `  <label for="correo">Correo</label>\n  <input type="email" id="correo" name="correo" [(ngModel)]="correo" /><br/>\n\n`;
      } else if (lower.includes('contraseña') || lower.includes('password')) {
        html += `  <label for="password">Contraseña</label>\n  <input type="password" id="password" name="password" [(ngModel)]="password" /><br/>\n\n`;
      } else if (lower.includes('país') || lower.includes('género')) {
        html += `  <label for="pais">${capitalize(line)}</label>\n  <select id="pais" name="pais" [(ngModel)]="pais">\n    <option>Opción 1</option>\n    <option>Opción 2</option>\n  </select><br/>\n\n`;
      } else if (
        lower.includes('enviar') ||
        lower.includes('guardar') ||
        lower.includes('registrar') ||
        lower.includes('aceptar')
      ) {
        html += `  <button type="submit">${capitalize(line)}</button>\n\n`;
      } else {
        html += `  <p>${capitalize(line)}</p>\n`;
      }
    });

    html += '</form>';
    setHtmlCode(html);
    setHtmlPreview(html);
  };

  const capitalize = (line) =>
    line.charAt(0).toUpperCase() + line.slice(1);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlCode);
    alert('HTML copiado al portapapeles');
  };

  const handleDownloadAngular = () => {
    // Archivo HTML (template)
    const blobHtml = new Blob([htmlCode], { type: 'text/html' });
    const linkHtml = document.createElement('a');
    linkHtml.href = URL.createObjectURL(blobHtml);
    linkHtml.download = 'formulario.component.html';
    linkHtml.click();
  
    // Archivo TS (componente)
    const tsCode = `
  import { Component } from '@angular/core';
  
  @Component({
    selector: 'app-formulario',
    templateUrl: './formulario.component.html',
    styleUrls: ['./formulario.component.css'],
  })
  export class FormularioComponent {
    nombre: string = '';
    correo: string = '';
    password: string = '';
    pais: string = '';
  }
    `.trim();
  
    const blobTs = new Blob([tsCode], { type: 'text/typescript' });
    const linkTs = document.createElement('a');
    linkTs.href = URL.createObjectURL(blobTs);
    linkTs.download = 'formulario.component.ts';
    linkTs.click();
  
    // Archivo CSS (estilos)
    const cssCode = `
  /* styles.css */
  
  /* Formulario */
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  /* Etiquetas de formulario */
  form label {
    font-weight: bold;
    color: #333;
  }
  
  /* Inputs y selects */
  form input,
  form select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    color: #333;
  }
  
  form button {
    background-color: #007bff;
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  form button:hover {
    background-color: #0056b3;
  }
  
  /* Estilo de párrafos */
  form p {
    color: #555;
  }
    `.trim();
  
    const blobCss = new Blob([cssCode], { type: 'text/css' });
    const linkCss = document.createElement('a');
    linkCss.href = URL.createObjectURL(blobCss);
    linkCss.download = 'formulario.component.css';
    linkCss.click();
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold">Imagen a HTML</h2>

        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="block w-full text-white file:bg-blue-600 file:text-white file:rounded file:px-4 file:py-2 file:mr-4 file:cursor-pointer"
        />

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="flex flex-col md:flex-row gap-4">
          {/* Texto detectado */}
          <div className="md:w-1/2">
            <h3 className="text-xl font-semibold mt-4">Elementos Detectados:</h3>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto whitespace-pre-wrap h-full">{text}</pre>
          </div>

          {/* Código HTML generado */}
          <div className="md:w-1/2">
            <h3 className="text-xl font-semibold">Código HTML generado:</h3>
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              rows={15}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">
            Copiar HTML
          </button>
          <button onClick={handleDownloadAngular} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">
            Descargar HTML
          </button>
          <button onClick={() => setHtmlPreview(htmlCode)} className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded text-white">
            Aplicar cambios
          </button>
          <button onClick={() => setShowPreview(!showPreview)} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-white">
            {showPreview ? 'Ocultar vista previa' : 'Mostrar vista previa'}
          </button>
        </div>

        {showPreview && (
          <>
            <h3 className="mt-6 font-semibold">Vista previa del formulario:</h3>
            <div className="mt-2 bg-gray-50 p-6 rounded-xl shadow-md border border-gray-200">
              <div
                className="
                  text-gray-800
                  [&>form]:flex [&>form]:flex-col [&>form]:gap-4
                  [&>form>label]:font-semibold [&>form>label]:text-gray-800
                  [&>form>input]:p-2 [&>form>input]:rounded-md [&>form>input]:border [&>form>input]:border-gray-300 [&>form>input]:text-gray-800
                  [&>form>select]:p-2 [&>form>select]:rounded-md [&>form>select]:border [&>form>select]:border-gray-300 [&>form>select]:text-gray-800
                  [&>form>button]:bg-blue-600 [&>form>button]:text-white [&>form>button]:p-2 [&>form>button]:rounded-md [&>form>button]:hover:bg-blue-700
                  [&>form>p]:text-gray-800
                "
                dangerouslySetInnerHTML={{ __html: htmlPreview }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}