import { createShapeId } from "tldraw"

/**
 * Convierte el JSON generado por Gemini Vision a shapes de Tldraw.
 * Admite propiedades extendidas como primaryKeys, isJoinTable, cardinalidades y relationType.
 *
 * @param {object} data - JSON de IA (entities + relations)
 * @param {object} editor - instancia del editor Tldraw
 */
export function convertToShapes(data, editor) {
  if (!data || !editor) return

  const shapes = []
  const entityMap = {}

  const cols = Math.ceil(Math.sqrt(data.entities.length))
  const spacingX = 380
  const spacingY = 260

  // === Crear entidades ===
  data.entities.forEach((entity, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols

    // ✅ Normalizar primaryKeys a minúsculas y trim
    const primaryKeys = (entity.primaryKeys || []).map((pk) => 
      pk.toLowerCase().trim().replace(/\s+/g, "_")
    )

    const attrs = (entity.attributes || []).map((attr) => {
      const name = typeof attr === 'string' 
        ? attr.toLowerCase().trim().replace(/\s+/g, "_")
        : attr.name?.toLowerCase().trim().replace(/\s+/g, "_") || "unknown"
      
      // ✅ CORRECCIÓN: Solo marcar como PK si está en primaryKeys
      // NO asumir que todo lo que termina en _id es PK (puede ser FK)
      const isPK = primaryKeys.includes(name)
      
      // ✅ Inferir tipo de dato basado en el nombre del atributo
      let type = "string"
      
      if (name.endsWith("_id") || name === "id") {
        type = "uuid"
      } else if (name.includes("date") || name.includes("fecha") || name.includes("timestamp")) {
        type = "date"
      } else if (name.includes("time") || name.includes("hora")) {
        type = "time"
      } else if (
        name.includes("price") || name.includes("precio") || 
        name.includes("amount") || name.includes("monto") ||
        name.includes("total") || name.includes("cost") || name.includes("costo")
      ) {
        type = "decimal"
      } else if (
        name.includes("quantity") || name.includes("cantidad") || 
        name.includes("count") || name.includes("numero") ||
        name.includes("age") || name.includes("edad") ||
        name === "mark" || name === "nota" || name === "score" ||
        name.includes("year") || name.includes("año")
      ) {
        type = "integer"
      } else if (
        name.includes("active") || name.includes("activo") ||
        name.includes("enabled") || name.includes("habilitado") ||
        name.includes("is_") || name.includes("has_")
      ) {
        type = "boolean"
      } else if (name.includes("email") || name.includes("correo")) {
        type = "string"
      } else if (
        name.includes("description") || name.includes("descripcion") ||
        name.includes("content") || name.includes("contenido") ||
        name.includes("text") || name.includes("texto") ||
        name.includes("comment") || name.includes("comentario")
      ) {
        type = "text"
      }
      
      return {
        id: createShapeId(),
        name,
        type,
        pk: isPK,
        unique: false,
        nullable: !isPK, // ✅ Las PKs no son nullable
      }
    })

    // ✅ Detectar tabla intermedia correctamente
    const isJoinTable = entity.isJoinTable === true || (
      primaryKeys.length > 1 && 
      primaryKeys.every(pk => attrs.some(a => a.name === pk && a.name.endsWith("_id")))
    )

    const shape = {
      id: createShapeId(),
      type: "entity-table",
      x: col * spacingX + 100,
      y: row * spacingY + 100,
      props: {
        w: 300,
        h: 80 + attrs.length * 24,
        name: entity.name || "Entidad",
        attrs,
        isJoinTable,
      },
    }

    shapes.push(shape)
    entityMap[entity.name] = shape.id
  })

  // === Crear relaciones ===
  if (data.relations && Array.isArray(data.relations)) {
    data.relations.forEach((rel) => {
      const fromId = entityMap[rel.from]
      const toId = entityMap[rel.to]
      if (!fromId || !toId) {
        console.warn(`⚠️ Relación ignorada: no se encontró "${rel.from}" o "${rel.to}"`)
        return
      }

      // ✅ CORRECCIÓN CRÍTICA: Normalizar dirección de relaciones
      // En una relación 1:*, el lado "1" debe ser "b" y el lado "*" debe ser "a"
      // Esto es porque las FK van en el lado "many" apuntando al lado "one"
      
      let aEntityId = fromId
      let bEntityId = toId
      let aCard = rel.aCard || "1"
      let bCard = rel.bCard || "1..*"
      
      // Detectar si es "many"
      const aIsMany = aCard.includes('*') || aCard.toLowerCase().includes('n') || aCard.toLowerCase().includes('m')
      const bIsMany = bCard.includes('*') || bCard.toLowerCase().includes('n') || bCard.toLowerCase().includes('m')
      
      // ✅ Invertir si el lado "from" es "many" y el "to" es "1"
      // Queremos que "a" sea el lado "many" y "b" sea el lado "1"
      if (!aIsMany && bIsMany) {
        // Caso: from=1, to=many → Invertir para que a=many, b=1
        [aEntityId, bEntityId] = [bEntityId, aEntityId];
        [aCard, bCard] = [bCard, aCard]
      }

      const relationShape = {
        id: createShapeId(),
        type: "relation-edge",
        props: {
          aEntityId,
          bEntityId,
          aCard,
          bCard,
          aFree: { x: 0, y: 0 },
          bFree: { x: 0, y: 0 },
          waypoints: [],
          orthogonal: true,
          identifying: false,
          name: rel.name || "",
          relationType: rel.relationType || "association",
        },
      }

      shapes.push(relationShape)
    })
  }

  console.log("🧩 Shapes generados por convertToShapes():", JSON.stringify(shapes, null, 2))
  
  // === Insertar shapes en el editor ===
  editor.createShapes(shapes)

  // === Seleccionar y enfocar ===
  const createdIds = shapes.map((s) => s.id)
  editor.select(...createdIds)

  try {
    editor.zoomToSelection({ animation: { duration: 500 } })
  } catch (err) {
    console.warn("Zoom automático no disponible:", err)
  }

  return shapes
}

