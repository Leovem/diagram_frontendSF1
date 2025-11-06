// ===============================================
// src/Diagram/transforms/to-spring.ts
// Versión 2.0 — Profesional y compatible con BackendGenerator v1.1
// ===============================================

import JSZip from 'jszip'
import type { ERGraph, Entity, Attribute, Relation } from '../../ER_diagram/erParser'

export type SpringOpts = {
  packageBase: string   // e.g. com.misa.case
  projectName: string   // e.g. er-backend
}

const INDENT = '  '

/* ======================
   Helpers de tipos
====================== */

function javaType(t: Attribute['type']): string {
  switch (t) {
    case 'uuid': return 'java.util.UUID'
    case 'string':
    case 'text': return 'java.lang.String'
    case 'int': return 'java.lang.Integer'
    case 'float': return 'java.lang.Double'
    case 'decimal': return 'java.math.BigDecimal'
    case 'bool': return 'java.lang.Boolean'
    case 'date': return 'java.time.LocalDate'
    case 'datetime': return 'java.time.LocalDateTime'
    default: return 'java.lang.String'
  }
}

function simpleJavaType(t: string): string {
  const last = t.lastIndexOf('.')
  return last >= 0 ? t.substring(last + 1) : t
}

function pascal(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : '')
    .join('')
}

function camel(s: string): string {
  const p = pascal(s)
  return p ? p[0].toLowerCase() + p.slice(1) : s
}

function findPkAttr(e: Entity): Attribute {
  const pk = e.attributes.find(a => a.isPrimary)
  return pk ?? e.attributes[0]
}

function isMany(card: string) {
  return card.includes('*')
}

/* ======================
   Plantillas base
====================== */

