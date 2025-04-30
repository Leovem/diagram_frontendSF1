import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const generarAngularProyecto = async (clases) => {
  const zip = new JSZip();
  const root = zip.folder('angular-autogenerado');

  root.file('README.md', `# Proyecto Angular Autogenerado

## Pasos para ejecutar

1. Instalar dependencias:
   npm install

2. Ejecutar la aplicación:
   npm start

Requiere tener Angular CLI instalado globalmente:
   npm install -g @angular/cli
`);

  root.file('angular.json', `{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "projects": {
    "angular-autogenerado": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/angular-autogenerado",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": "src/polyfills.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.css"],
            "scripts": []
          }
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "angular-autogenerado:build"
          }
        }
      }
    }
  }
}`);

  root.file('tsconfig.json', `{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "sourceMap": true,
    "declaration": false,
    "downlevelIteration": true,
    "experimentalDecorators": true,
    "module": "es2020",
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "es2020",
    "typeRoots": ["node_modules/@types"],
    "lib": ["es2020", "dom"]
  }
}`);

  root.file('tsconfig.app.json', `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": [
    "src/main.ts",
    "src/polyfills.ts"
  ],
  "include": [
    "src/**/*.d.ts"
  ]
}`);

  root.file('package.json', `{
  "name": "angular-autogenerado",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "ng serve",
    "build": "ng build"
  },
  "dependencies": {
    "@angular/animations": "^16.0.0",
    "@angular/common": "^16.0.0",
    "@angular/compiler": "^16.0.0",
    "@angular/core": "^16.0.0",
    "@angular/forms": "^16.0.0",
    "@angular/platform-browser": "^16.0.0",
    "@angular/platform-browser-dynamic": "^16.0.0",
    "@angular/router": "^16.0.0",
    "rxjs": "^7.8.0",
    "tslib": "^2.6.0",
    "zone.js": "^0.13.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^16.0.0",
    "@angular/cli": "^16.0.0",
    "@angular/compiler-cli": "^16.0.0",
    "typescript": "^5.0.0"
  }
}`);

  const src = root.folder('src');
  src.file('index.html', `<!DOCTYPE html><html><head><title>Angular App</title></head><body><app-root></app-root></body></html>`);
  src.file('styles.css', '');
  src.file('polyfills.ts', `import 'zone.js';`);
  src.file('main.ts', `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.config';
import { provideRouter } from '@angular/router';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)]
});
`);

  const app = src.folder('app');
  const models = app.folder('models');

  let imports = '';
  let routes = '';

  clases.forEach(clase => {
    const nombre = clase.name.toLowerCase();
    const compFolder = app.folder(nombre);

    // Modelo tipado
    models.file(`${nombre}.model.ts`, `export interface ${clase.name} {
${clase.atributos.map(attr => `  ${attr}: string;`).join('\n')}
}
`);

    // Componente TypeScript
    compFolder.file(`${nombre}.component.ts`, `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ${clase.name} } from '../models/${nombre}.model';

@Component({
  selector: 'app-${nombre}',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './${nombre}.component.html',
  styleUrls: ['./${nombre}.component.css']
})
export class ${clase.name}Component {
  atributos = ${JSON.stringify(clase.atributos)};
  
  form: ${clase.name} = {
${clase.atributos.map(attr => `    ${attr}: ''`).join(',\n')}
  };

  registros: ${clase.name}[] = [];
  editIndex: number | null = null;

  guardar() {
    if (this.editIndex !== null) {
      this.registros[this.editIndex] = { ...this.form };
      this.editIndex = null;
    } else {
      this.registros.push({ ...this.form });
    }
    this.form = {
${clase.atributos.map(attr => `      ${attr}: ''`).join(',\n')}
    };
  }

  editar(index: number) {
    this.form = { ...this.registros[index] };
    this.editIndex = index;
  }

  eliminar(index: number) {
    this.registros.splice(index, 1);
  }
}`);

    // HTML
    compFolder.file(`${nombre}.component.html`, `<h2>CRUD ${clase.name}</h2>
<form (ngSubmit)="guardar()">
  ${clase.atributos.map(attr => `<label>${attr}</label>
  <input type="text" [(ngModel)]="form.${attr}" name="${attr}">`).join('\n')}
  <button type="submit">Guardar</button>
</form>
<hr/>
<table border="1">
  <tr>
    ${clase.atributos.map(attr => `<th>${attr}</th>`).join('')}
    <th>Acciones</th>
  </tr>
  <tr *ngFor="let item of registros; let i = index">
    ${clase.atributos.map(attr => `<td>{{item.${attr}}}</td>`).join('')}
    <td>
      <button (click)="editar(i)">Editar</button>
      <button (click)="eliminar(i)">Eliminar</button>
    </td>
  </tr>
</table>`);

    // CSS Mejorado
    compFolder.file(`${nombre}.component.css`, `
/* Estilos para la tabla */
table {
  width: 100%;
  margin-top: 10px;
  border-collapse: collapse;
}

table th, table td {
  padding: 12px;
  text-align: left;
  border: 1px solid #ddd;
}

table th {
  background-color: #f1f1f1;
  font-weight: bold;
}

table tr:nth-child(even) {
  background-color: #f9f9f9;
}

table tr:hover {
  background-color: #e9e9e9;
}

/* Estilos para los inputs */
input {
  margin-bottom: 10px;
  padding: 8px;
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
}

input:focus {
  border-color: #007bff;
  outline: none;
}

/* Estilo para el formulario */
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

form button {
  padding: 10px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

form button:hover {
  background-color: #218838;
}

/* Estilo para los botones de acción */
button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background-color: #0056b3;
}

button:focus {
  outline: none;
}
`);

    imports += `import { ${clase.name}Component } from './${nombre}/${nombre}.component';\n`;
    routes += `  { path: '${nombre}', component: ${clase.name}Component },\n`;
  });

  app.file('app.config.ts', `${imports}
import { Routes } from '@angular/router';

export const routes: Routes = [
${routes}  { path: '', redirectTo: '/${clases[0].name.toLowerCase()}', pathMatch: 'full' }
];`);

  app.file('app.component.ts', `import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: \`<router-outlet></router-outlet>\`,
  styleUrls: ['./app.component.css']
})
export class AppComponent {}`);
  
  root.file('styles.css', `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f8f9fa;
}

h1 {
  color: #333;
  text-align: center;
  margin-top: 20px;
}`);
app.file('app.component.css', `/* Estilos básicos para la aplicación principal */
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f8f9fa;
  }
  
  h1 {
    color: #333;
    text-align: center;
    margin-top: 20px;
  }
  `);

  zip.generateAsync({ type: 'blob' }).then(function(content) {
    saveAs(content, 'angular-proyecto.zip');
  });
};