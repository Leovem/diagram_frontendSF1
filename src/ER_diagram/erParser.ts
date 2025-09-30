// src/ER_diagram/erParser.ts
import type { Editor } from 'tldraw';
import type { TLShape, TLShapeId } from '@tldraw/editor';

/* =======================
   Tipos de dominio (ER)
======================= */

export type Cardinality = '1' | '0..1' | '1..*' | '0..*';

export interface Attribute {
  id: string;
  name: string;
  type: 'uuid' | 'string' | 'text' | 'int' | 'float' | 'decimal' | 'bool' | 'date' | 'datetime';
  isPrimary?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface Entity {
  id: string;             // ID propio del modelo ER
  name: string;
  attributes: Attribute[];
  uniques?: string[];
  indexes?: string[];
  _tlShapeId?: TLShapeId; // trazabilidad con Tldraw
}

export interface RelationEnd {
  entityId: string;       // referencia a Entity.id
  roleName?: string;
  cardinality: Cardinality;
}

export interface Relation {
  id: string;
  name: string;
  ends: [RelationEnd, RelationEnd];
  attributes?: Attribute[];
  _aTlId?: TLShapeId | null;
  _bTlId?: TLShapeId | null;
}

export interface ERGraph {
  entities: Entity[];
  relations: Relation[];
  meta?: Record<string, unknown>;
}

/* =======================
   Tipos auxiliares (shapes)
======================= */

type RawEntityAttr = {
  id?: string;
  name?: string;
  type?: string;
  pk?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: unknown;
};

type RawEntityTableProps = {
  name?: string;
  attrs?: RawEntityAttr[];
  w?: number;
  h?: number;
};

type RawRelationEdgeProps = {
  aEntityId?: TLShapeId | null | string;
  bEntityId?: TLShapeId | null | string;
  aCard?: string;
  bCard?: string;
  waypoints?: Array<{ x: number; y: number }>;
  name?: string;
};

interface ShapeRecordMinimal {
  typeName: 'shape';
  id: TLShapeId;
  type: string;
  props?: unknown;
}

/* =======================
   Type guards
======================= */

function isShapeRecord(value: unknown): value is ShapeRecordMinimal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.typeName === 'shape' && typeof v.id === 'string' && typeof v.type === 'string';
}

function isEntityTableShape(s: ShapeRecordMinimal): s is ShapeRecordMinimal & { props: RawEntityTableProps } {
  if (s.type !== 'entity-table') return false;
  return typeof s.props === 'object' && s.props !== null;
}

function isRelationEdgeShape(s: ShapeRecordMinimal): s is ShapeRecordMinimal & { props: RawRelationEdgeProps } {
  if (s.type !== 'relation-edge') return false;
  return typeof s.props === 'object' && s.props !== null;
}

/* =======================
   Helpers de parsing
======================= */

const TYPE_MAP: Record<string, Attribute['type']> = {
  uuid: 'uuid',
  string: 'string',
  text: 'text',
  int: 'int',
  integer: 'int',
  float: 'float',
  decimal: 'decimal',
  bool: 'bool',
  boolean: 'bool',
  date: 'date',
  datetime: 'datetime',
  timestamp: 'datetime',
};

function normalizeType(input: string | undefined): Attribute['type'] {
  if (!input) return 'string';
  const k = input.toLowerCase().trim();
  return TYPE_MAP[k] ?? 'string';
}

function parseDefaultValue(raw: unknown): string | number | boolean | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const v = raw.trim();
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    return v;
  }
  // objetos/arrays → serializa o ignora (aquí: ignora)
  return undefined;
}

function parseAttrFromRaw(raw: RawEntityAttr): Attribute | null {
  const name = (raw.name ?? '').toString().trim();
  if (!name) return null;

  return {
    id: raw.id ?? crypto.randomUUID(),
    name,
    type: normalizeType(raw.type),
    isPrimary: !!raw.pk,
    isUnique: !!raw.unique,
    isNullable: !!raw.nullable,
    defaultValue: parseDefaultValue(raw.default),
  };
}

