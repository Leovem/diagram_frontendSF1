

import JSZip from 'jszip'
import type { ERGraph, Entity, Attribute, Relation } from '../../ER_diagram/erParser'
import { gitignore, gitattributes, mvnwCmd } from './spring_assets'


export type SpringOpts = {
  packageBase: string   // e.g. com.misa.case
  projectName: string   // e.g. backend
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
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.5.7</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>diagram</groupId>
	<artifactId>backend</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>backend</name>
	<description>Demo project for Spring Boot</description>
	<url/>
	<licenses>
		<license/>
	</licenses>
	<developers>
		<developer/>
	</developers>
	<scm>
		<connection/>
		<developerConnection/>
		<tag/>
		<url/>
	</scm>
	<properties>
		<java.version>17</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>com.h2database</groupId>
			<artifactId>h2</artifactId>
			<scope>runtime</scope>
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
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-compiler-plugin</artifactId>
				<configuration>
					<annotationProcessorPaths>
						<path>
							<groupId>org.projectlombok</groupId>
							<artifactId>lombok</artifactId>
						</path>
					</annotationProcessorPaths>
				</configuration>
			</plugin>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
				<configuration>
					<excludes>
						<exclude>
							<groupId>org.projectlombok</groupId>
							<artifactId>lombok</artifactId>
						</exclude>
					</excludes>
				</configuration>
			</plugin>
		</plugins>
	</build>

</project>
`
}

/**function applicationProperties(projectName: string): string {
  return `spring.application.name=${projectName}
server.port=8080

spring.datasource.url=jdbc:postgresql://localhost:5432/erdb
spring.datasource.username=postgres
spring.datasource.password=1256

spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation=true

spring.jackson.serialization.WRITE_DATES_AS_TIMESTAMPS=false
`
}**/

function applicationProperties(projectName: string): string {
  return `spring.application.name=${projectName}
server.port=8080

# Base de datos H2 temporal (en memoria)
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

# Habilita la consola web de H2
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console

# Configuración JPA / Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.show-sql=true

`}



function mainAppJava(pkg: string, appName: string): string {
  return `package diagram.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
`
}

/* ======================
   Entity.java
====================== */

function entityJava(pkg: string, e: Entity, graph: ERGraph) {

  

  const cls = pascal(e.name)
  const idCls = `${cls}Id`
  const typeImports = new Set<string>(['jakarta.persistence.*', 'lombok.*'])
  const annosTop = [
    '@Entity',
    `@Table(name = "${e.name.toLowerCase()}")`,
    '@Getter',
    '@Setter',
    '@NoArgsConstructor',
    '@AllArgsConstructor',
    '@Builder'
  ]

  const pkAttrs = e.attributes.filter(a => a.isPrimary)
  const hasCompositePK = pkAttrs.length > 1
  const usesUUID = e.attributes.some(a => javaType(a.type).includes('UUID'))
  if (usesUUID) typeImports.add('java.util.UUID')

  const isJoinTable = e.isJoinTable === true || /^detalle_/i.test(e.name) || /^relacion_/i.test(e.name)




// === CASO 1: entidad intermedia con PK compuesta (dos archivos)
if (isJoinTable && pkAttrs.length === 2) {
  console.log("🧩 Generando entidad intermedia:", e.name)

  const parts = e.name
    .replace(/^detalle_|^relacion_/i, '')
    .split(/[_-]/)
    .filter(Boolean)

  let [left, right] = parts
  const normalize = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().replace(/_/g, '').replace(/s$/, '').trim()

const leftEntity = graph.entities.find(x =>
  normalize(x.name) === normalize(left) ||
  normalize(x.name).includes(normalize(left)) ||
  normalize(left).includes(normalize(x.name))
)

const rightEntity = graph.entities.find(x =>
  normalize(x.name) === normalize(right) ||
  normalize(x.name).includes(normalize(right)) ||
  normalize(right).includes(normalize(x.name))
)


  console.log("🔗 Resolviendo join table:", e.name)
  console.log("  → left:", left, "→ found:", leftEntity?.name)
  console.log("  → right:", right, "→ found:", rightEntity?.name)

  const hasExtraAttrs = e.attributes.length > pkAttrs.length
  if (!hasExtraAttrs) {
    console.warn(`⚠️ ${e.name} detectada como relación pura N:N, sin atributos adicionales`)
    return [{
      filename: `${cls}.java`,
      content: `// Tabla ${e.name} detectada como relación muchos a muchos pura (sin atributos adicionales).
// No se genera entidad intermedia explícita.
`
    }]
  }

  // === Archivo 1: clase ID embebible ===
  const idFields = pkAttrs.map(a => {
    const jt = simpleJavaType(javaType(a.type))
    return `${INDENT}@Column(name = "${a.name.toLowerCase()}")\n${INDENT}private ${jt} ${camel(a.name)};`
  }).join('\n\n')

  const idImports = [
    'jakarta.persistence.*',
    'lombok.*',
    'java.io.Serializable'
  ]
  if (usesUUID) idImports.push('java.util.UUID')

  const idClassContent = `package ${pkg}.entity;

${idImports.map(i => `import ${i};`).join('\n')}

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ${idCls} implements Serializable {
${idFields}
}
`

  // === Archivo 2: entidad principal ===
  const entityFields = []
  entityFields.push(`${INDENT}@EmbeddedId\n${INDENT}private ${idCls} id;`)

  if (leftEntity) {
    entityFields.push(
`${INDENT}@ManyToOne
${INDENT}@MapsId("${camel(pkAttrs[0].name)}")
${INDENT}@JoinColumn(name = "${pkAttrs[0].name.toLowerCase()}", nullable = false)
${INDENT}private ${pascal(leftEntity.name)} ${camel(leftEntity.name)};`
    )
  } else {
    console.warn(`⚠️ No se encontró entidad izquierda para ${e.name}`)
  }

  if (rightEntity) {
    entityFields.push(
`${INDENT}@ManyToOne
${INDENT}@MapsId("${camel(pkAttrs[1].name)}")
${INDENT}@JoinColumn(name = "${pkAttrs[1].name.toLowerCase()}", nullable = false)
${INDENT}private ${pascal(rightEntity.name)} ${camel(rightEntity.name)};`
    )
  } else {
    console.warn(`⚠️ No se encontró entidad derecha para ${e.name}`)
  }

  // Atributos adicionales
  for (const a of e.attributes) {
    if (a.isPrimary) continue
    const jt = simpleJavaType(javaType(a.type))
    entityFields.push(`${INDENT}@Column(name = "${a.name.toLowerCase()}")\n${INDENT}private ${jt} ${camel(a.name)};`)
  }

  const entityImports = Array.from(typeImports)
    .sort()
    .map(i => `import ${i};`)
    .join('\n')

  const entityContent = `package ${pkg}.entity;

${entityImports}

${annosTop.join('\n')}
public class ${cls} {

${entityFields.join('\n\n')}
}
`

  console.log(`✅ Generados archivos para ${e.name}: ${idCls}.java y ${cls}.java`)

  return [
    { filename: `${idCls}.java`, content: idClassContent },
    { filename: `${cls}.java`, content: entityContent }
  ]
}
else if (isJoinTable && pkAttrs.length !== 2) {
  console.warn("⚠️ Tabla marcada como joinTable pero PK count ≠ 2:", e.name, "→", pkAttrs.length)
} else if (!isJoinTable && pkAttrs.length === 2) {
  console.log("ℹ️ Tiene 2 PK pero no marcada como joinTable:", e.name)
}


  // === CASO 2: entidad normal (una sola clase) ===
  const fields: string[] = []
  const pkAttr = pkAttrs[0]
  const pkJavaType = javaType(pkAttr.type)
  const pkSimple = simpleJavaType(pkJavaType)

  fields.push(`${INDENT}@Id`)
  if (pkSimple === 'UUID')
    fields.push(`${INDENT}@GeneratedValue(strategy = GenerationType.AUTO)`)
  else if (pkSimple === 'Integer' || pkSimple === 'Long')
    fields.push(`${INDENT}@GeneratedValue(strategy = GenerationType.IDENTITY)`)

  fields.push(`${INDENT}private ${pkSimple} ${camel(pkAttr.name)};`)

  for (const a of e.attributes) {
    if (a.isPrimary) continue
    const jt = simpleJavaType(javaType(a.type))
    fields.push(`${INDENT}@Column(name = "${a.name.toLowerCase()}")\n${INDENT}private ${jt} ${camel(a.name)};`)
  }

  const imports = Array.from(typeImports)
    .sort()
    .map(i => `import ${i};`)
    .join('\n')

  const normalContent = `package ${pkg}.entity;

${imports}

${annosTop.join('\n')}
public class ${cls} {

${fields.join('\n\n')}
}
`

  return [{ filename: `${cls}.java`, content: normalContent }]
}




/* ======================
   Repository.java
====================== */
function repositoryJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name)
  const pkAttrs = e.attributes.filter(a => a.isPrimary)
  const hasCompositePK = pkAttrs.length > 1
  const pkCls = hasCompositePK ? `${cls}Id` : simpleJavaType(javaType(pkAttrs[0].type))

  const imports = [
    'org.springframework.data.jpa.repository.JpaRepository',
    `${pkg}.entity.${cls}`,
  ]

  if (hasCompositePK) imports.push(`${pkg}.entity.${cls}Id`)
  if (pkCls === 'UUID') imports.push('java.util.UUID')

  return `package ${pkg}.repository;

${imports.map(i => `import ${i};`).join('\n')}

public interface ${cls}Repository extends JpaRepository<${cls}, ${pkCls}> {
}
`
}

/* ======================
   Service.java
====================== */
function serviceJava(pkg: string, e: Entity, graph: ERGraph): string {
  const cls = pascal(e.name)
  const nameVar = camel(e.name)
  const pkAttrs = e.attributes.filter(a => a.isPrimary)
  const hasCompositePK = pkAttrs.length > 1
  const pkCls = hasCompositePK ? `${cls}Id` : simpleJavaType(javaType(pkAttrs[0].type))
  const isJoinTable = /^detalle_|^relacion_/i.test(e.name)

  // === Imports base ===
  const imports = [
    'org.springframework.stereotype.Service',
    'java.util.List',
    'java.util.Optional',
    'java.util.UUID',
    `${pkg}.entity.${cls}`,
    `${pkg}.repository.${cls}Repository`,
    'lombok.extern.slf4j.Slf4j'
  ]

  if (hasCompositePK) imports.push(`${pkg}.entity.${cls}Id`)

  // === Si es tabla intermedia, identificar entidades relacionadas ===
  let relationValidation = ''
  let repoDeclares = ''
  let repoParams = ''
  let repoAssigns = ''

  if (isJoinTable && hasCompositePK) {
    const parts = e.name.replace(/^detalle_|^relacion_/i, '').split(/[_-]/).filter(p => p)
    const [left, right] = parts
    const leftEntity = graph.entities.find(x => x.name.toLowerCase() === left.toLowerCase())
    const rightEntity = graph.entities.find(x => x.name.toLowerCase() === right.toLowerCase())

    if (leftEntity && rightEntity) {
      const leftCls = pascal(leftEntity.name)
      const rightCls = pascal(rightEntity.name)
      const leftRepo = `${camel(leftEntity.name)}Repo`
      const rightRepo = `${camel(rightEntity.name)}Repo`

      imports.push(`${pkg}.entity.${leftCls}`)
      imports.push(`${pkg}.entity.${rightCls}`)
      imports.push(`${pkg}.repository.${leftCls}Repository`)
      imports.push(`${pkg}.repository.${rightCls}Repository`)

      // Repos a declarar
      repoDeclares = `
  private final ${leftCls}Repository ${leftRepo};
  private final ${rightCls}Repository ${rightRepo};`

      // Repos en constructor
      repoParams = `, ${leftCls}Repository ${leftRepo}, ${rightCls}Repository ${rightRepo}`

      // Asignaciones en constructor
      repoAssigns = `
    this.${leftRepo} = ${leftRepo};
    this.${rightRepo} = ${rightRepo};`

      // Bloque de validación dentro del save()
      relationValidation = `
    //  Validar y asignar las entidades relacionadas
    UUID id${leftCls} = ${nameVar}.getId().get${pascal(pkAttrs[0].name)}();
    UUID id${rightCls} = ${nameVar}.getId().get${pascal(pkAttrs[1].name)}();

    ${leftCls} ${camel(leftEntity.name)} = ${leftRepo}.findById(id${leftCls})
        .orElseThrow(() -> new RuntimeException("No se encontró ${leftEntity.name} con ID " + id${leftCls}));

    ${rightCls} ${camel(rightEntity.name)} = ${rightRepo}.findById(id${rightCls})
        .orElseThrow(() -> new RuntimeException("No se encontró ${rightEntity.name} con ID " + id${rightCls}));

    ${nameVar}.set${leftCls}(${camel(leftEntity.name)});
    ${nameVar}.set${rightCls}(${camel(rightEntity.name)});`
    }
  }

  // === Contenido final del Service ===
  return `package ${pkg}.service;

${imports.map(i => `import ${i};`).join('\n')}

@Service
@Slf4j
public class ${cls}Service {
  private final ${cls}Repository repo;${repoDeclares}

  public ${cls}Service(${cls}Repository repo${repoParams}) {
    this.repo = repo;${repoAssigns}
  }

  public List<${cls}> findAll() {
    log.info("[Service] findAll() → buscando todos los registros de ${cls}");
    List<${cls}> lista = repo.findAll();
    log.info("[Service] findAll() → registros encontrados: {}", lista.size());
    return lista;
  }

  public Optional<${cls}> findById(${pkCls} id) {
    log.info("[Service] findById() → buscando ${cls} con ID: {}", id);
    Optional<${cls}> resultado = repo.findById(id);
    if (resultado.isPresent()) {
      log.info("[Service] findById() → registro encontrado: {}", resultado.get());
    } else {
      log.warn("[Service] findById() → no se encontró registro con id={}", id);
    }
    return resultado;
  }

  public ${cls} save(${cls} ${nameVar}) {
    log.info("[Service] save() → guardando registro: {}", ${nameVar});${relationValidation}

    ${cls} saved = repo.save(${nameVar});
    
    return saved;
  }

  public void deleteById(${pkCls} id) {
    log.info("[Service] deleteById() → eliminando registro con ID: {}", id);
    repo.deleteById(id);
    log.info("[Service] deleteById() → eliminación completada");
  }
}
`
}


/* ======================
   Controller.java
====================== */

function controllerJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name)
  const nameVar = camel(e.name)
  const pkAttrs = e.attributes.filter(a => a.isPrimary)
  const hasCompositePK = pkAttrs.length > 1
  const pkCls = hasCompositePK ? `${cls}Id` : simpleJavaType(javaType(pkAttrs[0].type))
  const baseRoute = camel(e.name).toLowerCase()
  const isJoinTable = /^detalle_|^relacion_/i.test(e.name)

  // === imports base
  const imports = [
    'org.springframework.http.ResponseEntity',
    'org.springframework.web.bind.annotation.*',
    'java.util.List',
    'java.util.UUID',
    `${pkg}.entity.${cls}`,
    `${pkg}.service.${cls}Service`,
    'lombok.extern.slf4j.Slf4j'
  ]
  if (hasCompositePK) imports.push(`${pkg}.entity.${cls}Id`)

  // === GET único
  let getMapping = ''
  if (hasCompositePK) {
    const pathVars = pkAttrs.map(a => `@PathVariable ${simpleJavaType(javaType(a.type))} ${camel(a.name)}`).join(', ')
    const pathUrl = pkAttrs.map(a => `/{${camel(a.name)}}`).join('')
    const pkArgs = pkAttrs.map(a => camel(a.name)).join(', ')

    getMapping = `
  @GetMapping("${pathUrl}")
  public ResponseEntity<${cls}> findOne(${pathVars}) {
    log.info("GET /api/${baseRoute}${pathUrl}");
    ${pkCls} id = new ${pkCls}(${pkArgs});
    return service.findById(id)
        .map(data -> {
          log.info("Registro encontrado: {}", data);
          return ResponseEntity.ok(data);
        })
        .orElseGet(() -> {
          log.warn("No se encontró registro con id={}", id);
          return ResponseEntity.notFound().build();
        });
  }`
  } else {
    getMapping = `
  @GetMapping("/{id}")
  public ResponseEntity<${cls}> findOne(@PathVariable ${pkCls} id) {
    log.info("GET /api/${baseRoute}/{} → buscar por ID", id);
    return service.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }`
  }

  // === DELETE (maneja PK compuesta con @RequestBody o PathVars)
  const deleteBlock = hasCompositePK
    ? `
  @DeleteMapping
  public ResponseEntity<Void> delete(@RequestBody ${pkCls} id) {
    log.info("DELETE /api/${baseRoute} - ID recibido: {}", id);
    service.deleteById(id);
    log.info("Registro eliminado correctamente.");
    return ResponseEntity.noContent().build();
  }`
    : `
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable ${pkCls} id) {
    log.info("DELETE /api/${baseRoute}/{} - eliminando", id);
    service.deleteById(id);
    return ResponseEntity.noContent().build();
  }`

  // === Generación final del Controller
  return `package ${pkg}.controller;

