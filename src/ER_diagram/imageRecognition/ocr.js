// src/ER_diagram/imageRecognition/ocr.js
import Tesseract from "tesseract.js";

export async function runOCR(file, onLog) {
  onLog?.("🧩 Ejecutando OCR con Tesseract...");
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m) => onLog?.(`OCR: ${m.status || m.progress}`),
  });

  const words = data.words.map((w) => ({
    text: w.text.trim(),
    bbox: {
      x: w.bbox.x0,
      y: w.bbox.y0,
      w: w.bbox.x1 - w.bbox.x0,
      h: w.bbox.y1 - w.bbox.y0,
    },
  }));

  onLog?.(`📄 OCR detectó ${words.length} palabras.`);
  return words;
}
