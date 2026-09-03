import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EstatusEnum } from 'src/common/estatus.enum';

const CODIGOS_TIPO_PANEL = ['PANEL', 'PANEL_ALARMA', 'PAN'];
const CODIGOS_TIPO_TRACKCAM = ['TRACKCAM'];

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

export async function obtenerTipoPanelAlarma(
  manager: EntityManager,
): Promise<CatTipoDispositivo> {
  const tipo = await manager
    .getRepository(CatTipoDispositivo)
    .createQueryBuilder('t')
    .where('UPPER(t.codigo) IN (:...codigos)', { codigos: CODIGOS_TIPO_PANEL })
    .getOne();
  if (!tipo) {
    throw new BadRequestException(
      'No hay CatTipoDispositivo con codigo PANEL / PANEL_ALARMA',
    );
  }
  return tipo;
}

export async function obtenerTipoTrackcam(
  manager: EntityManager,
): Promise<CatTipoDispositivo> {
  const tipo = await manager
    .getRepository(CatTipoDispositivo)
    .createQueryBuilder('t')
    .where('UPPER(t.codigo) IN (:...codigos)', {
      codigos: CODIGOS_TIPO_TRACKCAM,
    })
    .getOne();
  if (!tipo) {
    throw new BadRequestException(
      'No hay CatTipoDispositivo con codigo TRACKCAM',
    );
  }
  return tipo;
}

export async function validarFksDispositivo(
  manager: EntityManager,
  dto: {
    idTipoDispositivo?: number;
    idMarca?: number | null;
    idModelo?: number | null;
  },
): Promise<void> {
  if (dto.idTipoDispositivo !== undefined) {
    const tipo = await manager.findOne(CatTipoDispositivo, {
      where: { id: dto.idTipoDispositivo },
    });
    if (!tipo) {
      throw new BadRequestException(
        'IdTipoDispositivo no existe en CatTipoDispositivo',
      );
    }
  }
  if (dto.idMarca != null) {
    const marca = await manager.findOne(CatMarcas, {
      where: { id: dto.idMarca },
    });
    if (!marca) {
      throw new BadRequestException('IdMarca no existe en CatMarcas');
    }
  }
  if (dto.idModelo != null) {
    const modelo = await manager.findOne(CatModelos, {
      where: { id: dto.idModelo },
    });
    if (!modelo) {
      throw new BadRequestException('IdModelo no existe en CatModelos');
    }
    if (
      dto.idMarca != null &&
      Number(modelo.idCatMarcas) !== Number(dto.idMarca)
    ) {
      throw new BadRequestException(
        'El modelo no pertenece a la marca indicada',
      );
    }
  }
}

export async function crearDispositivoBase(
  manager: EntityManager,
  params: {
    idCliente: number;
    idTipoDispositivo: number;
    numeroSerie: string;
    imei?: number | null;
    eco?: string | null;
    idMarca?: number | null;
    idModelo?: number | null;
  },
): Promise<Dispositivos> {
  await assertClienteExiste(manager, params.idCliente);
  await validarFksDispositivo(manager, {
    idTipoDispositivo: params.idTipoDispositivo,
    idMarca: params.idMarca,
    idModelo: params.idModelo,
  });

  const existeNumeroSerie = await manager.findOne(Dispositivos, {
    where: { numeroSerie: params.numeroSerie },
  });
  if (existeNumeroSerie) {
    throw new BadRequestException('El número de serie ya existe');
  }

  if (params.imei != null) {
    const existeImei = await manager.findOne(Dispositivos, {
      where: { imei: params.imei },
    });
    if (existeImei) {
      throw new BadRequestException('El IMEI ya está registrado');
    }
  }

  const dispositivo = manager.create(Dispositivos, {
    idCliente: params.idCliente,
    idTipoDispositivo: params.idTipoDispositivo,
    numeroSerie: params.numeroSerie,
    imei: params.imei ?? null,
    eco: params.eco ?? null,
    idMarca: params.idMarca ?? null,
    idModelo: params.idModelo ?? null,
    estatus: EstatusEnum.ACTIVO,
  });

  return manager.save(dispositivo);
}
