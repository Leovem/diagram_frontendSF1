

import type { ERGraph } from '../ER_diagram/erParser'
import { generateSpringProject } from './transforms/to-spring'

export type Cardinality = '1' | '0..1' | '1..*' | '0..*'

export interface Attribute {
  id: string
  name: string
  type: 'uuid' | 'string' | 'text' | 'int' | 'float' | 'decimal' | 'bool' | 'date' | 'datetime'
  isPrimary?: boolean
  isUnique?: boolean
  isNullable?: boolean
  defaultValue?: string | number | boolean | null
  refEntityId?: string
}

export interface Entity {
  id: string
  name: string
  attributes: Attribute[]
  isJoinTable?: boolean
}

export interface RelationEnd {
  entityId: string
  roleName?: string
  cardinality: Cardinality
}

export interface Relation {
  id: string
  name: string
  ends: [RelationEnd, RelationEnd]
  attributes?: Attribute[]
}

export interface ERGraphLocal {
  entities: Entity[]
  relations: Relation[]
  meta?: Record<string, unknown>
}

// =======================
// Helpers
// =======================
function pgType(t: Attribute['type']): string {
  const type = t.toLowerCase?.() ?? t
  switch (type) {
    case 'uuid': return 'uuid'
    case 'string': return 'varchar(255)'
    case 'text': return 'text'
    case 'int': return 'integer'
    case 'float': return 'double precision'
    case 'decimal': return 'numeric(12,2)'
    case 'bool': return 'boolean'
    case 'date': return 'date'
    case 'datetime': return 'timestamp'
    default: return 'varchar(255)'
  }
}

function findPkAttr(e: Entity): Attribute {
  const pk = e.attributes.find(a => a.isPrimary)
  if (!pk) throw new Error(`Entidad "${e.name}" no tiene atributo marcado como primary.`)
  return pk
}

function isMany(card: Cardinality): boolean {
  return card.includes('*')
}

function isOptional(card: Cardinality): boolean {
  return card.startsWith('0')
}

