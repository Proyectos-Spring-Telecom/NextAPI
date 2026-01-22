import * as fs from 'fs';
import * as path from 'path';

const entitiesDir = path.join(__dirname, 'src/entities');

// Función para convertir a PascalCase
function toPascalCase(str: string): string {
  return str
    .replace(/[_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

// Expresión regular para decoradores de TypeORM
const decoratorRegex = /(@(?:Column|PrimaryGeneratedColumn|ManyToOne|OneToMany|JoinColumn|JoinTable)[^)]*\))\s*\n\s*(\w+)\s*:/g;

fs.readdirSync(entitiesDir).forEach((file) => {
  if (!file.endsWith('.ts')) return;

  const filePath = path.join(entitiesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  content = content.replace(decoratorRegex, (match, decorator, propName) => {
    const pascalName = toPascalCase(propName);
    if (propName === pascalName) return match; // Ya está en PascalCase

    modified = true;

    // Agrega name: 'PascalName' si no existe
    let updatedDecorator = decorator;
    if (!/name\s*:\s*['"`]/.test(decorator)) {
      updatedDecorator = decorator.replace(/\)$/, `, { name: '${pascalName}' })`);
    }

    return `${updatedDecorator}\n  ${pascalName}:`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✔ Actualizado: ${file}`);
  }
});