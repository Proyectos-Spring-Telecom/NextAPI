import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { MailService } from 'src/mail/mail.service';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { CodigoAutenticacion } from 'src/entities/CodigoAutenticacion';
import {
  EnumModulos,
  EstatusEnum,
  TipoCodigoAutenticacion,
} from 'src/common/estatus.enum';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';
import { Soluciones } from 'src/entities/Soluciones';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { AsignacionSoluciones } from 'src/entities/AsignacionSoluciones';
import { BehaviorIqAuthService } from './behavior-iq-auth.service';
import { ValidateFaceDto } from './dto/validate-face.dto';
import { toJwtExpiresIn } from 'src/common/jwt-expires.util';
import { RefreshSessions } from 'src/entities/RefreshSessions';
import { AuthTokensService, jwtExpiresInSeconds } from './auth-tokens.service';

const MSG_CREDENCIALES_INVALIDAS = 'Credenciales inválidas.';
/** Solución fija para login facial (validateFace); misma lógica que query Nombres en login. */
const VALIDATE_FACE_ID_SOLUCION = 2;
const MSG_SOLUCION_INVALIDA = 'Credenciales inválidas.';
const MSG_LOGOUT_OK = 'Sesión cerrada';
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
    @InjectRepository(CodigoAutenticacion)
    private codigoAutenticacioRepository: Repository<CodigoAutenticacion>,
    @InjectRepository(Soluciones)
    private readonly solucionesRepository: Repository<Soluciones>,
    @InjectRepository(AsignacionSoluciones)
    private readonly asignacionSolucionesRepository: Repository<AsignacionSoluciones>,
    @InjectRepository(RefreshSessions)
    private readonly refreshSessionsRepository: Repository<RefreshSessions>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly authTokensService: AuthTokensService,
    private readonly emailService: MailService,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly behaviorIqAuthService: BehaviorIqAuthService,
  ) {}

  /** Valor para JWT `face`: mismo sentido que `Usuarios.IdFaceAuth` (BehaviorIQ idRostro). */
  private optionalFaceClaim(user: Usuarios): number | undefined {
    if (user.idFaceAuth == null) return undefined;
    const n = Number(user.idFaceAuth);
    if (!Number.isFinite(n) || n < 1) return undefined;
    return n;
  }

  async revokeAllRefreshSessionsForUser(userId: number): Promise<void> {
    await this.refreshSessionsRepository.update(
      { idUsuario: userId, revokedAt: IsNull() },
      { revokedAt: nowMexicoCityAsUtcDate() },
    );
  }

  private async createSessionForUser(
    user: Usuarios,
    /** Claim JWT `face` (= IdFaceAuth del usuario cuando existe). */
    faceClaim?: number,
  ): Promise<{
    token: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const token = this.authTokensService.signAccessToken(user, faceClaim);
    const expiresIn = jwtExpiresInSeconds();
    const {
      token: refreshToken,
      jti,
      expiresAt,
    } = this.authTokensService.signRefreshToken(user.id);

    const session = this.refreshSessionsRepository.create({
      idUsuario: user.id,
      jti,
      tokenHash: this.authTokensService.hashRefreshToken(refreshToken),
      expiresAt,
      revokedAt: null,
      replacedById: null,
    });
    await this.refreshSessionsRepository.save(session);

    await this.usuariosRepository.update(user.id, {
      ultimoLogin: nowMexicoCityAsUtcDate(),
    });

    return { token, refreshToken, expiresIn };
  }

  private async assertSolucionCodigoSiViene(nombres?: string) {
    const trimmed = nombres?.trim();
    if (!trimmed) {
      this.logger.warn('Auth: rechazado — falta el query Nombres (código de solución)');
      throw new BadRequestException(MSG_SOLUCION_INVALIDA);
    }

    const solucion = await this.solucionesRepository.findOne({
      where: { codigo: trimmed, estatus: 1 },
    });
    if (!solucion) {
      this.logger.warn(`Auth: solución no encontrada o inactiva (código=${trimmed})`);
      throw new BadRequestException(MSG_SOLUCION_INVALIDA);
    }

    return solucion.id;
  }

  async signIn(loginAuthDto: LoginAuthDto, nombres?: string) {
    try {
      this.logger.log(`Auth: intento de login (userName=${loginAuthDto.userName})`);
      const idSolucion = await this.assertSolucionCodigoSiViene(nombres);

      const user = await this.usuariosRepository
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .leftJoinAndSelect('u.cliente2', 'cliente2')
        .leftJoinAndSelect('u.idRol2', 'idRol2')
        .where('u.userName = :userName', { userName: loginAuthDto.userName })
        .andWhere('u.estatus = 1')
        .andWhere('u.emailConfirmado = 1')
        .getOne();

      if (!user) {
        this.logger.warn(
          `Auth: login fallido — usuario no encontrado o no elegible (userName=${loginAuthDto.userName})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const permisos = await this.asignacionSolucionesRepository.findOne({
        where: {
          idUsuario: user.id,
          idSolucion: idSolucion,
          estatus: EstatusEnum.ACTIVO,
        },
      });

      if (!permisos) {
        this.logger.warn(
          `Auth: login fallido — sin asignación a la solución (userId=${user.id}, idSolucion=${idSolucion})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (!user) {
        await bcrypt.compare(loginAuthDto.password, DUMMY_BCRYPT_HASH);
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (
        user.cliente2?.estatus !== 1 ||
        !user.passwordHash ||
        !(await bcrypt.compare(loginAuthDto.password, user.passwordHash))
      ) {
        this.logger.warn(
          `Auth: login fallido — cliente inactivo o contraseña incorrecta (userId=${user.id})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const session = await this.createSessionForUser(user, this.optionalFaceClaim(user));

      this.logger.log(
        `Auth: login correcto (userId=${user.id}, idCliente=${user.idCliente})`,
      );
      return {
        token: session.token,
        refreshToken: session.refreshToken,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en login — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ha ocurrido un error durante el proceso de autenticación.',
        error: (error as Error)?.message,
      });
    }
  }

  async signInPin(loginAuthPin: LoginAuthPinDto, nombres?: string) {
    try {
      this.logger.log(`Auth: intento de login PIN (userName=${loginAuthPin.userName})`);
      const idSolucion = await this.assertSolucionCodigoSiViene(nombres);

      const user = await this.usuariosRepository
        .createQueryBuilder('u')
        .addSelect('u.pinHash')
        .leftJoinAndSelect('u.cliente2', 'cliente2')
        .leftJoinAndSelect('u.idRol2', 'idRol2')
        .where('u.userName = :userName', { userName: loginAuthPin.userName })
        .andWhere('u.estatus = 1')
        .andWhere('u.emailConfirmado = 1')
        .getOne();

      if (!user) {
        this.logger.warn(
          `Auth: PIN fallido — usuario no encontrado o no elegible (userName=${loginAuthPin.userName})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const permisos = await this.asignacionSolucionesRepository.findOne({
        where: {
          idUsuario: user.id,
          idSolucion: idSolucion,
          estatus: EstatusEnum.ACTIVO,
        },
      });

      if (!permisos) {
        this.logger.warn(
          `Auth: PIN fallido — sin asignación a la solución (userId=${user.id}, idSolucion=${idSolucion})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (!user) {
        await bcrypt.compare(loginAuthPin.codigo, DUMMY_BCRYPT_HASH);
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (
        user.cliente2?.estatus !== 1 ||
        !user.pinHash ||
        !(await bcrypt.compare(loginAuthPin.codigo, user.pinHash))
      ) {
        this.logger.warn(
          `Auth: PIN fallido — cliente inactivo o NIP incorrecto (userId=${user.id})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const session = await this.createSessionForUser(user, this.optionalFaceClaim(user));

      this.logger.log(
        `Auth: login PIN correcto (userId=${user.id}, idCliente=${user.idCliente})`,
      );
      return {
        accessToken: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en login PIN — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ha ocurrido un error durante el proceso de autenticación.',
        error: (error as Error)?.message,
      });
    }
  }

  async validateFaceLogin(idCliente: number, dto: ValidateFaceDto) {
    try {
      this.logger.log(`Auth: intento login facial (idCliente=${idCliente})`);

      const { status, data } = await this.behaviorIqAuthService.validateFace(
        idCliente,
        dto,
      );

      if (status === 401 || status === 403) {
        throw new UnauthorizedException('No autorizado ante BehaviorIQ.');
      }
      if (status === 404) {
        throw new UnauthorizedException('No se encontró coincidencia facial.');
      }
      if (status >= 500) {
        throw new InternalServerErrorException({
          message: 'BehaviorIQ no disponible temporalmente.',
        });
      }
      if (status < 200 || status >= 300) {
        const msg =
          data &&
          typeof data === 'object' &&
          'message' in data &&
          typeof (data as { message: unknown }).message === 'string'
            ? (data as { message: string }).message
            : 'Respuesta inválida de BehaviorIQ.';
        throw new BadRequestException(msg);
      }

      const body = data as Record<string, unknown>;
      if (body.success !== true) {
        throw new UnauthorizedException('Validación facial no exitosa.');
      }

      const idRostro = Number(body.idRostro);
      if (!Number.isFinite(idRostro) || idRostro < 1) {
        throw new InternalServerErrorException({
          message: 'Respuesta inconsistente de BehaviorIQ (idRostro).',
        });
      }

      const user = await this.usuariosRepository
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.cliente2', 'cliente2')
        .leftJoinAndSelect('u.idRol2', 'idRol2')
        .where('u.idFaceAuth = :idFaceAuth', { idFaceAuth: idRostro })
        .andWhere('u.estatus = 1')
        .andWhere('u.emailConfirmado = 1')
        .getOne();

      if (!user) {
        throw new NotFoundException('No hay vínculo local con ese rostro.');
      }

      if (user.cliente2?.estatus !== 1) {
        this.logger.warn(`Auth: facial rechazado — cliente inactivo (userId=${user.id})`);
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const permisos = await this.asignacionSolucionesRepository.findOne({
        where: {
          idUsuario: user.id,
          idSolucion: VALIDATE_FACE_ID_SOLUCION,
          estatus: EstatusEnum.ACTIVO,
        },
      });
      if (!permisos) {
        this.logger.warn(
          `Auth: facial rechazado — sin asignación a la solución (userId=${user.id}, idSolucion=${VALIDATE_FACE_ID_SOLUCION})`,
        );
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const session = await this.createSessionForUser(user, this.optionalFaceClaim(user));

      this.logger.log(
        `Auth: login facial correcto (userId=${user.id}, idCliente=${user.idCliente})`,
      );

      return {
        token: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en login facial — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ha ocurrido un error durante la validación facial.',
        error: (error as Error)?.message,
      });
    }
  }

  async getProfileByToken(userId: number) {
    const user = await this.usuariosRepository.findOne({
      relations: ['idRol2', 'cliente2'],
      where: { id: userId, estatus: 1 },
    });
    if (!user) {
      this.logger.warn(
        `Auth: /me rechazado — usuario no encontrado o inactivo (userId=${userId})`,
      );
      throw new UnauthorizedException('Usuario no autorizado');
    }
    const permisos = await this.permisosRepository.find({
      select: ['idPermiso'],
      where: { idUsuario: user.id, estatus: 1 },
    });
    return {
      message: 'Perfil obtenido exitosamente',
      id: Number(user.id),
      nombre: user.nombre ?? '',
      apellidoPaterno: user.apellidoPaterno ?? '',
      apellidoMaterno: user.apellidoMaterno ?? '',
      idCliente: Number(user.idCliente),
      nombreCliente: user.cliente2?.nombre ?? '',
      apellidoPaternoCliente: user.cliente2?.apellidoPaterno ?? '',
      apellidoMaternoCliente: user.cliente2?.apellidoMaterno ?? '',
      logotipo: user.cliente2?.logotipo ?? '',
      telefono: user.telefono ?? '',
      ultimoLogin: user.ultimoLogin ?? '',
      fechaCreacion: user.fechaCreacion,
      fotoPerfil: user.fotoPerfil ?? '',
      userName: user.userName ?? '',
      rol: user.idRol2,
      permisos,
    };
  }

  async refreshToken(refreshToken: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      this.logger.log('Auth: solicitud de refresh token');

      let decoded: { id?: number; type?: string; jti?: string };
      try {
        decoded = this.authTokensService.verifyRefreshToken(refreshToken);
      } catch {
        this.logger.warn('Auth: refresh rechazado — JWT refresh inválido o expirado');
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      if (decoded?.type !== 'refresh' || !decoded?.jti || decoded?.id == null) {
        this.logger.warn('Auth: refresh rechazado — payload de refresh inválido');
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      const userId = Number(decoded.id);
      const sessionRepo = queryRunner.manager.getRepository(RefreshSessions);
      const session = await sessionRepo.findOne({
        where: { jti: decoded.jti, idUsuario: userId },
        lock: { mode: 'pessimistic_write' },
      });

      const now = new Date();
      const incomingHash = this.authTokensService.hashRefreshToken(refreshToken);
      if (
        !session ||
        session.revokedAt != null ||
        session.tokenHash !== incomingHash ||
        session.expiresAt <= now
      ) {
        this.logger.warn(
          `Auth: refresh rechazado — sesión inválida o revocada (userId=${userId})`,
        );
        throw new UnauthorizedException('Sesión de refresh inválida o revocada');
      }

      const user = await queryRunner.manager.getRepository(Usuarios).findOne({
        where: { id: userId, estatus: 1 },
      });
      if (!user) {
        this.logger.warn(`Auth: refresh rechazado — usuario inactivo (userId=${userId})`);
        throw new UnauthorizedException('Sesión de refresh inválida o revocada');
      }

      const token = this.authTokensService.signAccessToken(
        user,
        this.optionalFaceClaim(user),
      );
      const {
        token: newRefreshToken,
        jti,
        expiresAt,
      } = this.authTokensService.signRefreshToken(user.id);

      const newSession = await sessionRepo.save(
        sessionRepo.create({
          idUsuario: user.id,
          jti,
          tokenHash: this.authTokensService.hashRefreshToken(newRefreshToken),
          expiresAt,
          revokedAt: null,
          replacedById: null,
        }),
      );

      await sessionRepo.update(session.id, {
        revokedAt: now,
        replacedById: newSession.id,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Auth: refresh correcto (userId=${user.id})`);
      return {
        token,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en refresh — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al refrescar la sesión.',
        error: (error as Error)?.message,
      });
    } finally {
      await queryRunner.release();
    }
  }

  async logoutRefresh(refreshToken: string) {
    try {
      let decoded: { id?: number; type?: string; jti?: string };
      try {
        decoded = this.authTokensService.verifyRefreshToken(refreshToken);
      } catch {
        return { message: MSG_LOGOUT_OK };
      }

      if (decoded?.type !== 'refresh' || !decoded?.jti || decoded?.id == null) {
        return { message: MSG_LOGOUT_OK };
      }

      const userId = Number(decoded.id);
      const session = await this.refreshSessionsRepository.findOne({
        where: { jti: decoded.jti, idUsuario: userId },
      });
      if (!session || session.revokedAt != null) {
        return { message: MSG_LOGOUT_OK };
      }

      const incomingHash = this.authTokensService.hashRefreshToken(refreshToken);
      if (session.tokenHash !== incomingHash) {
        return { message: MSG_LOGOUT_OK };
      }

      await this.refreshSessionsRepository.update(session.id, {
        revokedAt: nowMexicoCityAsUtcDate(),
      });
      this.logger.log(`Auth: logout correcto (userId=${userId})`);
      return { message: MSG_LOGOUT_OK };
    } catch (error) {
      this.logger.error(
        `Auth: error en logout — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      return { message: MSG_LOGOUT_OK };
    }
  }

  /** @deprecated Usar logoutRefresh; se mantiene por compatibilidad interna. */
  async logout(userId: number) {
    try {
      await this.revokeAllRefreshSessionsForUser(userId);
      this.logger.log(`Auth: logout correcto (userId=${userId})`);
      return { message: MSG_LOGOUT_OK };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error en logout (userId=${userId}) — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al cerrar sesión.',
        error: (error as Error)?.message,
      });
    }
  }

  async verifyUser(codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion) {
    try {
      this.logger.log(
        `Auth: verificación de correo (userName=${codigoPasajeroAutenticacion.userName})`,
      );
      const user = await this.usuariosRepository.findOne({
        where: { userName: codigoPasajeroAutenticacion.userName },
      });
      if (!user) {
        this.logger.warn(
          `Auth: verificación fallida — usuario no encontrado (userName=${codigoPasajeroAutenticacion.userName})`,
        );
        throw new BadRequestException('Código inválido o ya usado');
      }

      const codigoValido = await this.codigoAutenticacioRepository.findOne({
        where: {
          idUsuario: user.id,
          codigo: codigoPasajeroAutenticacion.codigo,
          tipo: TipoCodigoAutenticacion.CONFIRMACION_CORREO,
          usado: EstatusEnum.ACTIVO,
        },
      });

      if (!codigoValido) {
        const anyCode = await this.codigoAutenticacioRepository.findOne({
          where: {
            idUsuario: user.id,
            tipo: TipoCodigoAutenticacion.CONFIRMACION_CORREO,
            usado: EstatusEnum.ACTIVO,
          },
        });
        if (anyCode) {
          const intentosFallidos = (anyCode.intentosFallidos ?? 0) + 1;
          await this.codigoAutenticacioRepository.update(anyCode.id, {
            intentosFallidos,
            ...(intentosFallidos >= 3
              ? {
                  usado: EstatusEnum.INACTIVO,
                  estatus: EstatusEnum.INACTIVO,
                  fechaUso: nowMexicoCityAsUtcDate(),
                }
              : {}),
          });
        }
        this.logger.warn(
          `Auth: verificación fallida — código incorrecto (userId=${user.id})`,
        );
        throw new BadRequestException('Código inválido o ya usado');
      }

      const ahora = nowMexicoCityAsUtcDate();
      if (ahora > codigoValido.fechaExpiracion) {
        await this.codigoAutenticacioRepository.update(codigoValido.id, {
          usado: EstatusEnum.INACTIVO,
          estatus: EstatusEnum.INACTIVO,
          fechaUso: ahora,
        });
        this.logger.warn(
          `Auth: verificación fallida — código expirado (userId=${user.id})`,
        );
        throw new BadRequestException('Código inválido o ya usado');
      }

      if ((codigoValido.intentosFallidos ?? 0) >= 3) {
        this.logger.warn(
          `Auth: verificación fallida — demasiados intentos (userId=${user.id})`,
        );
        throw new BadRequestException('Código inválido o ya usado');
      }

      await this.usuariosRepository.update(user.id, { emailConfirmado: 1 });
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se verificó un usuario con nombre: ${user.nombre}.`,
        'UPDATE',
        { id: user.id, emailConfirmado: 1 },
        Number(user.id),
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );
      await this.codigoAutenticacioRepository.update(codigoValido.id, {
        usado: EstatusEnum.INACTIVO,
        estatus: EstatusEnum.INACTIVO,
        fechaUso: ahora,
      });

      this.logger.log(`Auth: verificación de correo correcta (userId=${user.id})`);
      return `La verificación del usuario ${user.nombre} se ha completado con éxito. Muchas gracias por su preferencia.`;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en verificación — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al verificar el usuario.',
        error: (error as Error)?.message,
      });
    }
  }

  async recuperarContrasena(loginAuthConfirmacionDto: LoginAuthConfirmacionDto) {
    const mensajeGenerico =
      'Si el correo está registrado, recibirás un enlace de recuperación.';
    try {
      this.logger.log(
        `Auth: solicitud recuperación contraseña (userName=${loginAuthConfirmacionDto.userName})`,
      );
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });

      if (!user) {
        this.logger.warn(
          `Auth: recuperación — correo no registrado (userName=${loginAuthConfirmacionDto.userName})`,
        );
        return mensajeGenerico;
      }

      const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
      const recientes = await this.codigoAutenticacioRepository.find({
        where: {
          idUsuario: user.id,
          tipo: TipoCodigoAutenticacion.RECUPERACION_CONTRASENA,
        },
        order: { fechaCreacion: 'DESC' },
        take: 3,
      });
      const enUltimaHora = recientes.filter(
        (r) => r.fechaCreacion && r.fechaCreacion >= haceUnaHora,
      );
      if (enUltimaHora.length >= 3) {
        this.logger.warn(
          `Auth: recuperación — límite de solicitudes por hora (userId=${user.id})`,
        );
        return mensajeGenerico;
      }

      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.RECUPERACION_CONTRASENA,
      );
      const payload = { id: user.id, email: user.userName };
      const token = this.jwtService.sign(payload, {
        expiresIn: toJwtExpiresIn(process.env.JWT_CONFIRMACION, '15m'),
      });
      const name =
        `${user.nombre ?? ''} ${user.apellidoPaterno ?? ''} ${user.apellidoMaterno ?? ''}`.trim();
      await this.emailService.sendResetPasswordEmail(user.userName, name, token, codigo);
      this.logger.log(`Auth: correo de recuperación enviado (userId=${user.id})`);
      return mensajeGenerico;
    } catch {
      this.logger.error(
        'Auth: error no controlado en recuperarContraseña (respuesta genérica al cliente)',
      );
      return mensajeGenerico;
    }
  }

  async generarCodigo(idUsuario: number, tipo: number): Promise<string> {
    const codigo = (100000 + Math.floor(Math.random() * 900000)).toString();
    const ahora = nowMexicoCityAsUtcDate();
    const expiracionMin = tipo === TipoCodigoAutenticacion.CONFIRMACION_CORREO ? 5 : 15;
    const expiracion = new Date(ahora.getTime() + expiracionMin * 60 * 1000);

    const codigoExiste = await this.codigoAutenticacioRepository.findOne({
      where: { idUsuario, tipo },
    });

    if (codigoExiste) {
      await this.codigoAutenticacioRepository.update(codigoExiste.id, {
        codigo,
        fechaCreacion: ahora,
        fechaExpiracion: expiracion,
        usado: EstatusEnum.ACTIVO,
        estatus: EstatusEnum.ACTIVO,
        fechaUso: null,
        intentosFallidos: 0,
      });
    } else {
      const codigoCreate = this.codigoAutenticacioRepository.create({
        idUsuario,
        codigo,
        tipo,
        fechaExpiracion: expiracion,
        usado: EstatusEnum.ACTIVO,
        estatus: EstatusEnum.ACTIVO,
        intentosFallidos: 0,
      });
      await this.codigoAutenticacioRepository.save(codigoCreate);
    }
    return codigo;
  }

  async recuperarConfirmacion(loginAuthConfirmacionDto: LoginAuthConfirmacionDto) {
    try {
      this.logger.log(
        `Auth: reenvío confirmación correo (userName=${loginAuthConfirmacionDto.userName})`,
      );
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) {
        this.logger.warn(
          `Auth: reenvío confirmación — usuario no encontrado (userName=${loginAuthConfirmacionDto.userName})`,
        );
        throw new BadRequestException(MSG_CREDENCIALES_INVALIDAS);
      }
      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.CONFIRMACION_CORREO,
      );
      const payload = { id: user.id, email: user.userName };
      const token = this.jwtService.sign(payload, {
        expiresIn: toJwtExpiresIn(process.env.JWT_CONFIRMACION, '15m'),
      });
      const name =
        `${user.nombre ?? ''} ${user.apellidoPaterno ?? ''} ${user.apellidoMaterno ?? ''}`.trim();
      await this.emailService.sendConfirmationEmail(user.userName, name, token, codigo);
      this.logger.log(`Auth: correo de confirmación enviado (userId=${user.id})`);
      return `Se ha enviado un correo con el codigo de autenticación.`;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Auth: error no controlado en recuperarConfirmacion — ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al confirmar el usuario.',
        error: (error as Error)?.message,
      });
    }
  }
}
