// src/Diagram/BackendGenerator.ts
import axios from 'axios';
import type { ERGraph } from '../ER_diagram/erParser';
import { generateSpringProject } from './transforms/to-spring';

// ====== SQL (cliente). Si ya lo tienes, mantén tu versión.
export type Cardinality = '1' | '0..1' | '1..*' | '0..*';
export interface Attribute {
  id: string;
  name: string;
  type: 'uuid'|'string'|'text'|'int'|'float'|'decimal'|'bool'|'date'|'datetime';
  isPrimary?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;
  defaultValue?: string | number | boolean | null;
}
export interface Entity {
  id: string;
  name: string;
  attributes: Attribute[];
  uniques?: string[];
  indexes?: string[];
}
export interface RelationEnd {
  entityId: string;
  roleName?: string;
  cardinality: Cardinality;
}
export interface Relation {
  id: string;
  name: string;
  ends: [RelationEnd, RelationEnd];
  attributes?: Attribute[];
}
export interface ERGraphLocal {
  entities: Entity[];
  relations: Relation[];
  meta?: Record<string, unknown>;
}

function pgType(t: Attribute['type']): string {
  switch (t) {
    case 'uuid': return 'uuid';
    case 'string': return 'varchar(255)';
    case 'text': return 'text';
    case 'int': return 'integer';
    case 'float': return 'double precision';
    case 'decimal': return 'numeric(12,2)';
    case 'bool': return 'boolean';
    case 'date': return 'date';
    case 'datetime': return 'timestamp';
    default: return 'varchar(255)';
  }
}
function findPkAttr(e: Entity): Attribute {
  const pk = e.attributes.find(a => a.isPrimary);
  return pk ?? e.attributes[0];
}
function sqlForEntity(e: Entity): string {
  const cols = e.attributes.map(a => {
    const nullable = a.isNullable ? '' : ' NOT NULL';
    const unique = a.isUnique ? ' UNIQUE' : '';
    const def = a.defaultValue !== undefined && a.defaultValue !== null
      ? ` DEFAULT ${typeof a.defaultValue === 'string' ? `'${a.defaultValue}'` : a.defaultValue}`
      : '';
    return `  "${a.name}" ${pgType(a.type)}${nullable}${unique}${def}`;
  });
  const pkCols = e.attributes.filter(a => a.isPrimary).map(a => `"${a.name}"`);
  if (pkCols.length) cols.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
  return [`CREATE TABLE "${e.name}" (`, cols.join(',\n'), ');'].join('\n');
}
function detectNN(rel: Relation): boolean {
  const [a, b] = rel.ends;
  return (a.cardinality.includes('*') && b.cardinality.includes('*'));
}
function sqlForRelation(rel: Relation, graph: ERGraphLocal): string {
  const [left, right] = rel.ends;
  const leftEnt = graph.entities.find(e => e.id === left.entityId);
  const rightEnt = graph.entities.find(e => e.id === right.entityId);
  if (!leftEnt || !rightEnt) return `-- WARN: relación ${rel.name} con entidades inexistentes`;

  // N..N
  if (detectNN(rel)) {
    const leftPK = findPkAttr(leftEnt);
    const rightPK = findPkAttr(rightEnt);
    const leftCol = `"${leftEnt.name}_${leftPK.name}"`;
    const rightCol = `"${rightEnt.name}_${rightPK.name}"`;
    const table = `"${rel.name || `${leftEnt.name}_${rightEnt.name}`}_link"`;
    return `
CREATE TABLE ${table} (
  ${leftCol} ${pgType(leftPK.type)} NOT NULL,
  ${rightCol} ${pgType(rightPK.type)} NOT NULL,
  PRIMARY KEY (${leftCol}, ${rightCol}),
  FOREIGN KEY (${leftCol}) REFERENCES "${leftEnt.name}"("${leftPK.name}") ON DELETE CASCADE,
  FOREIGN KEY (${rightCol}) REFERENCES "${rightEnt.name}"("${rightPK.name}") ON DELETE CASCADE
);`.trim();
  }

  // 1..*
  const star = rel.ends.find(e => e.cardinality.includes('*'));
  const one = rel.ends.find(e => !e.cardinality.includes('*'));
  if (star && one) {
    const starEnt = graph.entities.find(e => e.id === star.entityId)!;
    const oneEnt = graph.entities.find(e => e.id === one.entityId)!;
    const onePK = findPkAttr(oneEnt);
    const fkName = `"${oneEnt.name}_${onePK.name}"`;
    return `
ALTER TABLE "${starEnt.name}"
ADD COLUMN ${fkName} ${pgType(onePK.type)} NOT NULL,
ADD CONSTRAINT fk_${starEnt.name}_${oneEnt.name}
  FOREIGN KEY (${fkName}) REFERENCES "${oneEnt.name}"("${onePK.name}") ON DELETE RESTRICT;`.trim();
  }

  // 1..1 / 0..1 (pendiente: puedes decidir lado dueño y unique)
  return `-- TODO relación ${rel.name}: caso 1..1 / 0..1.`;
}

export function toPostgres(graph: ERGraphLocal): string {
  const parts: string[] = [];
  for (const e of graph.entities) parts.push(sqlForEntity(e));
  for (const r of graph.relations) parts.push(sqlForRelation(r, graph));
  return parts.join('\n\n');
}

// ======= GENERATE ALL =======

export interface SpringGenOptions {
  packageBase?: string;
  projectName?: string;
}

export async function generateAll(graph: ERGraph, opts?: SpringGenOptions) {
  // 1) SQL
  const sql = toPostgres(graph as any);

  // 2) ZIP Spring (cliente, con JSZip)
  const zipBlob = await generateSpringProject(graph, {
    packageBase: opts?.packageBase ?? 'com.example.generated',
    projectName: opts?.projectName ?? 'er-backend',
  });

  return { sql, zipBlob };
}
