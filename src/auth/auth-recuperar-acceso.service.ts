import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Usuarios } from 'src/entities/Usuarios';
import { CodigoAutenticacion } from 'src/entities/CodigoAutenticacion';
import { MailService } from 'src/mail/mail.service';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import {
  EstatusEnum,
  TipoCodigoAutenticacion,
} from 'src/common/estatus.enum';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { toJwtExpiresIn } from 'src/common/jwt-expires.util';

/**
 * Servicio legacy para POST login/usuario/recuperar/acceso.
 * Réplica de la lógica de recuperación por correo sin modificar AuthService.
 */
@Injectable()
export class AuthRecuperarAccesoService {
  private readonly logger = new Logger(AuthRecuperarAccesoService.name);

  constructor(
    @InjectRepository(Usuarios)
    private readonly usuariosRepository: Repository<Usuarios>,
    @InjectRepository(CodigoAutenticacion)
    private readonly codigoAutenticacioRepository: Repository<CodigoAutenticacion>,
    private readonly jwtService: JwtService,
    private readonly emailService: MailService,
  ) {}

  async recuperarAcceso(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ): Promise<string> {
    const mensajeGenerico =
      'Si el correo está registrado, recibirás un enlace de recuperación.';
    try {
      this.logger.log(
        `AuthRecuperarAcceso: solicitud recuperación (userName=${loginAuthConfirmacionDto.userName})`,
      );
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });

      if (!user) {
        this.logger.warn(
          `AuthRecuperarAcceso: correo no registrado (userName=${loginAuthConfirmacionDto.userName})`,
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
          `AuthRecuperarAcceso: límite de solicitudes por hora (userId=${user.id})`,
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
      await this.emailService.sendResetPasswordEmail(
        user.userName,
        name,
        token,
        codigo,
      );
      this.logger.log(
        `AuthRecuperarAcceso: correo de recuperación enviado (userId=${user.id})`,
      );
      return mensajeGenerico;
    } catch {
      this.logger.error(
        'AuthRecuperarAcceso: error no controlado (respuesta genérica al cliente)',
      );
      return mensajeGenerico;
    }
  }

  private async generarCodigo(idUsuario: number, tipo: number): Promise<string> {
    const codigo = (100000 + Math.floor(Math.random() * 900000)).toString();
    const ahora = nowMexicoCityAsUtcDate();
    const expiracionMin =
      tipo === TipoCodigoAutenticacion.CONFIRMACION_CORREO ? 5 : 15;
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
}