/**
 * Valida el JSON generado por la IA antes de convertirlo
 * @param {object} data - JSON de la IA
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export function validateAIJson(data) {
  const errors = []
  
  if (!data || typeof data !== 'object') {
    errors.push("JSON inválido o vacío")
    return { valid: false, errors }
  }
  
  if (!Array.isArray(data.entities) || data.entities.length === 0) {
    errors.push("No se encontraron entidades")
    return { valid: false, errors }
  }
  
  // Validar cada entidad
  data.entities.forEach((entity, i) => {
    if (!entity.name) {
      errors.push(`Entidad #${i}: falta el nombre`)
    }
    
    if (!Array.isArray(entity.attributes) || entity.attributes.length === 0) {
      errors.push(`Entidad "${entity.name}": sin atributos`)
    }
    
    if (!Array.isArray(entity.primaryKeys) || entity.primaryKeys.length === 0) {
      errors.push(`Entidad "${entity.name}": sin clave primaria definida`)
    }
    
    // Verificar que las PKs existan en attributes
    if (entity.primaryKeys && entity.attributes) {
      const attrNames = entity.attributes.map(a => 
        (typeof a === 'string' ? a : a.name)?.toLowerCase().trim()
      )
      
      entity.primaryKeys.forEach(pk => {
        const pkNorm = pk.toLowerCase().trim()
        if (!attrNames.includes(pkNorm)) {
          errors.push(`Entidad "${entity.name}": PK "${pk}" no existe en attributes`)
        }
      })
    }
  })
  
  // Validar relaciones
  if (data.relations && Array.isArray(data.relations)) {
    const entityNames = data.entities.map(e => e.name)
    
    data.relations.forEach((rel, i) => {
      if (!rel.from || !rel.to) {
        errors.push(`Relación #${i}: falta "from" o "to"`)
      } else {
        if (!entityNames.includes(rel.from)) {
          errors.push(`Relación #${i}: entidad origen "${rel.from}" no existe`)
        }
        if (!entityNames.includes(rel.to)) {
          errors.push(`Relación #${i}: entidad destino "${rel.to}" no existe`)
        }
      }
    })
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Corrige automáticamente problemas comunes en el JSON de la IA
 * @param {object} data - JSON original
 * @returns {object} - JSON corregido
 */
