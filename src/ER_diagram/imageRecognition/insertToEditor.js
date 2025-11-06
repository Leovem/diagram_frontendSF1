// src/ER_diagram/imageRecognition/insertToEditor.js
export function insertShapesToEditor(editor, shapes) {
  if (!editor) throw new Error("Editor Tldraw no inicializado");
  shapes.forEach((s) => {
    editor.createShape({
      id: s.id,
      type: s.type || "geo",
      x: s.x,
      y: s.y,
      props: s.props || { text: "" },
    });
  });
}
