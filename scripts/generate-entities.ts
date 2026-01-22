import { execSync } from 'child_process';
import * as Joi from 'joi';
import * as dotenv from 'dotenv';

// Cargar .env
dotenv.config();

// Esquema de validación con Joi
const envSchema = Joi.object({
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow(''),
  DB_DATABASE: Joi.string().required(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  console.error(`❌ Error en variables de entorno: ${error.message}`);
  process.exit(1);
}

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = envVars;

// Comando para generar entidades
const cmd = `npx typeorm-model-generator \
  -h ${DB_HOST} \
  -d ${DB_DATABASE} \
  -u ${DB_USER} \
  -x ${DB_PASSWORD || ''} \
  -p ${DB_PORT} \
  -e mysql \
  -o ./src/entities \
  --noConfig`;

console.log('🚀 Generando entidades desde la base de datos...');
execSync(cmd, { stdio: 'inherit' });
console.log('✅ Entidades generadas en src/entities/');