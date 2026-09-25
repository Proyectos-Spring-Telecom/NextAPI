export const licenciaCreateMultipartApiBody = {
  description:
    'Alta de licencia para un operador. `licencia` (documento) es obligatoria: URL o archivo PNG/JPEG/PDF. ' +
    'Único por `(idOperador, idTipoLicencia)` y por `numeroLicencia`.',
  schema: {
    type: 'object',
    required: [
      'numeroLicencia',
      'idTipoLicencia',
      'idCategoriaLicencia',
      'fechaExpedicion',
      'fechaVencimiento',
      'licencia',
    ],
    properties: {
      numeroLicencia: { type: 'string', example: 'A12345678' },
      idTipoLicencia: { type: 'string', example: '1' },
      idCategoriaLicencia: { type: 'string', example: '1' },
      fechaExpedicion: { type: 'string', example: '2024-01-15' },
      fechaVencimiento: { type: 'string', example: '2028-01-15' },
      licencia: {
        type: 'string',
        format: 'binary',
        description: 'Documento PNG/JPEG/PDF o URL texto',
      },
    },
  },
} as const;

export const licenciaUpdateMultipartApiBody = {
  description:
    'Actualización parcial de licencia. Archivo `licencia` nuevo reemplaza en S3.',
  schema: {
    type: 'object',
    properties: {
      ...licenciaCreateMultipartApiBody.schema.properties,
      estatus: {
        type: 'string',
        enum: ['0', '1'],
        description: 'Opcional; preferible PATCH .../licencias/estatus/:id',
      },
    },
  },
} as const;
