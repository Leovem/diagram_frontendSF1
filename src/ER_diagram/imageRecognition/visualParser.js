// src/ER_diagram/imageRecognition/visualParser.js
export async function parseVisualElements(file, onLog) {
  onLog?.("📊 Analizando formas con OpenCV...");
  await ensureCV();

  const img = await fileToMat(file);
  const gray = new cv.Mat();
  cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY, 0);

  const bin = new cv.Mat();
  cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const boxes = [];
  for (let i = 0; i < contours.size(); i++) {
    const rect = cv.boundingRect(contours.get(i));
    if (rect.width > 30 && rect.height > 20) boxes.push(rect);
  }

  gray.delete(); bin.delete(); contours.delete(); hierarchy.delete(); img.delete();
  onLog?.(`📦 Detectadas ${boxes.length} cajas.`);
  return boxes;
}

// Helpers
async function ensureCV() {
  if (window.cv && window.cv.Mat) return;
  await new Promise((res, rej) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.onload = res;
    script.onerror = rej;
    document.body.appendChild(script);
  });
}

function fileToMat(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const mat = cv.imread(canvas);
      resolve(mat);
    };
    img.src = URL.createObjectURL(file);
  });
}
