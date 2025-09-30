// src/Diagram/transforms/to-spring.ts
import JSZip from 'jszip';
import type { ERGraph, Entity, Attribute, Relation } from '../../ER_diagram/erParser';

type SpringOpts = {
  packageBase: string;   // e.g. com.misa.case
  projectName: string;   // e.g. er-backend
};

const INDENT = '  ';

/* ======================
   Helpers de tipos
====================== */

function javaType(t: Attribute['type']): string {
  switch (t) {
    case 'uuid': return 'java.util.UUID';
    case 'string': return 'java.lang.String';
    case 'text': return 'java.lang.String';
    case 'int': return 'java.lang.Integer';
    case 'float': return 'java.lang.Double';
    case 'decimal': return 'java.math.BigDecimal';
    case 'bool': return 'java.lang.Boolean';
    case 'date': return 'java.time.LocalDate';
    case 'datetime': return 'java.time.LocalDateTime';
    default: return 'java.lang.String';
  }
}
function simpleJavaType(t: string): string {
  const last = t.lastIndexOf('.');
  return last >= 0 ? t.substring(last + 1) : t;
}

function pascal(s: string): string {
  return s
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : '')
    .join('');
}
function camel(s: string): string {
  const p = pascal(s);
  return p ? p[0].toLowerCase() + p.slice(1) : s;
}

function findPkAttr(e: Entity): Attribute {
  const pk = e.attributes.find(a => a.isPrimary);
  return pk ?? e.attributes[0];
}

/* ======================
   Relaciones
   Convención:
   - Si ends son (A, B) con:
       A:1  B:1..*  => B.manyToOne(A), A.oneToMany(B)
       A:1..* B:1   => A.manyToOne(B), B.oneToMany(A)
       A:*   B:*    => A.manyToMany(B) y viceversa con @JoinTable solo en lado A (id < B.id)
====================== */

type RelEdge = {
  aId: string; aCard: string;
  bId: string; bCard: string;
  name: string;
};

function getRelEdges(graph: ERGraph): RelEdge[] {
  return graph.relations.map(r => ({
    aId: r.ends[0].entityId,
    aCard: r.ends[0].cardinality,
    bId: r.ends[1].entityId,
    bCard: r.ends[1].cardinality,
    name: r.name
  }));
}

function isMany(card: string) {
  return card.includes('*');
}

/* ======================
   Templates
====================== */

