import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { MailService } from 'src/mail/mail.service';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { CodigoAutenticacion } from 'src/entities/CodigoAutenticacion';
import {
  EnumModulos,
  EstatusEnum,
  TipoCodigoAutenticacion,
} from 'src/common/estatus.enum';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';

const MSG_CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const DUMMY_BCRYPT_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function jwtExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '15m';
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  const u = match[2];
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  if (u === 'd') return n * 86400;
  return 900;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(UsuariosPermisos)
    private permisosRepository: Repository<UsuariosPermisos>,
    @InjectRepository(CodigoAutenticacion)
    private codigoAutenticacioRepository: Repository<CodigoAutenticacion>,
    private readonly jwtService: JwtService,
    private readonly emailService: MailService,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async signIn(loginAuthDto: LoginAuthDto) {
    try {
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
        await bcrypt.compare(loginAuthDto.password, DUMMY_BCRYPT_HASH);
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (
        user.cliente2?.estatus !== 1 ||
        !user.passwordHash ||
        !(await bcrypt.compare(loginAuthDto.password, user.passwordHash))
      ) {
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const payload = {
        id: user.id,
        email: user.userName,
        idCliente: user.idCliente,
        rol: user.idRol,
      };

      await this.usuariosRepository.update(user.id, {
        ultimoLogin: new Date(),
      });

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = jwtExpiresInSeconds();
      return { accessToken, expiresIn };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Ha ocurrido un error durante el proceso de autenticación.',
        error: (error as Error)?.message,
      });
    }
  }

  async signInPin(loginAuthPin: LoginAuthPinDto) {
    try {
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
        await bcrypt.compare(loginAuthPin.codigo, DUMMY_BCRYPT_HASH);
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      if (
        user.cliente2?.estatus !== 1 ||
        !user.pinHash ||
        !(await bcrypt.compare(loginAuthPin.codigo, user.pinHash))
      ) {
        throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
      }

      const payload = {
        id: user.id,
        email: user.userName,
        idCliente: user.idCliente,
        rol: user.idRol,
      };

      await this.usuariosRepository.update(user.id, {
        ultimoLogin: new Date(),
      });

      const accessToken = this.jwtService.sign(payload);
      const expiresIn = jwtExpiresInSeconds();
      return { accessToken, expiresIn };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Ha ocurrido un error durante el proceso de autenticación.',
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
      throw new UnauthorizedException(MSG_CREDENCIALES_INVALIDAS);
    }
    const permisos = await this.permisosRepository.find({
      select: ['idPermiso'],
      where: { idUsuario: user.id, estatus: 1 },
    });
    return {
      message: 'login exitoso',
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
      fechaCreacion: user.fechaCreacion ?? '',
      fotoPerfil: user.fotoPerfil ?? '',
      userName: user.userName ?? '',
      rol: user.idRol2,
      permisos,
    };
  }

  async verifyUser(codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: codigoPasajeroAutenticacion.userName },
      });
      if (!user) {
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
                  fechaUso: new Date(),
                }
              : {}),
          });
        }
        throw new BadRequestException('Código inválido o ya usado');
      }

      const ahora = new Date();
      if (ahora > codigoValido.fechaExpiracion) {
        await this.codigoAutenticacioRepository.update(codigoValido.id, {
          usado: EstatusEnum.INACTIVO,
          estatus: EstatusEnum.INACTIVO,
          fechaUso: ahora,
        });
        throw new BadRequestException('Código inválido o ya usado');
      }

      if ((codigoValido.intentosFallidos ?? 0) >= 3) {
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

      return `La verificación del usuario ${user.nombre} se ha completado con éxito. Muchas gracias por su preferencia.`;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al verificar el usuario.',
        error: (error as Error)?.message,
      });
    }
  }

  async recuperarContrasena(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    const mensajeGenerico =
      'Si el correo está registrado, recibirás un enlace de recuperación.';
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });

      if (!user) {
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
        return mensajeGenerico;
      }

      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.RECUPERACION_CONTRASENA,
      );
      const payload = { id: user.id, email: user.userName };
      const token = this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_CONFIRMACION ?? '15m',
      });
      const name = `${user.nombre ?? ''} ${user.apellidoPaterno ?? ''} ${user.apellidoMaterno ?? ''}`.trim();
      await this.emailService.sendResetPasswordEmail(
        user.userName,
        name,
        token,
        codigo,
      );
      return mensajeGenerico;
    } catch {
      return mensajeGenerico;
    }
  }

  async generarCodigo(idUsuario: number, tipo: number): Promise<string> {
    const codigo = (
      100000 + Math.floor(Math.random() * 900000)
    ).toString();
    const ahora = new Date();
    const expiracionMin =
      tipo === TipoCodigoAutenticacion.CONFIRMACION_CORREO ? 5 : 15;
    const expiracion = new Date(
      ahora.getTime() + expiracionMin * 60 * 1000,
    );

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

  async recuperarConfirmacion(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) {
        throw new BadRequestException('Usuario no encontrado.');
      }
      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.CONFIRMACION_CORREO,
      );
      const payload = { id: user.id, email: user.userName };
      const token = this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_CONFIRMACION ?? '15m',
      });
      const name = `${user.nombre ?? ''} ${user.apellidoPaterno ?? ''} ${user.apellidoMaterno ?? ''}`.trim();
      await this.emailService.sendConfirmationEmail(
        user.userName,
        name,
        token,
        codigo,
      );
      return `Se ha enviado un correo con el codigo de autenticación.`;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al confirmar el usuario.',
        error: (error as Error)?.message,
      });
    }
  }

  async resetPassword(idUser: number, dto: LoginAuthResetDto) {
    try {
      const user = await this.usuariosRepository
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('u.id = :id', { id: idUser })
        .getOne();

      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }
      if (dto.passwordNueva !== dto.passwordConfirmacion) {
        throw new BadRequestException(
          'La contraseña y la confirmación deben coincidir.',
        );
      }
      const isSamePassword = await bcrypt.compare(
        dto.passwordNueva,
        user.passwordHash,
      );
      if (isSamePassword) {
        throw new BadRequestException(
          'La nueva contraseña no puede ser igual a la anterior.',
        );
      }
      const hashedPassword = await bcrypt.hash(dto.passwordNueva, 10);
      await this.usuariosRepository.update(user.id, {
        passwordHash: hashedPassword,
      });
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se ha actualizado la contraseña del usuario con ID: ${user.id}.`,
        'UPDATE',
        { id: user.id },
        idUser,
        EnumModulos.USUARIOS,
        EstatusEnumBitcora.SUCCESS,
      );
      return `La contraseña del usuario ${user.nombre} ha sido actualizada exitosamente.`;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al actualizar contraseña del usuario.',
        error: (error as Error)?.message,
      });
    }
  }
}
