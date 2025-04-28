import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const generarAngularProyecto = async (clases) => {
  const zip = new JSZip();

  // 1. Estructura base
  const root = zip.folder('angular-autogenerado');
  root.file('README.md', `# Proyecto Angular Autogenerado

## Pasos para ejecutar

1. Instalar dependencias:
   npm install

2. Ejecutar la aplicación:
   ng serve --open

Requiere tener Angular CLI instalado globalmente:
   npm install -g @angular/cli
`);

  root.file('angular.json', '{\n  "version": 1,\n  "projects": {\n    "angular-autogenerado": {\n      "projectType": "application"\n    }\n  }\n}');

  root.file('package.json', `{
  "name": "angular-autogenerado",
  "version": "1.0.0",
  "scripts": {
    "start": "ng serve"
  },
  "dependencies": {
    "@angular/core": "^16.0.0",
    "@angular/cli": "^16.0.0",
    "rxjs": "^7.0.0"
  }
}`);

  root.file('tsconfig.json', '{ "compilerOptions": { "target": "es2020" } }');

  const src = root.folder('src');
  src.file('index.html', '<!DOCTYPE html><html><body><app-root></app-root></body></html>');
  src.file('styles.css', '');
  src.file('main.ts', `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.config';
import { provideRouter } from '@angular/router';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)]
});`);

  const app = src.folder('app');

  // Configuración de rutas
  let imports = '';
  let routes = '';

  clases.forEach(clase => {
    const nombre = clase.name.toLowerCase();
    const compFolder = app.folder(nombre);

    compFolder.file(`${nombre}.component.ts`, `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-${nombre}',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './${nombre}.component.html',
  styleUrls: ['./${nombre}.component.css']
})
export class ${clase.name}Component {
  atributos = ${JSON.stringify(clase.atributos)};
  form = {};
  registros = [];
  editIndex = null;

  guardar() {
    if (this.editIndex !== null) {
      this.registros[this.editIndex] = { ...this.form };
      this.editIndex = null;
    } else {
      this.registros.push({ ...this.form });
    }
    this.form = {};
  }

  editar(index) {
    this.form = { ...this.registros[index] };
    this.editIndex = index;
  }

  eliminar(index) {
    this.registros.splice(index, 1);
  }
}`);

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

    compFolder.file(`${nombre}.component.css`, 'table { width: 100%; margin-top: 10px; } input { margin-bottom: 5px; display: block; }');

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
  templateUrl: './app.component.html'
})
export class AppComponent {}`);

  app.file('app.component.html', `<nav>
  ${clases.map(c => `<a routerLink="/${c.name.toLowerCase()}">${c.name}</a>`).join(' | ')}
</nav>
<router-outlet></router-outlet>`);

  // 4. Generar ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'angular-autogenerado.zip');
};