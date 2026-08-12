import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Productos } from 'src/entities/Productos';
import { EstatusEnum } from 'src/common/estatus.enum';

export async function crearProductoBase(
  manager: EntityManager,
  params: {
    idCliente: number;
    idTipoProducto: number;
    nombre: string | null;
  },
): Promise<Productos> {
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
