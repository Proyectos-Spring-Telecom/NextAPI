import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EstatusEnum } from 'src/common/estatus.enum';
import { registrarMovimiento } from 'src/motor-activos/motor-activos.service';

const CODIGOS_TIPO_PANEL = ['PANEL', 'PANEL_ALARMA', 'PAN'];
const CODIGOS_TIPO_TRACKCAM = ['TRACKCAM'];
const CODIGOS_TIPO_RELOJ = ['RELOJ INTELIGENTE', 'RELOJ'];

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

export async function obtenerTipoReloj(
  manager: EntityManager,
): Promise<CatTipoDispositivo> {
  const tipo = await manager
    .getRepository(CatTipoDispositivo)
    .createQueryBuilder('t')
    .where('UPPER(t.codigo) IN (:...codigos)', { codigos: CODIGOS_TIPO_RELOJ })
    .getOne();
  if (!tipo) {
    throw new BadRequestException(
      'No hay CatTipoDispositivo con codigo RELOJ INTELIGENTE',
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
    /** NULL = almacén; con cliente = reservado a él (fase B). */
    idCliente: number | null;
    /** Quien da de alta (historial del recurso). */
    idUsuario: number | null;
    idTipoDispositivo: number;
    numeroSerie: string;
    imei?: string | null;
    eco?: string | null;
    camara?: number;
    idMarca?: number | null;
    idModelo?: number | null;
  },
): Promise<Dispositivos> {
  if (params.idCliente != null) await assertClienteExiste(manager, params.idCliente);
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
    idCliente: params.idCliente ?? null,
    idTipoDispositivo: params.idTipoDispositivo,
    numeroSerie: params.numeroSerie,
    imei: params.imei ?? null,
    eco: params.eco ?? null,
    camara: params.camara != null ? Number(params.camara) : 0,
    idMarca: params.idMarca ?? null,
    idModelo: params.idModelo ?? null,
    estatus: EstatusEnum.ACTIVO,
  });

  const saved = await manager.save(dispositivo);
  await registrarMovimiento(
    manager,
    {
      tipo: 'dispositivo',
      id: Number(saved.id),
      accion: 'alta',
      estatusAnterior: null,
      estatusNuevo: EstatusEnum.ACTIVO,
      idClienteAnterior: null,
      idClienteNuevo: params.idCliente ?? null,
    },
    { idUsuario: params.idUsuario, origen: 'api' },
  );
  return saved;
}
