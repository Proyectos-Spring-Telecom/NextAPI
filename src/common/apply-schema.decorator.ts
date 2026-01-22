import { getMetadataArgsStorage } from 'typeorm';

export function applySchema(target: Function) {
  const schemaName = process.env.DB_DATABASE || 'TAE'; // default si no hay variable
  const table = getMetadataArgsStorage().tables.find(t => t.target === target);
  if (table) {
    table.schema = schemaName;
  }
}
