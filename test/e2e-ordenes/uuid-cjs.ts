// Jest (CommonJS) no carga el `uuid` ESM de node_modules; para la batería basta randomUUID.
import { randomUUID } from 'crypto';
export const v4 = (): string => randomUUID();