function pomXml(projectName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${projectName}</groupId>
  <artifactId>${projectName}</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>${projectName}</name>
  <description>Generated Spring Boot backend</description>
  <properties>
    <java.version>17</java.version>
    <spring.boot.version>3.3.2</spring.boot.version>
  </properties>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>\${spring.boot.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>
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
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.5.0</version>
    </dependency>
    <dependency>
      <groupId>com.fasterxml.jackson.datatype</groupId>
      <artifactId>jackson-datatype-jsr310</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
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
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>`;
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

logging:
  level:
    org.hibernate.SQL: info
`;
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
`;
}

function corsConfigJava(pkg: string): string {
  return `package ${pkg}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
  @Bean
  public WebMvcConfigurer corsConfigurer() {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
          .allowedOrigins("*")
          .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
          .allowedHeaders("*");
      }
    };
  }
}
`;
}

/* ======================
   Entity.java
====================== */

function entityJava(pkg: string, e: Entity, graph: ERGraph): string {
  const cls = pascal(e.name);

  // imports dinámicos por tipos
  const typeImports = new Set<string>([
    'jakarta.persistence.*',
    'lombok.*'
  ]);

  // campos simples
  const fields: string[] = [];
  const annosTop: string[] = ['@Entity', '@Table(name = "' + e.name + '")', '@Getter', '@Setter', '@NoArgsConstructor', '@AllArgsConstructor', '@Builder'];

  const pkAttr = findPkAttr(e);
  const pkJavaType = javaType(pkAttr.type); typeImports.add(pkJavaType);
  const pkSimple = simpleJavaType(pkJavaType);

  // PK
  fields.push(`${INDENT}@Id`);
  if (pkSimple === 'UUID') {
    fields.push(`${INDENT}@GeneratedValue`);
  } else if (pkSimple === 'Integer' || pkSimple === 'Long') {
    fields.push(`${INDENT}@GeneratedValue(strategy = GenerationType.IDENTITY)`);
  }
  fields.push(`${INDENT}private ${pkSimple} ${camel(pkAttr.name)};`);

  // Otros atributos
  for (const a of e.attributes) {
    if (a === pkAttr) continue;
    const jt = javaType(a.type); typeImports.add(jt);
    const jts = simpleJavaType(jt);
    const nullable = a.isNullable ? '' : '\n' + INDENT + '@Column(nullable = false)';
    const unique = a.isUnique ? '\n' + INDENT + '@Column(unique = true)' : '';
    const columnAnno = (!a.isNullable || a.isUnique) ? '' : '';
    const lines: string[] = [];
    if (!a.isNullable || a.isUnique) {
      let cols: string[] = [];
      if (!a.isNullable) cols.push('nullable = false');
      if (a.isUnique) cols.push('unique = true');
      lines.push(`${INDENT}@Column(${cols.join(', ')})`);
    }
    lines.push(`${INDENT}private ${jts} ${camel(a.name)};`);
    fields.push(...lines);
  }

  // Relaciones:
  // Para simplificar, recorremos graph.relations y si esta entidad participa, agregamos campo.
  const rels = getRelEdges(graph);
  const myId = e.id;

  for (const r of rels) {
    // A -- B
    const left = graph.entities.find(x => x.id === r.aId)!;
    const right = graph.entities.find(x => x.id === r.bId)!;
    const leftCls = pascal(left.name);
    const rightCls = pascal(right.name);

    // A(1) -- B(*)  => B.manyToOne(A)
    if (!isMany(r.aCard) && isMany(r.bCard)) {
      if (myId === r.bId) {
        // lado many (B) guarda FK a A
        fields.push(
`${INDENT}@ManyToOne(fetch = FetchType.LAZY)
${INDENT}@JoinColumn(name = "${left.name}_${camel(findPkAttr(left).name)}", nullable = false)
${INDENT}private ${leftCls} ${camel(left.name)};`
        );
        typeImports.add('java.util.*');
      } else if (myId === r.aId) {
        // lado one (A) tiene colección de B
        fields.push(
`${INDENT}@OneToMany(mappedBy = "${camel(left.name)}", cascade = CascadeType.ALL, orphanRemoval = false)
${INDENT}private java.util.List<${rightCls}> ${camel(right.name)}List = new java.util.ArrayList<>();`
        );
        typeImports.add('java.util.*');
      }
    }

    // A(*) -- B(1)  => A.manyToOne(B)
    if (isMany(r.aCard) && !isMany(r.bCard)) {
      if (myId === r.aId) {
        fields.push(
`${INDENT}@ManyToOne(fetch = FetchType.LAZY)
${INDENT}@JoinColumn(name = "${right.name}_${camel(findPkAttr(right).name)}", nullable = false)
${INDENT}private ${rightCls} ${camel(right.name)};`
        );
        typeImports.add('java.util.*');
      } else if (myId === r.bId) {
        fields.push(
`${INDENT}@OneToMany(mappedBy = "${camel(right.name)}", cascade = CascadeType.ALL, orphanRemoval = false)
${INDENT}private java.util.List<${leftCls}> ${camel(left.name)}List = new java.util.ArrayList<>();`
        );
        typeImports.add('java.util.*');
      }
    }

    // A(*) -- B(*)  => many-to-many
    if (isMany(r.aCard) && isMany(r.bCard)) {
      if (myId === r.aId) {
        fields.push(
`${INDENT}@ManyToMany
${INDENT}@JoinTable(
${INDENT}  name = "${e.name}_${right.name}_link",
${INDENT}  joinColumns = @JoinColumn(name = "${e.name}_${camel(findPkAttr(e).name)}"),
${INDENT}  inverseJoinColumns = @JoinColumn(name = "${right.name}_${camel(findPkAttr(right).name)}")
${INDENT})
${INDENT}private java.util.Set<${rightCls}> ${camel(right.name)}Set = new java.util.HashSet<>();`
        );
        typeImports.add('java.util.*');
      } else if (myId === r.bId) {
        // lado inverso sin @JoinTable
        fields.push(
`${INDENT}@ManyToMany(mappedBy = "${camel(right.name)}Set")
${INDENT}private java.util.Set<${leftCls}> ${camel(left.name)}Set = new java.util.HashSet<>();`
        );
        typeImports.add('java.util.*');
      }
    }
  }

  const imports = Array.from(typeImports)
    .filter(s => s.includes('.'))
    .sort()
    .map(s => `import ${s};`)
    .join('\n');

  return `package ${pkg}.entity;