function ensurePrimaryKey(attrs: Attribute[]): Attribute[] {
  if (attrs.some((a: Attribute) => a.isPrimary)) return attrs;
  return [
    {
      id: crypto.randomUUID(),
      name: 'id',
      type: 'uuid',
      isPrimary: true,
      isUnique: true,
      isNullable: false,
    },
    ...attrs,
  ];
}

function sanitizeEntityName(input: string | undefined): string {
  const name = (input ?? '').trim();
  return name.length > 0 ? name : 'Entidad';
}

function cardinalityOrDefault(input: string | undefined): Cardinality {
  const v = (input ?? '').trim();
  if (v === '1' || v === '0..1' || v === '1..*' || v === '0..*') return v;
  return '1';
}

/* =======================
   Parser principal
======================= */

/**
 * Convierte shapes de Tldraw (entity-table / relation-edge) a un ERGraph.
 */
export function shapesToERGraph(editor: Editor): ERGraph {
  // 1) Recolectar records del store
  const allRecords: unknown[] = Array.from(editor.store.allRecords());
  const shapeRecords: ShapeRecordMinimal[] = allRecords.filter(isShapeRecord);

  // 2) Separar por tipo
  const entityShapes: Array<ShapeRecordMinimal & { props: RawEntityTableProps }> =
    shapeRecords.filter(isEntityTableShape);
  const relationShapes: Array<ShapeRecordMinimal & { props: RawRelationEdgeProps }> =
    shapeRecords.filter(isRelationEdgeShape);

  // 3) Entidades
  const entities: Entity[] = [];
  const tlToEntityId = new Map<TLShapeId, string>();

  for (const s of entityShapes) {
    const name: string = sanitizeEntityName(s.props.name);
    const rawAttrs: RawEntityAttr[] = Array.isArray(s.props.attrs) ? s.props.attrs : [];

    const parsedAttrs: Attribute[] = rawAttrs
      .map((ra: RawEntityAttr) => parseAttrFromRaw(ra))
      .filter((a: Attribute | null): a is Attribute => a !== null);

    const finalAttrs: Attribute[] = ensurePrimaryKey(parsedAttrs);

    const entityId: string = crypto.randomUUID();
    entities.push({
      id: entityId,
      name,
      attributes: finalAttrs,
      uniques: [],
      indexes: [],
      _tlShapeId: s.id,
    });
    tlToEntityId.set(s.id, entityId);
  }

  // 4) Relaciones
  const relations: Relation[] = [];

  for (const s of relationShapes) {
    // aEntityId / bEntityId podrían venir como string "plano"; castear de forma segura a TLShapeId si es string
    const aTlId: TLShapeId | null =
      (typeof s.props.aEntityId === 'string' ? (s.props.aEntityId as TLShapeId) : s.props.aEntityId) ?? null;
    const bTlId: TLShapeId | null =
      (typeof s.props.bEntityId === 'string' ? (s.props.bEntityId as TLShapeId) : s.props.bEntityId) ?? null;

    const aEntityId: string | undefined = aTlId ? tlToEntityId.get(aTlId) : undefined;
    const bEntityId: string | undefined = bTlId ? tlToEntityId.get(bTlId) : undefined;

    // Ignorar relaciones no conectadas a dos entidades
    if (!aEntityId || !bEntityId) continue;

    const aCard: Cardinality = cardinalityOrDefault(s.props.aCard);
    const bCard: Cardinality = cardinalityOrDefault(s.props.bCard);

    const relName: string =
      (typeof s.props.name === 'string' && s.props.name.trim().length > 0
        ? s.props.name.trim()
        : `rel_${String(s.id).slice(0, 5)}`);

    relations.push({
      id: crypto.randomUUID(),
      name: relName,
      ends: [
        { entityId: aEntityId, cardinality: aCard },
        { entityId: bEntityId, cardinality: bCard },
      ],
      attributes: [],
      _aTlId: aTlId,
      _bTlId: bTlId,
    });
  }

  // 5) Meta
  const meta: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    counts: { entities: entities.length, relations: relations.length },
  };

  return { entities, relations, meta };
}
