/**
 * Esquemas OpenAPI para POST/PATCH usuarios con multipart/form-data.
 * Mismo enfoque que clientes-swagger-multipart.ts.
 */
export const usuariosCreateMultipartApiBody = {
  description:
    '**Creación:** datos del usuario y arreglos de IDs como texto: JSON `"[1,2,3]"`, coma-separado `1,2,3` o valor único `2`. `fotoPerfil` opcional: URL en texto o archivo PNG/JPEG. `emailConfirmado` y `estatus` se asignan en servidor (1).',
  schema: {
    type: 'object',
    required: [
      'userName',
      'passwordHash',
      'nombre',
      'apellidoPaterno',
      'idRol',
      'idCliente',
      'permisosIds',
    ],
    properties: {
      userName: {
        type: 'string',
        example: 'operador@empresa.com',
      },
      passwordHash: {
        type: 'string',
        format: 'password',
        example: 'P@ssword123',
      },
      nombre: { type: 'string', example: 'María' },
      apellidoPaterno: { type: 'string', example: 'García' },
      apellidoMaterno: { type: 'string', example: 'López' },
      telefono: { type: 'string', example: '5512345678' },
      idRol: {
        type: 'string',
        description: 'ID del rol (número como texto en form-data)',
        example: '3',
      },
      idCliente: {
        type: 'string',
        description: 'ID del cliente (número como texto en form-data)',
        example: '6',
      },
      permisosIds: {
        type: 'string',
        description: 'IDs separados por coma, JSON "[3,7,15]" o un solo ID "3"',
        example: '1,2,3,4,5',
      },
      instalacionesIds: {
        type: 'string',
        description: 'Opcional. Coma-separado, JSON o un ID. Vacío = omitir',
        example: '1,4',
      },
      panelesAlarmaIds: {
        type: 'string',
        description: 'Opcional. Coma-separado, JSON o un ID',
        example: '2',
      },
      solucionesIds: {
        type: 'string',
        description: 'Opcional. Coma-separado, JSON o un ID',
        example: '2',
      },
      fotoPerfil: {
        type: 'string',
        format: 'binary',
        description:
          'Imagen PNG o JPEG (alternativa a enviar URL como campo texto homónimo)',
      },
    },
  },
} as const;

export const usuariosUpdateMultipartApiBody = {
  description:
    'Actualización parcial multipart. Campos vacíos (`Send empty value` en Swagger) = no modificar. Arreglos: omitir/vacío = no cambiar; `[]` = desactivar todas; `1,2,3` o `[1,2,3]` = sincronizar. Archivo nuevo reemplaza imagen en S3.',
  schema: {
    type: 'object',
    properties: {
      nombre: {
        type: 'string',
        description: 'Omitir o vacío = no modificar',
      },
      apellidoPaterno: {
        type: 'string',
        description: 'Omitir o vacío = no modificar',
      },
      apellidoMaterno: {
        type: 'string',
        description: 'Omitir o vacío = no modificar',
      },
      telefono: {
        type: 'string',
        description: 'Omitir o vacío = no modificar',
      },
      idRol: {
        type: 'string',
        description: 'ID del rol. Omitir o vacío = no modificar',
      },
      idCliente: {
        type: 'string',
        description: 'ID del cliente. Omitir o vacío = no modificar',
      },
      permisosIds: {
        type: 'string',
        description:
          'Omitir o vacío = no modificar. [] = desactivar todos. Ej: 1,2,3 o [1,2,3]',
      },
      instalacionesIds: {
        type: 'string',
        description:
          'Omitir o vacío = no modificar. [] = desactivar todas.',
      },
      panelesAlarmaIds: {
        type: 'string',
        description:
          'Omitir o vacío = no modificar. [] = desactivar todos.',
      },
      solucionesIds: {
        type: 'string',
        description:
          'Omitir o vacío = no modificar. [] = desactivar todas.',
      },
      fotoPerfil: {
        type: 'string',
        format: 'binary',
        description:
          'Imagen PNG o JPEG. Sin archivo = conservar imagen actual',
      },
    },
  },
} as const;