${imports}

${annosTop.join('\n')}
public class ${cls} {

${fields.join('\n\n')}

}
`;
}

/* ======================
   Repository.java
====================== */

function repositoryJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name);
  const pkAttr = findPkAttr(e);
  const pkSimple = simpleJavaType(javaType(pkAttr.type));

  return `package ${pkg}.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ${pkg}.entity.${cls};

@Repository
public interface ${cls}Repository extends JpaRepository<${cls}, ${pkSimple}> {
}
`;
}

/* ======================
   Service.java
====================== */

function serviceJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name);
  const nameVar = camel(e.name);

  return `package ${pkg}.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import ${pkg}.entity.${cls};
import ${pkg}.repository.${cls}Repository;

@Service
public class ${cls}Service {
  private final ${cls}Repository repo;

  public ${cls}Service(${cls}Repository repo) {
    this.repo = repo;
  }

  public List<${cls}> findAll() { return repo.findAll(); }

  public Optional<${cls}> findById(Object id) { return repo.findById(id); }

  public ${cls} save(${cls} ${nameVar}) { return repo.save(${nameVar}); }

  public void deleteById(Object id) { repo.deleteById(id); }
}
`;
}

/* ======================
   Controller.java
====================== */

function controllerJava(pkg: string, e: Entity): string {
  const cls = pascal(e.name);
  const nameVar = camel(e.name);
  const pkAttr = findPkAttr(e);
  const pkSimple = simpleJavaType(javaType(pkAttr.type));

  return `package ${pkg}.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import ${pkg}.entity.${cls};
import ${pkg}.service.${cls}Service;

@RestController
@RequestMapping("/api/${e.name}")
public class ${cls}Controller {

  private final ${cls}Service service;

  public ${cls}Controller(${cls}Service service) {
    this.service = service;
  }

  @GetMapping
  public List<${cls}> findAll() {
    return service.findAll();
  }

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
    return service.findById(id)
      .map(existing -> {
        // TODO: mapear campos si necesitas evitar sobrescribir id
        ${nameVar}.set${pascal(pkAttr.name)}(id);
        return ResponseEntity.ok(service.save(${nameVar}));
      })
      .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable ${pkSimple} id) {
    service.deleteById(id);
    return ResponseEntity.noContent().build();
  }
}
`;
}

/* ======================
   ZIP builder
====================== */

export async function generateSpringProject(er: ERGraph, opts: SpringOpts): Promise<Blob> {
  const zip = new JSZip();
  const { packageBase, projectName } = opts;

  // paths
  const base = `src/main/java/${packageBase.replace(/\./g, '/')}`;
  const resources = `src/main/resources`;

  // core files
  zip.file('pom.xml', pomXml(projectName));
  zip.file(`${resources}/application.yml`, applicationYml());

  const appClass = pascal(projectName.replace(/[^a-zA-Z0-9]/g, ' ')) + 'Application';
  zip.file(`${base}/${appClass}.java`, mainAppJava(packageBase, appClass));
  zip.file(`${base}/config/CorsConfig.java`, corsConfigJava(packageBase));

  // por cada entidad: entity, repository, service, controller
  for (const e of er.entities) {
    zip.file(`${base}/entity/${pascal(e.name)}.java`, entityJava(packageBase, e, er));
    zip.file(`${base}/repository/${pascal(e.name)}Repository.java`, repositoryJava(packageBase, e));
    zip.file(`${base}/service/${pascal(e.name)}Service.java`, serviceJava(packageBase, e));
    zip.file(`${base}/controller/${pascal(e.name)}Controller.java`, controllerJava(packageBase, e));
  }

  return await zip.generateAsync({ type: 'blob' });
}