${imports.map(i => `import ${i};`).join('\n')}

@RestController
@RequestMapping("/api/${baseRoute}")
@CrossOrigin(origins = "*")
@Slf4j
public class ${cls}Controller {

  private final ${cls}Service service;

  public ${cls}Controller(${cls}Service service) {
    this.service = service;
  }

  @GetMapping
  public List<${cls}> findAll() {
    log.info("GET /api/${baseRoute} → obtener todos los registros");
    List<${cls}> result = service.findAll();
    log.info("Registros obtenidos: {}", result.size());
    return result;
  }${getMapping}

  @PostMapping
  public ${cls} create(@RequestBody ${cls} ${nameVar}) {
    log.info("POST /api/${baseRoute} - Datos recibidos: {}", ${nameVar});
    ${cls} saved = service.save(${nameVar});
    log.info("Registro guardado correctamente: {}", saved);
    return saved;
  }

  @PutMapping
  public ResponseEntity<${cls}> update(@RequestBody ${cls} ${nameVar}) {
    log.info("PUT /api/${baseRoute} - Actualizando: {}", ${nameVar});
    ${cls} updated = service.save(${nameVar});
    log.info("Registro actualizado: {}", updated);
    return ResponseEntity.ok(updated);
  }${deleteBlock}
}
`
}





export function generatePostmanText(er: ERGraph, port = 8080): string {
  const baseUrl = `http://localhost:${port}/api`

  return er.entities
    .map(entity => {
      const name = entity.name.toLowerCase()
      const url = `${baseUrl}/${name}`

      // construir cuerpo JSON de ejemplo basado en tipos
      const body = Object.fromEntries(
        entity.attributes
          .filter(a => !a.isPrimary)
          .map(a => {
            const type = a.type?.toLowerCase?.() ?? "string"
            let value

            if (["uuid"].includes(type))
              value = "123e4567-e89b-12d3-a456-426614174000"
            else if (["int", "integer", "long", "float", "double", "number"].includes(type))
              value = 1
            else if (["bool", "boolean"].includes(type))
              value = true
            else if (["date", "datetime", "timestamp"].includes(type))
              value = "2025-11-10"
            else
              value = `${a.name} ejemplo`

            return [a.name, value]
          })
      )

      const json = JSON.stringify(body, null, 2)

      return [
        `# ================= ${entity.name.toUpperCase()} =================`,
        ``,
        `### 📘 GET - Listar todos`,
        `GET ${url}`,
        ``,
        `### 🟢 POST - Crear nuevo`,
        `POST ${url}`,
        `Content-Type: application/json`,
        ``,
        `${json}`,
        ``,
        `### 🔍 GET - Buscar por ID`,
        `GET ${url}/{id}`,
        ``,
        `### 🟡 PUT - Actualizar por ID`,
        `PUT ${url}/{id}`,
        `Content-Type: application/json`,
        ``,
        `${json}`,
        ``,
        `### 🔴 DELETE - Eliminar por ID`,
        `DELETE ${url}/{id}`,
        ``
      ].join("\n")
    })
    .join("\n\n")
}





