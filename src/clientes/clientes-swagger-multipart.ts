/**
 * Esquemas OpenAPI para POST/PATCH clientes con multipart/form-data.
 */
export const clientesCreateMultipartApiBody = {
  description:
    '**Creación:** `rfc`, `tipoPersona`, documentos (acta/comprobante/constancia) y **`numerosEmergencia` (mín. 1)** son obligatorios. ' +
    '`numerosEmergencia` se envía como JSON string en form-data. Logotipo opcional. **No envíe `estatus`**.',
  schema: {
    type: 'object',
    required: [
      'rfc',
      'tipoPersona',
      'actaConstitutiva',
      'comprobanteDomicilio',
      'constanciaSituacionFiscal',
      'numerosEmergencia',
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
      numerosEmergencia: {
        type: 'string',
        description:
          'JSON string con al menos un contacto. Campos: telefono (obligatorio), nombre, descripcion, prioridad.',
        example:
          '[{"telefono":"5512345678","nombre":"Central de monitoreo","descripcion":"Línea 24/7","prioridad":1}]',
      },
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
    },
  },
} as const;

/** PATCH: todos los campos opcionales (sin `estatus`; usar `PATCH /clientes/estatus/:id`) */
export const clientesUpdateMultipartApiBody = {
  description:
    'Actualización parcial multipart. Solo envíe los campos a modificar. Archivos nuevos reemplazan los existentes en S3 (updateFile). **No incluya `estatus`** — use `PATCH /clientes/estatus/:id`.',
  schema: {
    type: 'object',
    properties: {
      ...Object.fromEntries(
        Object.entries(clientesCreateMultipartApiBody.schema.properties).filter(
          ([key]) => key !== 'numerosEmergencia',
        ),
      ),
    },
  },
} as const;
