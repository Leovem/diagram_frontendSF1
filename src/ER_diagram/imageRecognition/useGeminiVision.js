// src/ai/useGeminiVision.js
import { useState, useMemo } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const useGeminiVision = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const genAI = useMemo(() => (apiKey ? new GoogleGenerativeAI(apiKey) : null), [apiKey]);
  const ensureReady = () => {
    if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY en .env.local");
    if (!genAI) throw new Error("Cliente Gemini no inicializado");
  };

  /**
   * Analiza imagen de diagrama ER y devuelve JSON enriquecido
   * @param {File|Blob} imageFile
   * @param {string} [prompt]
   * @param {string} [model]
   * @returns {Promise<string>} JSON estructurado con entidades y relaciones
   */
  const analyzeImage = async (imageFile, prompt, model = "gemini-2.0-flash-exp") => {
    setLoading(true);
    setError(null);
    try {
      ensureReady();
      const m = genAI.getGenerativeModel({ model });

      const buffer = await imageFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      const mimeType = imageFile.type || "image/png";

      /** 🧠 PROMPT MEJORADO: más preciso y con ejemplos claros */
      const defaultPrompt = `
Eres un experto en análisis de diagramas Entidad-Relación (ER) y modelado de bases de datos.

Analiza cuidadosamente esta imagen de un diagrama ER (puede ser digital o manuscrito).

Devuelve **SOLO un JSON válido** (sin texto adicional) con esta estructura:

{
  "entities": [
    {
      "name": "entity_name",
      "attributes": ["attr1", "attr2", "..."],
      "primaryKeys": ["pk_attr"],
      "isJoinTable": false
    }
  ],
  "relations": [
    {
      "name": "relation_name",
      "from": "EntityA",
      "to": "EntityB",
      "aCard": "1..*",
      "bCard": "1",
      "relationType": "association"
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 **REGLAS CRÍTICAS PARA CLAVES PRIMARIAS (primaryKeys):**

1. **UNA SOLA clave primaria por tabla regular:**
   - Ejemplo: tabla "students" → primaryKeys: ["student_id"]
   - ❌ NO: ["student_id", "group_id"] (group_id es FK, no PK)

2. **Claves primarias compuestas SOLO en tablas intermedias:**
   - Ejemplo: tabla "subject_teacher" → primaryKeys: ["subject_id", "teacher_id", "group_id"]
   - Estas son tablas que relacionan 2 o más entidades

3. **Cómo identificar Foreign Keys (NO son PK):**
   - Atributos que terminan en "_id" y referencian otra tabla
   - Ejemplo: en "students", el campo "group_id" es FK hacia "groups"
   - ✅ Marcar como: primaryKeys: ["student_id"] (solo el ID propio)
   - ❌ NO: primaryKeys: ["student_id", "group_id"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **REGLAS PARA TABLAS INTERMEDIAS (isJoinTable):**

Marca "isJoinTable": true SOLO si cumple TODOS estos criterios:
1. Tiene **múltiples claves primarias** (PK compuesta)
2. Todos los campos de la PK son IDs de otras tablas
3. Puede tener campos adicionales opcionales (fechas, cantidades, etc.)

**Ejemplos correctos:**

✅ TABLA INTERMEDIA:
{
  "name": "marks",
  "attributes": ["student_id", "subject_id", "date", "mark"],
  "primaryKeys": ["student_id", "subject_id"],
  "isJoinTable": true
}

✅ TABLA INTERMEDIA TERNARIA:
{
  "name": "subject_teacher",
  "attributes": ["subject_id", "teacher_id", "group_id"],
  "primaryKeys": ["subject_id", "teacher_id", "group_id"],
  "isJoinTable": true
}

❌ NO ES TABLA INTERMEDIA:
{
  "name": "students",
  "attributes": ["student_id", "first_name", "last_name", "group_id"],
  "primaryKeys": ["student_id"],
  "isJoinTable": false
}
→ group_id es FK, NO parte de la PK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 **REGLAS PARA CARDINALIDADES:**

Las cardinalidades se leen desde la entidad hacia la relación:

**Formato:**
- "aCard": cardinalidad del lado "from" (EntityA)
- "bCard": cardinalidad del lado "to" (EntityB)

**Valores válidos:**
- "1" = exactamente uno
- "0..1" = cero o uno (opcional)
- "1..*" = uno o muchos
- "0..*" = cero o muchos

**Ejemplos correctos:**

✅ Un estudiante tiene muchas notas:
{
  "from": "students",
  "to": "marks",
  "aCard": "1",
  "bCard": "1..*"
}
→ Interpretación: 1 estudiante → muchas notas

✅ Un grupo tiene muchos estudiantes:
{
  "from": "groups",
  "to": "students",
  "aCard": "1",
  "bCard": "1..*"
}
→ Interpretación: 1 grupo → muchos estudiantes

✅ Relación muchos a muchos (con tabla intermedia):
{
  "from": "students",
  "to": "subjects",
  "aCard": "0..*",
  "bCard": "0..*"
}
→ Se debe crear una tabla intermedia "student_subject"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **TIPOS DE RELACIONES (relationType):**

- **"association"**: relación normal (línea simple)
  - Ejemplo: students → marks
  
- **"aggregation"**: relación "tiene-un" débil (diamante vacío)
  - Ejemplo: Department ◇→ Employee
  - El empleado puede existir sin departamento
  
- **"composition"**: relación "tiene-un" fuerte (diamante relleno)
  - Ejemplo: Order ◆→ OrderItem
  - El ítem no existe sin la orden
  
- **"inheritance"**: relación de herencia (triángulo)
  - Ejemplo: Vehicle △→ Car
  - Car es un tipo de Vehicle

Si no estás seguro, usa "association".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **VALIDACIONES FINALES:**

Antes de devolver el JSON, verifica:

1. ✅ Cada entidad tiene exactamente un campo en "primaryKeys" (excepto tablas intermedias)
2. ✅ Las tablas intermedias tienen 2+ campos en "primaryKeys"
3. ✅ Todos los nombres usan snake_case (ej: "student_id", no "studentId")
4. ✅ Las relaciones usan nombres de entidades exactos (case-sensitive)
5. ✅ Las cardinalidades son una de: "1", "0..1", "1..*", "0..*"
6. ✅ El JSON es válido (sin comas finales, comillas correctas)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**RECUERDA:** Devuelve SOLO el JSON, sin explicaciones adicionales.
`;

      const result = await m.generateContent([
        { inlineData: { mimeType, data: base64 } },
        { text: prompt || defaultPrompt },
      ]);

      // Limpieza de respuesta
      let text = result.response.text()
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      // Validar que sea JSON válido
      try {
        const parsed = JSON.parse(text);
        console.log("✅ JSON válido recibido de Gemini");
        console.log("📊 Respuesta completa de la IA:", parsed);
        return text;
      } catch (parseError) {
        console.error("❌ JSON inválido de Gemini:", text);
        throw new Error("La IA no devolvió un JSON válido: " + parseError.message);
      }

    } catch (e) {
      setError(e.message || "Error en Gemini Vision");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { analyzeImage, loading, error };
};