export function fixAIJsonIssues(data) {
  const fixed = JSON.parse(JSON.stringify(data)) // Deep clone
  
  fixed.entities.forEach(entity => {
    // ✅ 1. Normalizar nombres de entidades y atributos (snake_case) PRIMERO
    entity.name = entity.name
      .toLowerCase()
      .replace(/\s+/g, '_')     // espacios → _
      .replace(/\//g, '_')      // barras → _
      .replace(/-/g, '_')       // guiones → _
      .replace(/[^\w]/g, '_')   // otros caracteres → _
      .replace(/_+/g, '_')      // múltiples _ → uno solo
    
    entity.attributes = entity.attributes.map(attr => {
      const name = typeof attr === 'string' ? attr : attr.name
      return name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\//g, '_')
        .replace(/-/g, '_')
        .replace(/[^\w]/g, '_')
        .replace(/_+/g, '_')
    })
    
    entity.primaryKeys = entity.primaryKeys.map(pk =>
      pk.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\//g, '_')
        .replace(/-/g, '_')
        .replace(/[^\w]/g, '_')
        .replace(/_+/g, '_')
    )
  })
  
  // ✅ 2. Detectar tablas intermedias con atributos propios (DESPUÉS de normalizar)
  fixed.entities.forEach(entity => {
    const attrNames = entity.attributes
    
    // Contar cuántos atributos terminan en _id
    const idFields = attrNames.filter(name => name.endsWith('_id'))
    
    // Detectar si tiene exactamente 2 FKs + atributos adicionales
    const hasExactlyTwoFKs = idFields.length === 2
    const hasAdditionalAttrs = attrNames.length > idFields.length
    
    console.log(`🔍 Analizando "${entity.name}":`, {
      totalAttrs: attrNames.length,
      idFields: idFields.length,
      ids: idFields,
      hasExactlyTwoFKs,
      hasAdditionalAttrs,
      currentIsJoinTable: entity.isJoinTable
    })
    
    // Si tiene 2 FKs + campos adicionales, es tabla intermedia
    if (hasExactlyTwoFKs && hasAdditionalAttrs && !entity.isJoinTable) {
      console.warn(`✅ "${entity.name}": Detectada como tabla intermedia (2 FKs + atributos propios)`)
      entity.isJoinTable = true
      
      // Si tiene ID surrogate único, mantenerlo
      // Si no, usar PK compuesta de las 2 FKs
      const pkIsIdField = entity.primaryKeys.length === 1 && idFields.includes(entity.primaryKeys[0])
      const pkIsSurrogate = entity.primaryKeys.length === 1 && !idFields.includes(entity.primaryKeys[0])
      
      if (pkIsSurrogate) {
        // Tiene ID surrogate (ej: mark_id), mantenerlo pero marcar como join table
        console.log(`  → Manteniendo PK surrogate: ${entity.primaryKeys[0]}`)
      } else if (pkIsIdField) {
        // Solo tiene 1 FK como PK, agregar la otra para PK compuesta
        entity.primaryKeys = idFields
        console.log(`  → Convirtiendo a PK compuesta: [${idFields.join(', ')}]`)
      }
    }
    
    // ✅ 3. Detectar tabla intermedia ternaria o mayor
    if (idFields.length >= 3 && entity.primaryKeys.length >= 3) {
      entity.isJoinTable = true
      console.log(`✅ "${entity.name}": Tabla intermedia ternaria detectada`)
    }
    
    // ✅ 4. Corregir: remover atributos duplicados en primaryKeys que no deberían ser PK
    if (entity.primaryKeys && entity.attributes) {
      // Detectar FKs solitarias (no son parte de tabla intermedia)
      const likelyFKs = attrNames.filter(name => 
        name.endsWith('_id') && 
        !entity.primaryKeys.includes(name) &&
        entity.attributes.length > 1
      )
      
      // Si hay un solo PK explícito + varios _id, los demás son probablemente FKs
      if (entity.primaryKeys.length === 1 && likelyFKs.length > 0 && !entity.isJoinTable) {
        // Mantener solo la PK declarada
        // No hacer nada, está correcto
      } else if (entity.primaryKeys.length > 1 && !entity.isJoinTable) {
        // Caso sospechoso: múltiples PKs en tabla no-intermedia
        // Mantener solo el primer ID como PK
        const mainPK = entity.primaryKeys.find(pk => 
          pk.toLowerCase().replace(/\s+/g, '_').endsWith('_id')
        ) || entity.primaryKeys[0]
        
        console.warn(`⚠️ "${entity.name}": múltiples PKs en tabla normal, usando solo "${mainPK}"`)
        entity.primaryKeys = [mainPK]
      }
    }
    
    // ✅ 5. Asegurar que primaryKeys exista
    if (!entity.primaryKeys || entity.primaryKeys.length === 0) {
      // Intentar inferir PK
      const idAttr = entity.attributes.find(a => {
        const name = (typeof a === 'string' ? a : a.name)?.toLowerCase()
        return name === 'id' || name === `${entity.name.toLowerCase()}_id`
      })
      
      if (idAttr) {
        entity.primaryKeys = [typeof idAttr === 'string' ? idAttr : idAttr.name]
        console.warn(`⚠️ "${entity.name}": PK inferida como "${entity.primaryKeys[0]}"`)
      } else {
        // Crear PK por defecto
        entity.primaryKeys = ['id']
        entity.attributes.unshift('id')
        console.warn(`⚠️ "${entity.name}": se creó PK por defecto "id"`)
      }
    }
  })
  
  // ✅ 6. Normalizar nombres en relaciones
  if (fixed.relations && Array.isArray(fixed.relations)) {
    fixed.relations.forEach(rel => {
      // Buscar la entidad original para obtener el nombre normalizado
      const fromEntity = fixed.entities.find(e => 
        e.name.toLowerCase().replace(/[\s\/-]/g, '_') === 
        rel.from.toLowerCase().replace(/[\s\/-]/g, '_')
      )
      const toEntity = fixed.entities.find(e => 
        e.name.toLowerCase().replace(/[\s\/-]/g, '_') === 
        rel.to.toLowerCase().replace(/[\s\/-]/g, '_')
      )
      
      if (fromEntity) rel.from = fromEntity.name
      if (toEntity) rel.to = toEntity.name
    })
  }
  
  return fixed
}