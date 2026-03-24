/**
 * Esquemas OpenAPI para POST/PATCH clientes con multipart/form-data.
 */
export const clientesCreateMultipartApiBody = {
  description:
    '**Creación:** `rfc`, `tipoPersona`, `actaConstitutiva`, `comprobanteDomicilio` y `constanciaSituacionFiscal` son obligatorios: URL en texto o archivo PDF por cada documento. Logotipo opcional (PNG/JPEG). Si solo adjunta PDF, el body recibe un marcador interno para validación.',
  schema: {
    type: 'object',
    required: [
      'rfc',
      'tipoPersona',
      'actaConstitutiva',
      'comprobanteDomicilio',
      'constanciaSituacionFiscal',
    ],
    properties: {
      idPadre: {
        type: 'string',
        description: 'ID cliente padre (número como texto en form-data)',
        example: '1',
      },
      rfc: { type: 'string', example: 'XAXX010101000' },
      tipoPersona: {
        type: 'string',
        description: '1 = Física, 2 = Moral',
        enum: ['1', '2'],
        example: '1',
      },
      nombre: { type: 'string' },
      apellidoPaterno: { type: 'string' },
      apellidoMaterno: { type: 'string' },
      telefono: { type: 'string' },
      correo: { type: 'string' },
      sitioWeb: { type: 'string' },
      estado: { type: 'string' },
      municipio: { type: 'string' },
      colonia: { type: 'string' },
      calle: { type: 'string' },
      entreCalles: { type: 'string' },
      numeroExterior: { type: 'string' },
      numeroInterior: { type: 'string' },
      cp: { type: 'string' },
      nombreEncargado: { type: 'string' },
      telefonoEncargado: { type: 'string' },
      correoEncargado: { type: 'string' },
      actaConstitutiva: {
        type: 'string',
        format: 'binary',
        description: 'Archivo PDF (alternativa a enviar URL como campo texto homónimo)',
      },
      comprobanteDomicilio: {
        type: 'string',
        format: 'binary',
        description: 'Archivo PDF',
      },
      constanciaSituacionFiscal: {
        type: 'string',
        format: 'binary',
        description: 'Archivo PDF',
      },
      logotipo: {
        type: 'string',
        format: 'binary',
        description: 'Imagen PNG o JPEG',
      },
      estatus: {
        type: 'string',
        description: '0 o 1 (opcional al crear)',
        example: '1',
      },
    },
  },
} as const;

/** PATCH: todos los campos opcionales */
export const clientesUpdateMultipartApiBody = {
  description:
    'Actualización parcial multipart. Solo envíe los campos a modificar. Archivos nuevos reemplazan los existentes en S3 (updateFile).',
  schema: {
    type: 'object',
    properties: {
      ...clientesCreateMultipartApiBody.schema.properties,
    },
  },
} as const;