// =======================
// Generador SQL robusto
// =======================
export function toPostgres(graph: ERGraphLocal): string {
  console.log("====================================")
  console.log("🧠 INICIO DE GENERACIÓN SQL (toPostgres)")
  console.log("====================================")
  console.log("📦 ERGraph recibido:")
  console.log(JSON.stringify(graph, null, 2))

  // === Normalización completa de entidades ===
  const entities: Entity[] = graph.entities.map(e => ({
    id: e.id,
    name: e.name.trim(),
    isJoinTable: e.isJoinTable ?? false, // ✅ conservar flag joinTable
    attributes: (e.attributes || []).map(a => ({
      id: a.id,
      name: a.name.trim(),
      type: a.type || "string",
      isPrimary: !!a.isPrimary,
      isUnique: !!a.isUnique,
      isNullable: a.isNullable ?? true,
      defaultValue: a.defaultValue ?? null,
      refEntityId: a.refEntityId ?? undefined,
    })),
  }))

  const entityById = new Map(entities.map(e => [e.id, e]))
  const tables: string[] = []
  const dependencies = new Map<string, Set<string>>()

  for (const e of entities) dependencies.set(e.name, new Set())

  // === Procesamiento de relaciones ===
  console.log("\n🔗 Procesando relaciones...")
  for (const rel of graph.relations) {
    let [aEnd, bEnd] = rel.ends

    if (!aEnd || !bEnd) {
      console.warn(`⚠️ Relación inválida sin extremos definidos: ${rel.name}`)
      continue
    }

    // Forzar consistencia: el lado MANY siempre debe ser bEnd
    if (isMany(aEnd.cardinality) && !isMany(bEnd.cardinality)) {
      [aEnd, bEnd] = [bEnd, aEnd]
    }

    const aEnt = entityById.get(aEnd.entityId)
    const bEnt = entityById.get(bEnd.entityId)
    if (!aEnt || !bEnt) {
      console.warn(`⚠️ Relación "${rel.name}" ignora entidades faltantes:`, {
        a: aEnd.entityId,
        b: bEnd.entityId,
      })
      continue
    }

    const aPK = findPkAttr(aEnt)
    const bPK = findPkAttr(bEnt)
    const isNN = isMany(aEnd.cardinality) && isMany(bEnd.cardinality)

    // === CASO N:N ===
    if (isNN) {
      const tableName = rel.name || `Detalle_${aEnt.name}_${bEnt.name}`
      const aCol = `${aEnt.name}_${aPK.name}`
      const bCol = `${bEnt.name}_${bPK.name}`
      const relAttrs = rel.attributes ?? []

      console.log(`🧩 Relación N:N detectada: ${aEnt.name} ⇄ ${bEnt.name} → ${tableName}`)

      const cols: string[] = [
        `  "${aCol}" ${pgType(aPK.type)} NOT NULL`,
        `  "${bCol}" ${pgType(bPK.type)} NOT NULL`,
      ]

      for (const attr of relAttrs) {
        const nullable = attr.isNullable ? "" : " NOT NULL"
        const unique = attr.isUnique ? " UNIQUE" : ""
        const def =
          attr.defaultValue !== undefined && attr.defaultValue !== null
            ? ` DEFAULT ${typeof attr.defaultValue === "string" ? `'${attr.defaultValue}'` : attr.defaultValue}`
            : ""
        cols.push(`  "${attr.name}" ${pgType(attr.type)}${nullable}${unique}${def}`)
      }

      cols.push(`  PRIMARY KEY ("${aCol}", "${bCol}")`)
      cols.push(`  FOREIGN KEY ("${aCol}") REFERENCES "${aEnt.name}"("${aPK.name}") ON DELETE CASCADE`)
      cols.push(`  FOREIGN KEY ("${bCol}") REFERENCES "${bEnt.name}"("${bPK.name}") ON DELETE CASCADE`)

      tables.push(`CREATE TABLE "${tableName}" (\n${cols.join(",\n")}\n);`)
      continue
    }

    // === CASO 1:N o 1:1 ===
    const oneEnd = isMany(aEnd.cardinality) ? bEnd : aEnd
    const manyEnd = isMany(aEnd.cardinality) ? aEnd : bEnd
    const oneEnt = entityById.get(oneEnd.entityId)!
    const manyEnt = entityById.get(manyEnd.entityId)!
    const onePK = findPkAttr(oneEnt)

    if (manyEnt.isJoinTable) continue

    //  Detección de campos existentes
    const fkName = `${oneEnt.name}_${onePK.name}`
    const alreadyExists = manyEnt.attributes.some(a =>
      a.name === fkName ||
      a.name === onePK.name ||
      a.name.toLowerCase() === `${oneEnt.name.toLowerCase()}_id` ||
      a.name.toLowerCase() === `${oneEnt.name.toLowerCase().slice(0, -1)}_id`
    )

    // Si existe, asigna refEntityId
    if (alreadyExists) {
      const existingAttr = manyEnt.attributes.find(a =>
        a.name === fkName ||
        a.name.toLowerCase() === `${oneEnt.name.toLowerCase()}_id` ||
        a.name.toLowerCase() === `${oneEnt.name.toLowerCase().slice(0, -1)}_id`
      )
      if (existingAttr && !existingAttr.refEntityId) {
        existingAttr.refEntityId = oneEnt.id
        dependencies.get(manyEnt.name)?.add(oneEnt.name)
      }
    } else {
      manyEnt.attributes.push({
        id: `fk_${manyEnt.name}_${oneEnt.name}`,
        name: fkName,
        type: onePK.type,
        isNullable: isOptional(manyEnd.cardinality),
        refEntityId: oneEnt.id,
      })
      dependencies.get(manyEnt.name)?.add(oneEnt.name)
    }
  }

  // === Resolver orden de dependencias (topológico) ===
  const sorted: Entity[] = []
  const visited = new Set<string>()

  function visit(name: string) {
    if (visited.has(name)) return
    visited.add(name)
    dependencies.get(name)?.forEach(visit)
    const ent = entities.find(e => e.name === name)
    if (ent) sorted.push(ent)
  }

  for (const e of entities) visit(e.name)

  console.log("\n📊 Orden de creación de tablas:", sorted.map(e => e.name).join(" → "))

  // === Generar SQL final ===
  for (const e of sorted) {
    console.log(`\n🔍 ${e.name} → isJoinTable =`, e.isJoinTable)

    const cols: string[] = []
    for (const a of e.attributes) {
      const nullable = a.isNullable ? "" : " NOT NULL"
      const unique = a.isUnique ? " UNIQUE" : ""
      const def =
        a.defaultValue !== undefined && a.defaultValue !== null
          ? ` DEFAULT ${typeof a.defaultValue === "string" ? `'${a.defaultValue}'` : a.defaultValue}`
          : ""
      cols.push(`  "${a.name}" ${pgType(a.type)}${nullable}${unique}${def}`)
    }

    const pkCols = e.attributes.filter(a => a.isPrimary).map(a => `"${a.name}"`)
    if (pkCols.length) cols.push(`  PRIMARY KEY (${pkCols.join(", ")})`)

    if (e.isJoinTable) {
      for (const attr of e.attributes.filter(a =>
        a.name.toLowerCase().includes("_id") || a.name.toLowerCase().startsWith("id_")
      )) {
        const base = attr.name
          .toLowerCase()
          .replace(/^id_/, "")
          .replace(/_id$/, "")
          .trim()

        const refEnt =
          entities.find(x => x.name.toLowerCase() === base) ||
          entities.find(x => x.name.toLowerCase() === base + "s") ||
          entities.find(x => x.name.toLowerCase() === base.slice(0, -1))

        if (refEnt) {
          const refPk = findPkAttr(refEnt)
          cols.push(`  FOREIGN KEY ("${attr.name}") REFERENCES "${refEnt.name}"("${refPk.name}") ON DELETE CASCADE`)
        } else {
          console.warn(`⚠️ FK no resuelta en joinTable "${e.name}" → ${attr.name}`)
        }
      }
    } else {
      const fkAttrs = e.attributes.filter(a => a.refEntityId)
      for (const fk of fkAttrs) {
        const refEnt = fk.refEntityId ? entities.find(x => x.id === fk.refEntityId) : undefined
        const refPk = refEnt ? findPkAttr(refEnt) : null
        if (refEnt && refPk) {
          cols.push(`  FOREIGN KEY ("${fk.name}") REFERENCES "${refEnt.name}"("${refPk.name}") ON DELETE CASCADE`)
        } else {
          console.warn(`⚠️ FK sin entidad de referencia: ${fk.name} en ${e.name}`)
        }
      }
    }

    tables.push(`CREATE TABLE "${e.name}" (\n${cols.join(",\n")}\n);`)
  }

  console.log("\n✅ Generación SQL completada.\n")
  return tables.join("\n\n")
}


// =======================
// Spring Boot Generator
// =======================
export interface SpringGenOptions {
  packageBase?: string
  projectName?: string
}

export async function generateAll(graph: ERGraph, opts?: SpringGenOptions) {
  const sql = toPostgres(graph as any)
  const zipBlob = await generateSpringProject(graph, {
    packageBase: opts?.packageBase ?? 'diagram.backend',
    projectName: opts?.projectName ?? 'backend',
  })
  return { sql, zipBlob }
}
