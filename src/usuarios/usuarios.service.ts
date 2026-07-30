import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import * as bcrypt from 'bcrypt';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ClientesService } from 'src/clientes/clientes.service';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { UsuarioPanelAlarma } from 'src/entities/UsuarioPanelAlarma';
import { AsignacionSoluciones } from 'src/entities/AsignacionSoluciones';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Soluciones } from 'src/entities/Soluciones';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Clientes } from 'src/entities/Clientes';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';
import { UpdateMiPinDto } from './dto/update-mi-pin.dto';
import { SetFaceAuthDto } from './dto/set-face-auth.dto';
import { MailService } from 'src/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { S3Service } from 'src/s3/s3.service';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly clientesService: ClientesService,
    @InjectRepository(UsuariosPermisos)
    private usuariosPermisosRepository: Repository<UsuariosPermisos>,
    private readonly emailService: MailService,
    private readonly jwtService: JwtService,
    private readonly tenantFilter: TenantFilterService,
    private readonly s3Service: S3Service,
    private readonly authService: AuthService,
  ) {}

  // ========================================
  // 🔹 OBTENER USUARIOS POR PAGINACIÓN
  // ========================================
  async getAllUsuario(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      const rolNum = Number(rol);
      const tenant = await this.tenantFilter.build(rol, cliente, 'u', 'IdCliente');
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
      const excludeSelf = rolNum === 1 || rolNum === 2 ? '' : ' AND u.Id != ? ';
      const usuariosSql = `
SELECT
  u.Id AS Id,
  u.UserName AS UserName,
  u.Nombre AS Nombre,
  u.ApellidoPaterno AS ApellidoPaterno,
  u.ApellidoMaterno AS ApellidoMaterno,
  u.Telefono AS Telefono,
  u.UltimoLogin AS UltimoLogin,
  u.FotoPerfil AS FotoPerfil,
  u.FechaCreacion AS FechaCreacion,
  u.FechaActualizacion AS FechaActualizacion,
  u.Estatus AS estatus,
  u.IdRol AS IdRol,
  r.Nombre AS RolNombre,
  r.Descripcion AS RolDescripcion,
  u.IdCliente AS IdCliente,
  c.Nombre AS clienteNombre,
  c.ApellidoPaterno AS ApellidoPaternoCliente,
  c.ApellidoMaterno AS ApellidoMaternoCliente,
  c.Estatus AS EstatusCliente
FROM Usuarios u
INNER JOIN Roles r ON u.IdRol = r.Id
LEFT JOIN Clientes c ON u.IdCliente = c.Id
WHERE 1 = 1
${tenant.sql}
${excludeSelf}
ORDER BY u.Id DESC
LIMIT ? OFFSET ?`;

      const usuariosParams = [
        ...tenant.params,
        ...(excludeSelf ? [idUser] : []),
        limit,
        offset,
      ];
      const usuarios = await this.usuarioRepository.query(usuariosSql, usuariosParams);

      const totalSql = `
SELECT COUNT(*) AS total
FROM Usuarios u
INNER JOIN Clientes c ON u.IdCliente = c.Id
WHERE 1 = 1
${tenant.sql}
${excludeSelf}`;
      const totalParams = [...tenant.params, ...(excludeSelf ? [idUser] : [])];
      const totalResult = await this.usuarioRepository.query(totalSql, totalParams);

      const total = Number(totalResult[0]?.total || 0);

      const data = usuarios.map((item) => ({
        ...item,
        Id: Number(item.Id),
        IdRol: Number(item.IdRol),
        IdCliente: Number(item.IdCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
        paginated: {
          total: total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener la paginación de usuarios.',
        error: (error as Error)?.message,
      });
    }
  }

  //Obtener todos los usuarios
  // ========================================
  // 🔹 OBTENER LISTADO DE USUARIOS
  // ========================================
  async getAllListUsuarios(cliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.build(rol, cliente, 'u', 'IdCliente');
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const usuarios = await this.usuarioRepository.query(
        `
SELECT
  u.Id AS Id,
  u.UserName AS UserName,
  u.Nombre AS Nombre,
  u.ApellidoPaterno AS ApellidoPaterno,
  u.ApellidoMaterno AS ApellidoMaterno,
  u.Telefono AS Telefono,
  u.UltimoLogin AS UltimoLogin,
  u.FotoPerfil AS FotoPerfil,
  u.FechaCreacion AS FechaCreacion,
  u.FechaActualizacion AS FechaActualizacion,
  u.Estatus AS estatus,
  u.IdRol AS IdRol,
  r.Nombre AS RolNombre,
  r.Descripcion AS RolDescripcion,
  u.IdCliente AS IdCliente,
  c.Nombre AS clienteNombre,
  c.ApellidoPaterno AS ApellidoPaternoCliente,
  c.ApellidoMaterno AS ApellidoMaternoCliente,
  c.Estatus AS EstatusCliente
FROM Usuarios u
INNER JOIN Roles r ON u.IdRol = r.Id
LEFT JOIN Clientes c ON u.IdCliente = c.Id
WHERE u.Estatus = 1
${tenant.sql}
ORDER BY u.Id DESC
`,
        [...tenant.params],
      );

      const data = usuarios.map((item) => ({
        ...item,
        Id: Number(item.Id),
        IdRol: Number(item.IdRol),
        IdCliente: Number(item.IdCliente),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener el listado de usuarios.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER LISTADO DE USUARIOS POR CLIENTE
  // ========================================
  async getAllListUsuariosCliente(
    id: number,
    cliente: number,
  ): Promise<ApiResponseCommon> {
    try {
      const usuarios = await this.usuarioRepository.find({
        where: { estatus: 1, idCliente: cliente },
      });
      if (usuarios.length === 0) {
        throw new NotFoundException('No se encontraron usuarios.');
      }
      const usuariosSanitizados = usuarios.map(
        ({
          passwordHash,
          pinHash,
          tokenHash,
          tokenExpira,
          tokenHashAdmin,
          nivelAcceso,
          ...rest
        }) => ({
          ...rest,
          id: Number(rest.id),
          idRol: Number(rest.idRol),
          idCliente: Number(rest.idCliente),
        }),
      );
      const result: ApiResponseCommon = {
        data: usuariosSanitizados,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message:
          'Se produjo un error al intentar obtener los usuarios asociados al cliente.',
        error: (error as Error)?.message,
      });
    }
  }

  //Obtener el usuario por ID
  // ========================================
  // 🔹 OBTENER USUARIOS POR ID
  // ========================================
  async getUsuarioByID(id: number, cliente: number, rol: number) {
    try {
      let usuarioData;
      const rolNum = Number(rol);
      const selectUsuario = `
SELECT
  u.Id AS id,
  u.UserName AS userName,
  u.Nombre AS nombre,
  u.ApellidoPaterno AS apellidoPaterno,
  u.ApellidoMaterno AS apellidoMaterno,
  u.Telefono AS telefono,
  u.UltimoLogin AS ultimoLogin,
  u.FotoPerfil AS fotoPerfil,
  u.FechaCreacion AS fechaCreacion,
  u.FechaActualizacion AS fechaActualizacion,
  u.Estatus AS estatus,
  u.IdRol AS idRol,
  r.Nombre AS rolNombre,
  r.Descripcion AS rolDescripcion,
  u.IdCliente AS idCliente,
  c.Nombre AS clienteNombre,
  c.ApellidoPaterno AS apellidoPaternoCliente,
  c.ApellidoMaterno AS apellidoMaternoCliente,
  c.Estatus AS estatusCliente
FROM Usuarios u
INNER JOIN Roles r ON u.IdRol = r.Id
LEFT JOIN Clientes c ON u.IdCliente = c.Id`;

      if (rolNum === 1 || rolNum === 2) {
        usuarioData = await this.usuarioRepository.query(
          `${selectUsuario}
WHERE u.Id = ?
ORDER BY u.Id DESC`,
          [id],
        );
      } else {
        const tenant = await this.tenantFilter.build(rol, cliente, 'u', 'IdCliente');
        if (tenant.sinAcceso) {
          usuarioData = [];
        } else {
          usuarioData = await this.usuarioRepository.query(
            `${selectUsuario}
WHERE u.Id = ?
${tenant.sql}
AND u.Estatus = 1
ORDER BY u.Id DESC`,
            [id, ...tenant.params],
          );
        }
      }

      if (usuarioData.length === 0) {
        throw new NotFoundException('Usuario no encontrado.');
      }
      const usuario = usuarioData.map((item) => ({
        ...item,
        id: Number(item.id),
        idRol: Number(item.idRol),
        idCliente: Number(item.idCliente),
      }));

      const permisoData = await this.usuariosPermisosRepository.find({
        where: { idUsuario: id, estatus: 1 },
      });

      const permiso = permisoData.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idPermiso: Number(item.idPermiso),
      }));

      return { data: { usuario, permiso } };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener al usuario.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 CREACION DE USUARIOS (transacción)
  // ========================================
  async createUsuario(
    createUsuarioDto: CreateUsuarioDto,
    idUser: string,
    fileFotoPerfil?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const usuarioRepo = queryRunner.manager.getRepository(Usuarios);
    const permisosRepo = queryRunner.manager.getRepository(UsuariosPermisos);
    const usuariosInstalacionesRepo =
      queryRunner.manager.getRepository(UsuariosInstalaciones);
    const usuarioPanelAlarmaRepo = queryRunner.manager.getRepository(UsuarioPanelAlarma);
    const asignacionSolucionesRepo =
      queryRunner.manager.getRepository(AsignacionSoluciones);

    try {
      const existUsuario = await usuarioRepo.findOne({
        where: { userName: createUsuarioDto.userName },
      });
      if (existUsuario) {
        throw new BadRequestException('El usuario ya se encuentra registrado.');
      }

      const clientesRepo = queryRunner.manager.getRepository(Clientes);
      const cliente = await clientesRepo.findOne({
        where: { id: createUsuarioDto.idCliente },
      });
      if (!cliente) {
        throw new BadRequestException('El cliente proporcionado no existe.');
      }

      const {
        permisosIds,
        instalacionesIds = [],
        panelesAlarmaIds = [],
        solucionesIds = [],
        fotoPerfil: dtoFotoPerfil,
        ...usuarioData
      } = createUsuarioDto;

      const permisosIdsUnicos = [...new Set(permisosIds ?? [])];
      const instalacionesIdsUnicos = [...new Set(instalacionesIds ?? [])];
      const panelesAlarmaIdsUnicos = [...new Set(panelesAlarmaIds ?? [])];
      const solucionesIdsUnicos = [...new Set(solucionesIds ?? [])];

      const urlFromBody = (v: string | null | undefined) =>
        v && String(v).trim() ? String(v).trim() : null;

      let fotoPerfil = urlFromBody(dtoFotoPerfil);

      if (fileFotoPerfil) {
        const { url } = await this.s3Service.uploadFile(
          fileFotoPerfil,
          'usuarios',
          Number(idUser),
          EnumModulos.USUARIOS,
        );
        fotoPerfil = url;
      }

      const hashedPassword = await bcrypt.hash(createUsuarioDto.passwordHash, 10);

      const newUser = usuarioRepo.create({
        ...usuarioData,
        ...(fotoPerfil != null ? { fotoPerfil } : {}),
        passwordHash: hashedPassword,
        emailConfirmado: 1,
        estatus: 1,
      });

      const userSave = await usuarioRepo.save(newUser);

      if (permisosIdsUnicos.length > 0) {
        const usuariosPermisos = permisosIdsUnicos.map((permisoId) =>
          permisosRepo.create({
            idUsuario: userSave.id,
            idPermiso: permisoId,
          }),
        );
        await permisosRepo.save(usuariosPermisos);
      }

      if (instalacionesIdsUnicos.length > 0) {
        const instalacionesRepo = queryRunner.manager.getRepository(Instalaciones);
        const instalaciones = await instalacionesRepo.find({
          where: { id: In(instalacionesIdsUnicos) },
        });

        if (instalaciones.length !== instalacionesIdsUnicos.length) {
          throw new BadRequestException(
            'Una o más instalaciones proporcionadas no existen.',
          );
        }

        const usuariosInstalaciones = instalacionesIdsUnicos.map((idInstalacion) =>
          usuariosInstalacionesRepo.create({
            idUsuario: userSave.id,
            idInstalacion,
          }),
        );
        await usuariosInstalacionesRepo.save(usuariosInstalaciones);
      }

      if (panelesAlarmaIdsUnicos.length > 0) {
        const panelRepo = queryRunner.manager.getRepository(PanelAlarma);
        const paneles = await panelRepo.find({
          where: { idDispositivo: In(panelesAlarmaIdsUnicos) },
        });

        if (paneles.length !== panelesAlarmaIdsUnicos.length) {
          throw new BadRequestException(
            'Uno o más paneles de alarma proporcionados no existen.',
          );
        }

        const usuariosPanelesAlarma = panelesAlarmaIdsUnicos.map((idPanelAlarma) =>
          usuarioPanelAlarmaRepo.create({
            idUsuario: userSave.id,
            idPanelAlarma,
          }),
        );
        await usuarioPanelAlarmaRepo.save(usuariosPanelesAlarma);
      }

      if (solucionesIdsUnicos.length > 0) {
        const solucionesRepo = queryRunner.manager.getRepository(Soluciones);
        const soluciones = await solucionesRepo.find({
          where: { id: In(solucionesIdsUnicos), estatus: 1 },
        });

        if (soluciones.length !== solucionesIdsUnicos.length) {
          throw new BadRequestException(
            'Una o más soluciones proporcionadas no existen.',
          );
        }

        const asignacionesSoluciones = solucionesIdsUnicos.map((idSolucion) =>
          asignacionSolucionesRepo.create({
            idUsuario: userSave.id,
            idSolucion,
          }),
        );
        await asignacionSolucionesRepo.save(asignacionesSoluciones);
      }

      await queryRunner.commitTransaction();

      const { passwordHash: _passwordHash, ...payloadBitacora } = createUsuarioDto;
      const querylogger = {
        ...payloadBitacora,
        permisosIds: permisosIdsUnicos,
        instalacionesIds: instalacionesIdsUnicos,
        panelesAlarmaIds: panelesAlarmaIdsUnicos,
        solucionesIds: solucionesIdsUnicos,
      };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se ha creado un usuario con nombre: ${createUsuarioDto.nombre}.`,
        'CREATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Usuario creado correctamente',
        data: {
          id: Number(userSave.id),
          nombre: `${userSave.nombre} ${userSave.apellidoPaterno}`.trim() || '',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const querylogger = {
        userName: createUsuarioDto.userName,
        nombre: createUsuarioDto.nombre,
      };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Error al crear usuario: ${createUsuarioDto.nombre}.`,
        'CREATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar crear el usuario.',
        error: (error as Error)?.message,
      });
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR MI CONTRASEÑA (usuario autenticado por token)
  // ========================================
  async updateContrasena(
    idUser: number,
    dto: UpdateUsuarioContrasena,
  ): Promise<ApiCrudResponse> {
    try {
      console.log('idUser', idUser);
      const usuario = await this.usuarioRepository.findOne({
        where: { id: idUser },
      });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${idUser}.`);
      }

      if (dto.passwordNueva !== dto.passwordNuevaConfirmacion) {
        throw new BadRequestException('La contraseña y la confirmación deben coincidir.');
      }

      const passwordActualValido = await bcrypt.compare(
        dto.passwordActual,
        usuario.passwordHash,
      );
      if (!passwordActualValido) {
        throw new BadRequestException('Credenciales inválidas.');
      }

      const hashedPassword = await bcrypt.hash(dto.passwordNueva, 10);
      const fechaActual = new Date();

      await this.usuarioRepository.update(idUser, {
        passwordHash: hashedPassword,
        actualizacionPassword: fechaActual,
        tokenRevocado: 1,
      });
      await this.authService.revokeAllRefreshSessionsForUser(idUser);

      const querylogger = { id: idUser };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se ha actualizado la contraseña del usuario con ID: ${idUser}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'La contraseña ha sido actualizada correctamente.',
        data: {
          id: idUser,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno}`.trim() || '',
        },
      };
    } catch (error) {
      const querylogger = { id: idUser };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Error al actualizar la contraseña del usuario con ID: ${idUser}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar la contraseña.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 CREAR O ACTUALIZAR MI NIP (usuario autenticado por token)
  // ========================================
  async createMyPin(idUser: number, dto: UpdateMiPinDto): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: idUser, estatus: 1 },
      });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${idUser}.`);
      }

      const hashedPin = await bcrypt.hash(dto.pinHash, 10);
      const fechaActual = new Date();

      await this.usuarioRepository.update(idUser, {
        pinHash: hashedPin,
        actualizacionPin: fechaActual,
      });

      const querylogger = { id: idUser };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se ha actualizado el NIP del usuario con ID: ${idUser}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'El NIP ha sido actualizado correctamente.',
        data: {
          id: idUser,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno}`.trim() || '',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar el NIP.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 REGISTRAR IdFaceAuth (solo columna; usuario del token)
  // ========================================
  async setIdFaceAuth(idUser: number, dto: SetFaceAuthDto): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: idUser, estatus: 1 },
      });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${idUser}.`);
      }

      if (usuario.idFaceAuth != null) {
        throw new BadRequestException('El usuario ya tiene un rostro afiliado.');
      }

      await this.usuarioRepository.update(idUser, {
        idFaceAuth: dto.idFaceAuth,
      });

      const querylogger = { id: idUser, idFaceAuth: dto.idFaceAuth };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se ha registrado IdFaceAuth para el usuario con ID: ${idUser}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Face Auth ha sido registrado correctamente.',
        data: {
          id: idUser,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno}`.trim() || '',
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al registrar Face Auth.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 SINCRONIZAR RELACIONES POR ESTATUS
  // ========================================
  private async sincronizarRelacionesEstatus(
    repo: Repository<{
      id: number;
      estatus: number;
      idUsuario: number;
    }>,
    idUsuario: number,
    idsRecibidos: number[],
    obtenerIdRelacion: (relacion: {
      id: number;
      estatus: number;
      idUsuario: number;
    }) => number,
    crearRelacion: (idRelacion: number) => {
      idUsuario: number;
      estatus: number;
      [key: string]: number;
    },
  ): Promise<void> {
    const nuevaLista = [...new Set(idsRecibidos.map(Number))];
    const nuevaSet = new Set(nuevaLista);

    const relacionesExistentes = await repo.find({
      where: { idUsuario },
    });

    const existentesMap = new Map(
      relacionesExistentes.map((relacion) => [obtenerIdRelacion(relacion), relacion]),
    );

    const todosIds = new Set([...nuevaLista, ...existentesMap.keys()]);

    for (const idRelacion of todosIds) {
      const debeEstarActivo = nuevaSet.has(idRelacion);
      const relacionExistente = existentesMap.get(idRelacion);

      if (debeEstarActivo && relacionExistente) {
        if (relacionExistente.estatus === 0) {
          await repo.update(relacionExistente.id, { estatus: 1 });
        }
        continue;
      }

      if (debeEstarActivo && !relacionExistente) {
        await repo.save(repo.create(crearRelacion(idRelacion)));
        continue;
      }

      if (!debeEstarActivo && relacionExistente?.estatus === 1) {
        await repo.update(relacionExistente.id, { estatus: 0 });
      }
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR DATOS DEL USUARIO (transacción)
  // ========================================
  async updateUsuario(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
    idUser: string,
    fileFotoPerfil?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const usuarioRepo = queryRunner.manager.getRepository(Usuarios);
    const permisosRepo = queryRunner.manager.getRepository(UsuariosPermisos);
    const usuariosInstalacionesRepo =
      queryRunner.manager.getRepository(UsuariosInstalaciones);
    const usuarioPanelAlarmaRepo = queryRunner.manager.getRepository(UsuarioPanelAlarma);
    const asignacionSolucionesRepo =
      queryRunner.manager.getRepository(AsignacionSoluciones);

    try {
      const usuario = await usuarioRepo.findOne({ where: { id } });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${id}.`);
      }

      if (updateUsuarioDto.idCliente) {
        try {
          await this.clientesService.getOneCliente(Number(updateUsuarioDto.idCliente));
        } catch {
          throw new BadRequestException('No se encontró el cliente especificado.');
        }
      }

      const {
        permisosIds,
        instalacionesIds,
        panelesAlarmaIds,
        solucionesIds,
        fotoPerfil: dtoFotoPerfil,
        ...restUpdate
      } = updateUsuarioDto;

      const usuarioData: Record<string, unknown> = {
        ...restUpdate,
        emailConfirmado: EstatusEnum.ACTIVO,
      };

      delete usuarioData.passwordHash;
      delete usuarioData.actualizacionPassword;

      if (fileFotoPerfil) {
        const { url } = await this.s3Service.updateFile(
          usuario.fotoPerfil,
          fileFotoPerfil,
          'usuarios',
          Number(idUser),
          EnumModulos.USUARIOS,
        );
        usuarioData.fotoPerfil = url;
      } else if (dtoFotoPerfil !== undefined) {
        usuarioData.fotoPerfil = dtoFotoPerfil;
      }

      const usuarioDataLimpio = Object.fromEntries(
        Object.entries(usuarioData).filter(([, v]) => v !== undefined),
      );

      await usuarioRepo.update(id, usuarioDataLimpio);

      if (Array.isArray(permisosIds)) {
        await this.sincronizarRelacionesEstatus(
          permisosRepo as Repository<{
            id: number;
            estatus: number;
            idUsuario: number;
          }>,
          id,
          permisosIds,
          (relacion) => Number((relacion as UsuariosPermisos).idPermiso),
          (idPermiso) => ({ idUsuario: id, idPermiso, estatus: 1 }),
        );
      }

      if (Array.isArray(instalacionesIds)) {
        await this.sincronizarRelacionesEstatus(
          usuariosInstalacionesRepo as Repository<{
            id: number;
            estatus: number;
            idUsuario: number;
          }>,
          id,
          instalacionesIds,
          (relacion) => Number((relacion as UsuariosInstalaciones).idInstalacion),
          (idInstalacion) => ({ idUsuario: id, idInstalacion, estatus: 1 }),
        );
      }

      if (Array.isArray(panelesAlarmaIds)) {
        await this.sincronizarRelacionesEstatus(
          usuarioPanelAlarmaRepo as Repository<{
            id: number;
            estatus: number;
            idUsuario: number;
          }>,
          id,
          panelesAlarmaIds,
          (relacion) => Number((relacion as UsuarioPanelAlarma).idPanelAlarma),
          (idPanelAlarma) => ({ idUsuario: id, idPanelAlarma, estatus: 1 }),
        );
      }

      if (Array.isArray(solucionesIds)) {
        await this.sincronizarRelacionesEstatus(
          asignacionSolucionesRepo as Repository<{
            id: number;
            estatus: number;
            idUsuario: number;
          }>,
          id,
          solucionesIds,
          (relacion) => Number((relacion as AsignacionSoluciones).idSolucion),
          (idSolucion) => ({ idUsuario: id, idSolucion, estatus: 1 }),
        );
      }

      await queryRunner.commitTransaction();

      const newUser = await this.usuarioRepository.findOne({
        where: { id },
      });
      const querylogger = {
        id,
        nombre: updateUsuarioDto.nombre,
        idRol: updateUsuarioDto.idRol,
        idCliente: updateUsuarioDto.idCliente,
      };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se actualizó el usuario: ${newUser?.nombre ?? usuario.nombre} con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'El usuario ha sido actualizado correctamente.',
        data: {
          id,
          nombre:
            `${newUser?.nombre ?? usuario.nombre} ${newUser?.apellidoPaterno ?? usuario.apellidoPaterno}`.trim() ||
            '',
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const querylogger = { id, nombre: updateUsuarioDto.nombre };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Error al actualizar usuario con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar el usuario.',
        error: (error as Error)?.message,
      });
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR ESTATUS DEL USUARIO
  // ========================================
  async updateUsuarioEstatus(
    id: number,
    updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${id}.`);
      }
      const { estatus } = updateUsuarioEstatusDto;

      await this.usuarioRepository.update(id, { estatus: estatus });
      const usuarioResult = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuarioResult) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${id}.`);
      }
      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateUsuarioEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se cambió el estatus del usuario ${usuarioResult.nombre} con ID: ${id} a estatus: ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api Response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El estatus del usuario ha sido actualizado correctamente.',
        estatus: {
          estatus: estatus,
        },
        data: {
          id: id,
          nombre: `${usuarioResult.nombre} ${usuarioResult.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateUsuarioEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se cambió el estatus del usuario con ID: ${id} a estatus: ${updateUsuarioEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'No se pudo actualizar el estatus del usuario.',
        error: (error as Error)?.message,
      });
    }
  }

  // ========================================
  // 🔹 ELIMINAR USUARIO
  // ========================================
  async deleteUsuario(id: number, idUser: string): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuarioRepository.findOne({
        where: { id: id },
      });
      if (!usuario) {
        throw new NotFoundException(`No se encontró un usuario con ID: ${id}.`);
      }
      //Se hacer eliminado logico
      //Cambiamos el estatus del usuario a 0
      await this.usuarioRepository.update(id, { estatus: 0 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se eliminó el usuario con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El usuario ha sido eliminado correctamente.',
        data: {
          id: id,
          nombre: `${usuario.nombre} ${usuario.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se eliminó el usuario con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Hubo un problema al intentar eliminar el usuario.',
        error: (error as Error)?.message,
      });
    }
  }
}
