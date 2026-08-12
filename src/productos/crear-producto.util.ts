import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Clientes } from 'src/entities/Clientes';
import { Productos } from 'src/entities/Productos';
import { EstatusEnum } from 'src/common/estatus.enum';

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

export async function crearProductoBase(
  manager: EntityManager,
  params: {
    idCliente: number;
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

  return manager.save(producto);
}
