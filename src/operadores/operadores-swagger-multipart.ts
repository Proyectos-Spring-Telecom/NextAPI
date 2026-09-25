/**
 * Esquemas OpenAPI para POST/PATCH operadores con multipart/form-data.
 */
export const operadoresCreateMultipartApiBody = {
  description:
    '**Creación:** `multipart/form-data`. `identificacion` y `licencia` son obligatorias (URL o archivo PNG/JPEG/PDF). ' +
    'Foto, comprobante, certificado médico y antecedentes son opcionales (URL o archivo). ' +
    'Incluye datos de la primera licencia. **No envíe `estatus`** — use `PATCH /operadores/estatus/:id`.',
  schema: {
    type: 'object',
    required: [
      'idUsuario',
      'fechaNacimiento',
      'curp',
      'nss',
      'contactoEmergenciaNombre',
      'contactoEmergenciaTelefono',
      'identificacion',
      'numeroLicencia',
      'idTipoLicencia',
      'idCategoriaLicencia',
      'fechaExpedicion',
      'fechaVencimiento',
      'licencia',
    ],
    properties: {
      idUsuario: {
        type: 'string',
        description: 'ID de Usuarios (número como texto en form-data)',
        example: '10',
      },
      fechaNacimiento: {
        type: 'string',
        example: '1990-05-15',
      },
      curp: { type: 'string', example: 'GARM900515HDFLRN09' },
      nss: { type: 'string', example: '12345678901' },
      contactoEmergenciaNombre: { type: 'string' },
      contactoEmergenciaTelefono: { type: 'string' },
      identificacion: {
        type: 'string',
        format: 'binary',
        description:
          'INE / Pasaporte: archivo PNG/JPEG/PDF (alternativa: URL como campo texto homónimo)',
      },
      foto: {
        type: 'string',
        format: 'binary',
        description: 'Fotografía: PNG/JPEG/PDF o URL texto',
      },
      comprobanteDomicilio: {
        type: 'string',
        format: 'binary',
        description: 'Comprobante: PNG/JPEG/PDF o URL texto',
      },
      certificadoMedico: {
        type: 'string',
        format: 'binary',
        description: 'Certificado médico: PNG/JPEG/PDF o URL texto',
      },
      antecedentesNoPenales: {
        type: 'string',
        format: 'binary',
        description: 'Antecedentes: PNG/JPEG/PDF o URL texto',
      },
      numeroLicencia: { type: 'string' },
      idTipoLicencia: {
        type: 'string',
        description: 'CatTipoLicencia.Id',
        example: '1',
      },
      idCategoriaLicencia: {
        type: 'string',
        description: 'CatCategoriaLicencia.Id',
        example: '1',
      },
      fechaExpedicion: { type: 'string', example: '2024-01-15' },
      fechaVencimiento: { type: 'string', example: '2028-01-15' },
      licencia: {
        type: 'string',
        format: 'binary',
        description:
          'Documento de la licencia: PNG/JPEG/PDF (alternativa: URL como campo texto homónimo)',
      },
    },
  },
} as const;

export const operadoresUpdateMultipartApiBody = {
  description:
    'Actualización parcial multipart. Solo envíe los campos a modificar. ' +
    'Archivos nuevos reemplazan los existentes en S3 (`updateFile`). ' +
    '**No incluya `estatus`** — use `PATCH /operadores/estatus/:id`.',
  schema: {
    type: 'object',
    properties: {
      ...Object.fromEntries(
        Object.entries(operadoresCreateMultipartApiBody.schema.properties).filter(
          ([key]) =>
            ![
              'numeroLicencia',
              'idTipoLicencia',
              'idCategoriaLicencia',
              'fechaExpedicion',
              'fechaVencimiento',
              'licencia',
            ].includes(key),
        ),
      ),
    },
  },
} as const;