/* ======================
   ZIP Builder
====================== */
export async function generateSpringProject(er: ERGraph, opts: SpringOpts): Promise<Blob> {
  const zip = new JSZip()
  const { packageBase, projectName } = opts
  const base = `src/main/java/${packageBase.replace(/\./g, '/')}`
  const resources = `src/main/resources`
  const tests = `src/test/java/${packageBase.replace(/\./g, '/')}`
  const wrapper = `.mvn/wrapper`

  // === Archivos raíz ===
  zip.file('pom.xml', pomXml(projectName))
  zip.file(`${resources}/application.properties`, applicationProperties(projectName))
  zip.file(
    `${wrapper}/maven-wrapper.properties`,
    `wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
`
  )

  // === Clase principal (BackendApplication.java) ===
  const appClass = pascal(projectName) + 'Application'
  zip.file(`${base}/${appClass}.java`, mainAppJava(packageBase, appClass))

  // === Entidades + capas ===
  for (const e of er.entities) {
    const entityFiles = entityJava(packageBase, e, er)

if (Array.isArray(entityFiles)) {
  // Caso nuevo: la función devolvió varios archivos
  for (const file of entityFiles) {
    zip.file(`${base}/entity/${file.filename}`, file.content)
  }
} else {
  // Caso viejo: por compatibilidad, si devuelve una cadena simple
  zip.file(`${base}/entity/${pascal(e.name)}.java`, entityFiles)
}

    zip.file(`${base}/repository/${pascal(e.name)}Repository.java`, repositoryJava(packageBase, e))
    zip.file(`${base}/service/${pascal(e.name)}Service.java`, serviceJava(packageBase, e, er))
    zip.file(`${base}/controller/${pascal(e.name)}Controller.java`, controllerJava(packageBase, e))
  }

  // === Test base ===
  zip.file(
    `${tests}/${appClass}Tests.java`,
    `package ${packageBase};

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ${appClass}Tests {

  @Test
  void contextLoads() {
  }
}
`)

// === Archivos auxiliares (git y wrapper) ===
  zip.file('.gitignore', gitignore.trimStart())
  zip.file('.gitattributes', gitattributes.trimStart())
  //zip.file('mvnw', mvnw.trimStart(), { unixPermissions: '755' })
  zip.file('mvnw.cmd', mvnwCmd.trimStart())

  // === Generar colección Postman ===
zip.file(`postman/${projectName}-collection.json`, generatePostmanText(er))

  // === Resultado final del ZIP ===
  return await zip.generateAsync({ type: 'blob' })
}