function pomXml(projectName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${projectName}</groupId>
  <artifactId>${projectName}</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>${projectName}</name>
  <description>Generated Spring Boot backend</description>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>`
}

function applicationYml(): string {
  return `server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/erdb
    username: postgres
    password: postgres
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate:
        format_sql: true
        jdbc:
          lob:
            non_contextual_creation: true
  jackson:
    serialization:
      WRITE_DATES_AS_TIMESTAMPS: false
`
}

function mainAppJava(pkg: string, appName: string): string {
  return `package ${pkg};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${appName} {
  public static void main(String[] args) {
    SpringApplication.run(${appName}.class, args);
  }
}
`
}

/* ======================
   Entity.java
====================== */

function entityJava(pkg: string, e: Entity, graph: ERGraph): string {
  const cls = pascal(e.name)
  const typeImports = new Set<string>(['jakarta.persistence.*', 'lombok.*'])

  const annosTop = [
    '@Entity',
    `@Table(name = "${e.name}")`,
    '@Getter',
    '@Setter',
    '@NoArgsConstructor',
    '@AllArgsConstructor',
    '@Builder'
  ]

  const fields: string[] = []
  const pkAttr = findPkAttr(e)
  const pkJavaType = javaType(pkAttr.type)
  const pkSimple = simpleJavaType(pkJavaType)

  fields.push(`${INDENT}@Id`)
  if (pkSimple === 'UUID')
    fields.push(`${INDENT}@GeneratedValue`)
  else if (pkSimple === 'Integer' || pkSimple === 'Long')
    fields.push(`${INDENT}@GeneratedValue(strategy = GenerationType.IDENTITY)`)

  fields.push(`${INDENT}private ${pkSimple} ${camel(pkAttr.name)};`)

  // Otros atributos
  for (const a of e.attributes) {
    if (a.isPrimary) continue
    const jt = javaType(a.type)
    const jts = simpleJavaType(jt)
    const column = []
    if (a.isUnique) column.push('unique = true')
    if (a.isNullable === false) column.push('nullable = false')
    if (column.length) fields.push(`${INDENT}@Column(${column.join(', ')})`)
    fields.push(`${INDENT}private ${jts} ${camel(a.name)};`)
  }

  // Relaciones simplificadas (bidireccionales)
  // TODO: Si quieres relaciones más complejas, se puede extender aquí.

  const imports = Array.from(typeImports)
    .sort()
    .map(i => `import ${i};`)
    .join('\n')

  return `package ${pkg}.entity;

${imports}

${annosTop.join('\n')}
public class ${cls} {

${fields.join('\n\n')}
}
`
}

/* ======================
   Repository.java
====================== */
function repositoryJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name)
  const pkAttr = findPkAttr(e)
  const pkSimple = simpleJavaType(javaType(pkAttr.type))
  return `package ${pkg}.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ${pkg}.entity.${cls};

@Repository
public interface ${cls}Repository extends JpaRepository<${cls}, ${pkSimple}> {
}
`
}

/* ======================
   Service.java
====================== */
function serviceJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name)
  const nameVar = camel(e.name)
  return `package ${pkg}.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import ${pkg}.entity.${cls};
import ${pkg}.repository.${cls}Repository;

@Service
public class ${cls}Service {
  private final ${cls}Repository repo;

  public ${cls}Service(${cls}Repository repo) { this.repo = repo; }

  public List<${cls}> findAll() { return repo.findAll(); }

  public Optional<${cls}> findById(Object id) { return repo.findById(id); }

  public ${cls} save(${cls} ${nameVar}) { return repo.save(${nameVar}); }

  public void deleteById(Object id) { repo.deleteById(id); }
}
`
}

/* ======================
   Controller.java
====================== */
function controllerJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name)
  const nameVar = camel(e.name)
  const pkAttr = findPkAttr(e)
  const pkSimple = simpleJavaType(javaType(pkAttr.type))

  return `package ${pkg}.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import ${pkg}.entity.${cls};
import ${pkg}.service.${cls}Service;

@RestController
@RequestMapping("/api/${camel(e.name)}")
@CrossOrigin(origins = "*")
public class ${cls}Controller {

  private final ${cls}Service service;

  public ${cls}Controller(${cls}Service service) { this.service = service; }

  @GetMapping
  public List<${cls}> findAll() { return service.findAll(); }

  @GetMapping("/{id}")
  public ResponseEntity<${cls}> findOne(@PathVariable ${pkSimple} id) {
    return service.findById(id)
      .map(ResponseEntity::ok)
      .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ${cls} create(@RequestBody ${cls} ${nameVar}) {
    return service.save(${nameVar});
  }

  @PutMapping("/{id}")
  public ResponseEntity<${cls}> update(@PathVariable ${pkSimple} id, @RequestBody ${cls} ${nameVar}) {
    ${nameVar}.set${pascal(pkAttr.name)}(id);
    return ResponseEntity.ok(service.save(${nameVar}));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable ${pkSimple} id) {
    service.deleteById(id);
    return ResponseEntity.noContent().build();
  }
}
`
}

/* ======================
   ZIP Builder
====================== */
export async function generateSpringProject(er: ERGraph, opts: SpringOpts): Promise<Blob> {
  const zip = new JSZip()
  const { packageBase, projectName } = opts
  const base = `src/main/java/${packageBase.replace(/\./g, '/')}`
  const resources = `src/main/resources`

  zip.file('pom.xml', pomXml(projectName))
  zip.file(`${resources}/application.yml`, applicationYml())

  const appClass = pascal(projectName) + 'Application'
  zip.file(`${base}/${appClass}.java`, mainAppJava(packageBase, appClass))

  // entidades + capas
  for (const e of er.entities) {
    zip.file(`${base}/entity/${pascal(e.name)}.java`, entityJava(packageBase, e, er))
    zip.file(`${base}/repository/${pascal(e.name)}Repository.java`, repositoryJava(packageBase, e))
    zip.file(`${base}/service/${pascal(e.name)}Service.java`, serviceJava(packageBase, e))
    zip.file(`${base}/controller/${pascal(e.name)}Controller.java`, controllerJava(packageBase, e))
  }

  return await zip.generateAsync({ type: 'blob' })
}
