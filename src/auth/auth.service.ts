import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { EstatusEnum, TipoCodigoAutenticacion } from 'src/common/estatus.enum';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';
import { horaDesfasada } from 'src/utils/correccion-hora';

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
  ) { }

  /*   // ========================================
    //Creacion de una afiliacion
    // ========================================
    async createPasajero(createAltaPasajaroDto: CreateAltaPasajaroDto) {
      try {
        //Buscamos el monedero que este dado de alta
        const monederos = await this.monederoService.findOneMonederoBySerie(
          createAltaPasajaroDto.numeroSerieMonedero,
        );
  
        if (monederos.data.idPasajero) {
          throw new BadRequestException(
            `El monedero con numero de serie ${createAltaPasajaroDto.numeroSerieMonedero} esta ligado a un pasajero`,
          );
        }
  
        const existUsuario = await this.usuariosRepository.findOne({
          //Buscamos si existe usuario
          where: { userName: createAltaPasajaroDto.correo },
        });
        if (existUsuario) {
          throw new BadRequestException('El usuario ya se encuentra registrado.');
        }
  
        const hashedPassword = await bcrypt.hash(
          createAltaPasajaroDto.passwordHash,
          10,
        ); //encriptamos la contraseña
        createAltaPasajaroDto.passwordHash = hashedPassword;
  
        //creamos el body para crear un usuario que le permita loguearse
        const bodyUsuario = {
          userName: createAltaPasajaroDto.correo,
          passwordHash: createAltaPasajaroDto.passwordHash,
          emailConfirmado: 0,
          nombre: createAltaPasajaroDto.nombre,
          apellidoPaterno: createAltaPasajaroDto.apellidoPaterno,
          apellidoMaterno: createAltaPasajaroDto.apellidoMaterno,
          telefono: createAltaPasajaroDto.telefono,
          fotoPerfil:
            'https://transmovi.s3.us-east-2.amazonaws.com/imagenes/user_default.png',
          estatus: 1,
          idRol: 9,
          idCliente: monederos.data.idCliente,
        };
  
        //Creamos el usuario
        const newUser = await this.usuariosRepository.create(bodyUsuario);
        const userSave = await this.usuariosRepository.save(newUser); //creamos el usuario
  
        //Le añadimos los permisos correspondientes
        const permisosIds = [122];
        if (permisosIds.length > 0) {
          const usuariosPermisos = permisosIds.map((permisoId) =>
            this.permisosRepository.create({
              idUsuario: userSave.id,
              idPermiso: permisoId,
            }),
          );
  
          //guardamos los permisos
          await this.permisosRepository.save(usuariosPermisos);
        }
  
        //Creamos el body del pasajero
        const bodyPasajero = {
          nombre: createAltaPasajaroDto.nombre,
          apellidoPaterno: createAltaPasajaroDto.apellidoPaterno,
          apellidoMaterno: createAltaPasajaroDto.apellidoMaterno,
          telefono: createAltaPasajaroDto.telefono,
          fechaNacimiento: createAltaPasajaroDto.fechaNacimiento,
          correo: createAltaPasajaroDto.correo,
          estatus: 1,
          estadoSolicitud: EnumSolicitudPasajero.NOSOLICITADO,
        };
  
        //Creamos el pasajero
        const pasajero = await this.pasajeroService.createPasajerosAfiliacion(
          bodyPasajero,
          userSave.id,
        );
  
        //armamos el payload para el token
        const payload = {
          id: userSave.id,
          email: userSave.userName,
        };
  
        //creamos el token
        const token = this.jwtService.sign(payload, {
          expiresIn: `${process.env.JWT_CONFIRMACION}`,
        });
  
        //Llamamos la funcion que nos genera el codigo
        const codigo = await this.generarCodigo(
          userSave.id,
          TipoCodigoAutenticacion.CONFIRMACION_CORREO,
        );
        //Enviar correo de confirmacion
        const name = `${userSave.nombre} ${userSave.apellidoPaterno} ${userSave.apellidoMaterno ?? ''}`;
        await this.emailService.sendConfirmationEmail(
          userSave.userName,
          name,
          token,
          codigo,
        );
  
        //afiliamos el monedero al pasajero y cambiamos estatus activo
        function pad(n: number) {
          return n < 10 ? '0' + n : n;
        }
  
        const ahora = new Date();
        const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
        const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
  
        const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;
  
        await this.monederoService.updateMonedero(
          monederos.data.id,
          userSave.id,
          {
            idPasajero: pasajero.data?.id,
            fechaActivacion: fechaActual,
            estatus: EstatusEnum.ACTIVO,
          },
        );
  
        //-----Registro en la bitacora----- SUCCESS
        const querylogger = { createAltaPasajaroDto };
        await this.bitacoraLogger.logToBitacora(
          'Usuarios',
          `Se ha creado un usuario con nombre: ${userSave.nombre}.`,
          'CREATE',
          querylogger,
          Number(userSave.id),
          2,
          EstatusEnumBitcora.SUCCESS,
        );
  
        const { passwordHash: _, ...usuarioSinPassword } = newUser;
  
        //Api response
        const result: ApiCrudResponse = {
          status: 'success',
          message: 'Usuario creado correctamente',
          data: {
            id: Number(usuarioSinPassword.id),
            nombre:
              `${usuarioSinPassword.nombre} ${usuarioSinPassword.apellidoPaterno} ` ||
              '',
          },
        };
        return result;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new InternalServerErrorException(
          'Ha ocurrido un error durante el proceso de creación del pasajero.',
        );
      }
    }
   */
  /* // ========================================
   //Login por PIN
   // ========================================
   async singInPin(loginAuthPin: LoginAuthPinDto) {
     try {
       //buscamos el usuario
        Debe tener el mismo correo
          Debe estar activo en estatus
          debe estar confirmado el correo
          y el cliente al que pertenece debe estar activo
       
       const user = await this.usuariosRepository.findOne({
         relations: ['idRol2', 'idCliente2'],
         where: {
           userName: loginAuthPin.userName,
           estatus: 1,
           emailConfirmado: 1,
           idCliente2: {
             estatus: 1,
           },
         },
       });
 
 
       if (user?.idCliente2?.estatus === 0) {
         throw new UnauthorizedException(
           'Acceso denegado: el cliente ha sido dado de baja.',
         );
       }
       if (!user) {
         throw new NotFoundException('No se encontró al usuario.');
       }
       if (user.deviceId !== loginAuthPin.deviceId) {
         throw new NotFoundException('El dispositivo reportado no coincide con el dispositivo asignado al usuario.');
       }
 
       if (
         !user ||
         !user.pinHash ||
         !(await bcrypt.compare(loginAuthPin.pinHash, user.pinHash))
       ) {
         throw new UnauthorizedException('Credenciales invalidas');
       }
       const permisos = await this.permisosRepository.find({
         select: ['idPermiso'],
         where: { idUsuario: user.id, estatus: 1 },
       });
 
       function pad(n: number) {
         return n < 10 ? '0' + n : n;
       }
 
       const ahora = new Date();
       const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
       const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);
 
       const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;
 
       await this.usuariosRepository.update(user.id, {
         ultimoLogin: fechaActual,
       });
       const pin = user.pinHash ? 1 : 0;
       const operador = await this.usuariosRepository.query(`
           WITH DatosUsuario AS (
     SELECT
         u.Id AS IdUsuario,
         u.UserName AS userName,
         u.Nombre AS nombre,
         u.ApellidoPaterno AS apellidoPaterno,
         u.ApellidoMaterno AS apellidoMaterno,
         u.Telefono AS telefono,
         u.UltimoLogin AS ultimoLogin,
         u.FechaCreacion AS fechaCreacion,
         u.FotoPerfil AS fotoPerfil,
         u.DeviceId AS deviceId,
 
         -- CLIENTE
         c.Id AS idCliente,
         c.Nombre AS nombreCliente,
         c.ApellidoPaterno AS apellidoPaternoCliente,
         c.ApellidoMaterno AS apellidoMaternoCliente,
         c.Logotipo AS logotipo,
 
         -- OPERADOR
         o.Id AS idOperador,
         o.FechaNacimiento AS fechaNacimiento,
         o.Identificacion AS identificacion,
         o.Foto AS fotoOperador,
         o.ComprobanteDomicilio AS comprobanteDomicilioOperador,
         o.CertificadoMedico AS certificadoMedicoOperador,
         o.AntecedentesNoPenales AS antecedentesNoPenalesOperador,
         o.Estatus AS estatusOperador
     FROM Usuarios u
     INNER JOIN Clientes c ON c.Id = u.IdCliente
     LEFT JOIN Operadores o ON o.IdUsuario = u.Id
     WHERE u.Id = ${user.id}
 ),
 LicenciasJSON AS (
     SELECT
         o.IdUsuario,
         JSON_ARRAYAGG(
             JSON_OBJECT(
                 'IdLicencia', l.Id,
                 'Licencia', l.Licencia,
                 'NumeroLicencia', l.NumeroLicencia,
                 'FechaExpedicion', l.FechaExpedicion,
                 'FechaVencimiento', l.FechaVencimiento,
                 'IdTipoLicencia', l.IdTipoLicencia,
                 'IdCategoriaLicencia', l.IdCategoriaLicencia
             )
         ) AS Licencias
     FROM Operadores o
     LEFT JOIN Licencias l ON l.IdOperador = o.Id
     GROUP BY o.IdUsuario
 )
 SELECT 
     du.*,
     lj.Licencias
 FROM DatosUsuario du
 LEFT JOIN LicenciasJSON lj ON lj.IdUsuario = du.IdUsuario;
           `)
 
       const payload = {
         id: user.id,
         email: user.userName,
         cliente: user.idCliente,
         rol: user.idRol,
         idOperador: operador[0].idOperador
       };
       return {
         message: `login exitoso`,
         id: Number(operador[0].IdUsuario),
         nombre: operador[0].nombre,
         apellidoPaterno: operador[0].apellidoPaterno,
         apellidoMaterno: operador[0].apellidoMaterno,
         fechaNacimiento: operador[0].fechaNacimiento,
         identificacion: operador[0].identificacion,
         comprobanteDomicilioOperador: operador[0].comprobanteDomicilioOperador,
         certificadoMedicoOperador: operador[0].certificadoMedicoOperador,
         antecedentesNoPenalesOperador: operador[0].antecedentesNoPenalesOperador,
         estatusOperador: operador[0].estatusOperador,
         idCliente: Number(operador[0].idCliente),
         nombreCliente: operador[0].nombreCliente,
         apellidoPaternoCliente: operador[0].apellidoPaternoCliente,
         apellidoMaternoCliente: operador[0].apellidoMaternoCliente,
         logotipo: operador[0].logotipo,
         telefono: operador[0].telefono,
         ultimoLogin: operador[0].ultimoLogin,
         fechaCreacion: operador[0].fechaCreacion,
         fotoPerfil: operador[0].fotoOperador,
         deviceId: operador[0].deviceId,
         pinExist: pin,
         userName: user.userName,
         Licencias: operador[0].Licencias,
         rol: user.idRol2,
         token: this.jwtService.sign(payload),
         permisos: permisos,
       };
     } catch (error) {
       if (error instanceof HttpException) {
         throw error;
       }
       throw new InternalServerErrorException(error);
     }
   }
 */
  // ========================================
  //login por correo
  // ========================================
  async signIn(loginAuthDto: LoginAuthDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        relations: ['idRol2', 'cliente2'],
        where: {
          userName: loginAuthDto.userName,
          estatus: 1,
          emailConfirmado: 1,
          cliente2: {
            estatus: 1,
          },

        },
      });
      if (!user) {
        throw new NotFoundException('No se encontró al usuario.');
      }

      if (
        !user ||
        !(await bcrypt.compare(loginAuthDto.password, user.passwordHash))
      ) {
        console.log({
          user: user,
          message: 'Entro a verificar los valores y no son iguales',
        });
        throw new UnauthorizedException('Credenciales invalidas');
      }

      const permisos = await this.permisosRepository.find({
        select: ['idPermiso'],
        where: { idUsuario: user.id, estatus: 1 },
      });

      const payload = {
        id: user.id,
        email: user.userName,
        idCliente: user.idCliente,
        rol: user.idRol,
      };

      const { fechaActual } = await horaDesfasada();
      await this.usuariosRepository.update(user.id, {
        ultimoLogin: fechaActual,
      });


      return {
        message: `login exitoso`,
        id: Number(`${user.id}`),
        nombre: `${user.nombre}`,
        apellidoPaterno: `${user.apellidoPaterno}`,
        apellidoMaterno: `${user.apellidoMaterno}`,
        idCliente: Number(`${user.idCliente}`),
        nombreCliente: `${user.cliente2?.nombre}`,
        apellidoPaternoCliente: `${user.cliente2?.apellidoPaterno}`,
        apellidoMaternoCliente: `${user.cliente2?.apellidoMaterno}`,
        logotipo: `${user.cliente2.logotipo}`,
        telefono: `${user.telefono}`,
        ultimoLogin: `${user.ultimoLogin}`,
        fechaCreacion: `${user.fechaCreacion}`,
        fotoPerfil: `${user.fotoPerfil}`,
        userName: `${user.userName}`,
        rol: user.idRol2,
        token: this.jwtService.sign(payload),
        permisos: permisos,
      };
    } catch (error) {
      console.log(error)
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  // ========================================
  //confirmacion de correo
  // ========================================
  async verifyUser(codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion) {
    try {
      //Buscamos el codigo en la tabla CodigoAutenticacion tiene que ser  Tipo: 0 y Estatus: 1
      const codigoValido = await this.codigoAutenticacioRepository.findOne({
        where: {
          codigo: codigoPasajeroAutenticacion.codigo,
          tipo: TipoCodigoAutenticacion.CONFIRMACION_CORREO,
          usado: EstatusEnum.ACTIVO,
        },
      });

      //En caso de no encontrar manda error
      if (!codigoValido) {
        throw new BadRequestException('Código inválido o ya usado');
      }

      //Buscamos al usuario por la relacion que tiene la tabla CodigoAutenticacion
      const user = await this.usuariosRepository.findOne({
        where: { id: codigoValido.idUsuario },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      //Generamos la fecha con un retraso de 6 horas para que se guarde de manera correcta
      function pad(n: number) {
        return n < 10 ? '0' + n : n;
      }

      const ahora = new Date();
      const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas en milisegundos
      const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

      const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;

      //Verificamos que la fecha no sea mayor a la de expiracion en caso de ser asi
      //el codigo ha expirado
      if (fechaDesfasada > codigoValido.fechaExpiracion) {
        throw new BadRequestException('El código ha expirado');
      }

      //cambiamos el estatus del email a 1 del usuario correspondiente
      await this.usuariosRepository.update(user.id, { emailConfirmado: 1 });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: user.id, EmailConfirmado: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se verifico un usuarios con nombre: ${user.nombre}`,
        'CREATE',
        querylogger,
        Number(user.id),
        2,
        EstatusEnumBitcora.SUCCESS,
      );

      //en la tabla CodigoAutenticacion actualizamos para dar a entender que ya se uso el codigo
      await this.codigoAutenticacioRepository.update(codigoValido.id, {
        usado: EstatusEnum.INACTIVO,
        estatus: EstatusEnum.INACTIVO,
        fechaUso: fechaActual,
      });

      return `La verificación del usuario ${user.nombre} se ha completado con éxito.
Muchas gracias por su preferencia.`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al registrar pasajero.',
        error: error.message,
      });
    }
  }

  // ========================================
  //enviar correo para recuperar contraseña
  // ========================================
  async recuperarContrasena(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    try {
      //Buscamos el usuario por correo
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      //Generamos el codigo
      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.RECUPERACION_CONTRASENA,
      );

      //Generamos el payload para el tokenn
      const payload = {
        id: user.id,
        email: user.userName,
      };

      //Generamos el token
      const token = this.jwtService.sign(payload, {
        expiresIn: `${process.env.JWT_CONFIRMACION}`,
      });
      const name = `${user.nombre} ${user.apellidoPaterno} ${user.apellidoMaterno}`;
      await this.emailService.sendResetPasswordEmail(
        user.userName,
        name,
        token,
        codigo,
      );
      return `Se ha enviado un correo con el codigo.`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al recuperar contraseña del usuario.',
        error: error.message,
      });
    }
  }

  // ========================================
  //Creacion de codigo de autenticacion
  // ========================================
  async generarCodigo(idUsuario: number, tipo: number): Promise<string> {
    // Generar código de 4 dígitos
    const codigo = Math.floor(1000 + Math.random() * 9000).toString();

    //Generamos la fecha de Expiracion
    const ahora = new Date();
    const desfaseMs = -6 * 60 * 60 * 1000; // -6 horas
    const expiracionMs = 15 * 60 * 1000; // +15 minutos

    const expiracion = new Date(ahora.getTime() + expiracionMs + desfaseMs);

    //Buscamos si ya existe un atributo con ese usuario
    const codigoExiste = await this.codigoAutenticacioRepository.findOne({
      where: {
        idUsuario: idUsuario,
      },
    });

    //si existe actualiza los datos
    if (codigoExiste) {
      await this.codigoAutenticacioRepository.update(codigoExiste.id, {
        codigo,
        fechaCreacion: ahora,
        fechaExpiracion: expiracion,
        usado: EstatusEnum.ACTIVO,
        estatus: EstatusEnum.ACTIVO,
        fechaUso: null,
      });
    } else {
      //si no se crea el atributo
      const codigoCreate = this.codigoAutenticacioRepository.create({
        idUsuario: idUsuario,
        codigo: codigo,
        tipo: tipo,
        fechaExpiracion: expiracion,
        usado: EstatusEnum.ACTIVO,
        estatus: EstatusEnum.ACTIVO,
      });
      await this.codigoAutenticacioRepository.save(codigoCreate);
    }

    //regresa el codigo
    return codigo;
  }

  // ========================================
  //recuperar la confirmacion de correo
  // ========================================
  async recuperarConfirmacion(
    loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthConfirmacionDto.userName },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado.');

      const codigo = await this.generarCodigo(
        user.id,
        TipoCodigoAutenticacion.CONFIRMACION_CORREO,
      );

      const payload = {
        id: user.id,
        email: user.userName,
      };
      const token = this.jwtService.sign(payload, {
        expiresIn: `${process.env.JWT_CONFIRMACION}`,
      });
      const name = `${user.nombre} ${user.apellidoPaterno} ${user.apellidoMaterno}`;
      await this.emailService.sendConfirmationEmail(
        user.userName,
        name,
        token,
        codigo,
      );
      return `Se ha enviado un correo con el codigo de autenticación.`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al confirmar el usuario.',
        error: error.message,
      });
    }
  }

  // ========================================
  //actualizar contraseña
  // ========================================
  async resetPassword(loginAuthResetDto: LoginAuthResetDto) {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { userName: loginAuthResetDto.userName },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado');

      const hashedPassword = await bcrypt.hash(loginAuthResetDto.password, 10); //encriptamos la contraseña
      loginAuthResetDto.password = hashedPassword;
      await this.usuariosRepository.update(user.id, {
        passwordHash: hashedPassword,
      });
      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: user.id, EmailConfirmado: 1 };
      await this.bitacoraLogger.logToBitacora(
        'Usuarios',
        `Se actualizo la contraseña del usuarios con ID: ${user.id}`,
        'CREATE',
        querylogger,
        Number(user.id),
        2,
        EstatusEnumBitcora.SUCCESS,
      );
      return `La contraseña del usuario ${user.nombre} ha sido actualizada exitosamente.`;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al actualizar contraseña del usuario.',
        error: error.message,
      });
    }
  }
}
