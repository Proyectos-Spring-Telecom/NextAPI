import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Clientes } from 'src/entities/Clientes';
import { Productos } from 'src/entities/Productos';
import { EstatusEnum } from 'src/common/estatus.enum';
import { registrarMovimiento } from 'src/motor-activos/motor-activos.service';

export async function assertClienteExiste(
  manager: EntityManager,
  idCliente: number,
): Promise<void> {
  const cliente = await manager.findOne(Clientes, {
    where: { id: idCliente },
  });
  if (!cliente) {
    throw new BadRequestException('IdCliente no existe');
  }
}

/**
 * Crea el registro base en `Productos`. Solo valida que el cliente exista: el
 * alcance (`assertClienteDestino`) lo valida antes cada servicio de alta.
 */
export async function crearProductoBase(
  manager: EntityManager,
  params: {
    idCliente: number;
    /** Quien da de alta (historial del recurso). */
    idUsuario: number | null;
    idTipoProducto: number;
    nombre: string | null;
  },
): Promise<Productos> {
  await assertClienteExiste(manager, params.idCliente);

  const tipo = await manager.findOne(CatTipoProducto, {
    where: { id: params.idTipoProducto },
  });
  if (!tipo) {
    throw new BadRequestException(
      'IdTipoProducto no existe en CatTipoProducto',
    );
  }

  const producto = manager.create(Productos, {
    idCliente: params.idCliente,
    idTipoProducto: params.idTipoProducto,
    nombre: params.nombre,
    estatus: EstatusEnum.ACTIVO,
  });

  const saved = await manager.save(producto);
  await registrarMovimiento(
    manager,
    {
      tipo: 'producto',
      id: Number(saved.id),
      accion: 'alta',
      estatusAnterior: null,
      estatusNuevo: EstatusEnum.ACTIVO,
      idClienteAnterior: null,
      idClienteNuevo: params.idCliente,
    },
    { idUsuario: params.idUsuario, origen: 'api' },
  );
  return saved;
}
