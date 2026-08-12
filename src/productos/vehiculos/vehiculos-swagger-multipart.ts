const vehiculoProperties = {
  placa: {
    type: 'string',
    maxLength: 10,
    example: 'ABC1234',
  },
  numeroEconomico: {
    type: 'string',
    maxLength: 50,
    example: 'VH-001',
  },
  idMarcaVehiculo: { type: 'integer', example: 1 },
  idModeloVehiculo: { type: 'integer', example: 2 },
  anio: { type: 'integer', example: 2026 },
  color: { type: 'string', maxLength: 30, example: 'Blanco' },
  numeroSerie: {
    type: 'string',
    maxLength: 20,
    description: 'VIN',
    example: '1HGBH41JXMN109186',
  },
  idCombustible: { type: 'integer', example: 1 },
  km: { type: 'number', format: 'float', example: 12500.5 },
  capacidadLitros: { type: 'number', format: 'float', example: 45 },
  foto: {
    type: 'string',
    format: 'binary',
    description: 'Imagen principal PNG/JPEG',
  },
  fotoFrente: {
    type: 'string',
    format: 'binary',
    description: 'Fotografía frontal PNG/JPEG',
  },
  fotoTrasera: {
    type: 'string',
    format: 'binary',
    description: 'Fotografía trasera PNG/JPEG',
  },
  fotoDerecha: {
    type: 'string',
    format: 'binary',
    description: 'Fotografía lateral derecha PNG/JPEG',
  },
  fotoIzquierda: {
    type: 'string',
    format: 'binary',
    description: 'Fotografía lateral izquierda PNG/JPEG',
  },
  fotoExtra: {
    type: 'string',
    format: 'binary',
    description: 'Fotografía adicional PNG/JPEG',
  },
  tarjetaCirculacion: {
    type: 'string',
    format: 'binary',
    description: 'Tarjeta de circulación PNG/JPEG/PDF',
  },
  polizaSeguro: {
    type: 'string',
    format: 'binary',
    description: 'Póliza de seguro PNG/JPEG/PDF',
  },
  permisoCarga: {
    type: 'string',
    format: 'binary',
    description: 'Permiso de carga PNG/JPEG/PDF',
  },
} as const;

export const vehiculosCreateMultipartApiBody = {
  description:
    'Crea el producto (tipo VEHICULO) y el vehículo, y carga los archivos al bucket S3. ' +
    'Los campos de archivo son opcionales y admiten un archivo por campo.',
  schema: {
    type: 'object',
    required: ['placa'],
    properties: {
      ...vehiculoProperties,
    },
  },
} as const;

export const vehiculosUpdateMultipartApiBody = {
  description:
    'Actualización parcial. Los campos vacíos se omiten. Cada archivo nuevo ' +
    'reemplaza el archivo anterior almacenado en S3; si no se envía, se conserva.',
  schema: {
    type: 'object',
    properties: vehiculoProperties,
  },
} as const;
