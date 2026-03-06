import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private mailUser: string;

  constructor() {
    const host = process.env.HOST;
    const smtpPort = Number(process.env.SMTP);
    const mailUser = process.env.E_MAIL;
    const mailPassword = process.env.MAIL_PASSWORD;

    if (!host || !Number.isFinite(smtpPort) || !mailUser || !mailPassword) {
      throw new Error(
        'Faltan variables de entorno SMTP requeridas: HOST, SMTP, E_MAIL, MAIL_PASSWORD',
      );
    }

    this.mailUser = mailUser;
    this.transporter = nodemailer.createTransport({
      host,
      port: smtpPort,
      secure: true,
      auth: {
        user: mailUser,
        pass: mailPassword,
      },
    });
  }

  

  async sendConfirmationEmail(
    to: string,
    name: string,
    token: string,
    codigo: string,
  ): Promise<void> {
    try {
      const dominio =
        process.env.MAIL_FRONTEND_URL || 'https://transmovi.mx/transmoviDev';
      const url = `${dominio}/#/account/verify?token=${token}`;

      await this.transporter.sendMail({
        from: `<${this.mailUser}>`,
      to,
      subject: '¡Bienvenido!',
      html: `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>

<body style="font-family: 'Open Sans', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table width="550px"
                    style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;"
                    cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #002136; color: #FFFFFF; padding: 1rem; ">
                            <a href="#">
                                <img src="https://transmovi.s3.us-east-2.amazonaws.com/logos/transmovi.png" alt="logo"
                                    style="height: 95px;">
                            </a>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 2rem; " align="center">
                            <h5 style="color: #002136; font-size: 30px; text-align:center">
                                ¡Bienvenido, ${name}!
                            </h5>
                            <p
                                style="color: #002136; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">
                                Gracias por registrarte en <strong>Transmovi.</strong></p>
                            <p style="font-size:16px; color:#002136; margin:15px 0 25px 0;">Para confirmar tu cuenta,
                                utiliza el siguiente código de verificación:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td
                                        style="background-color:#43cc7a; color:#ffffff; font-size:28px; font-weight:bold; padding:18px 25px; border-radius:10px; letter-spacing:8px; font-family:monospace;">
                                        ${codigo}
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size:15px; color:#555555; margin:30px 0 0 0;">Ingresa este código en la
                                página de confirmación para activar tu cuenta.</p>
                    </tr>
                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 2rem; ">
                            <hr
                                style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;">
                        </td>
                    </tr>
                    <!-- Nota -->
                    <tr>
                        <td style="padding:0 30px 25px 30px; color:#666666; font-size:14px; text-align:left;">
                            <p style="margin:0 0 10px 0;"><strong>Nota:</strong> Este correo fue enviado
                                automáticamente. Por favor, no respondas a este mensaje.</p>
                            <p style="margin:0;">Si no solicitaste esta verificación, puedes ignorar este correo
                                electrónico.</p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #002136; color: #FFFFFF; padding: 2rem; " align="center">
                            <!-- Contenido del footer aquí -->
                            <h5
                                style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;">
                                <b>Gracias
                                    por registrarte con nosotros.</b></h5><br>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita
                                ayuda o tiene
                                preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un
                                correo
                                electrónico a contacto@transmovi.mx</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,
                            </p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Transmovi</p>
                            <br>
                            <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Transmovi, Av.
                                Independencia Manzana #016, Col. Centro, 50000 Toluca de Lerdo, México.
                                RFC:QSY240515579</p>
                            <!-- Redes sociales y más -->
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>

      `,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al enviar el correo de confirmación.',
      );
    }
  }

  async sendResetPasswordEmail(
    to: string,
    name: string,
    token: string,
    codigo: string,
  ): Promise<void> {
    try {
      const dominio =
        process.env.MAIL_FRONTEND_URL ||
        'https://springtelecom.mx/shiftcontrolapp';
      const url = `${dominio}/#/nueva-contrasena?token=${token}`;

      await this.transporter.sendMail({
        from: ` <${this.mailUser}>`,
      to,
      subject: 'Restablecer Contraseña',
      html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
    </head>
    <body style="font-family: 'Open Sans', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <table width="550px" style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;" cellpadding="0" cellspacing="0">
                        <!-- Header -->
                        <tr>
                            <td  style="background-color: #021d6a; color: #FFFFFF; padding: 1rem; ">
                                <a href="#">
                                    <img src="https://analiticadevideo.s3.us-east-1.amazonaws.com/Imagenes/spring_white.png" alt="logo" style="height: 95px;">
                                </a>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td  style="padding: 0 2rem; "  align="center">
                                <h5 style="color: #691330; font-size: 30px; text-align:center">
                                    Restablecer Contraseña
                                </h5>
                                <p style="color: #000; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">Hola, haz click en el siguiente botón para restablecer tu contraseña. Si no has solicitado una nueva contraseña, <strong>ignora este correo</strong>.</p>
                                <a href="${url}" style="font-size: 18px; padding: 0.9rem; background-color: #691330; color: #FFFFFF; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 13px; ">Restablecer Contraseña</a>
                            </td>
                        </tr>
                        <!-- Divider -->
                        <tr><td  style="padding: 0 2rem; "><hr style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;"></td></tr>
                        <tr>
                            <td  style="padding: 0 2rem; "><br>
                                <p style="margin: 0; font-size: 16px; font-family: 'Open Sans', sans-serif;"><strong>Nota: </strong>Recibes este correo electrónico porque has solicitado restablecer tu contraseña. Si no estas seguro/a de por qué estás recibiendo esto ignoralo.</p>
                                <p >Atentamente,</p>
                                <p style="margin-top: -10px;"><strong>Spring Telecom</strong></p>
                            <br>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #021d6a; color: #FFFFFF; padding: 2rem; " align="center">
                                <!-- Contenido del footer aquí -->                  
                                <h5 style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;"><b>Tu entorno unificado para la gestión y análisis.</b></h5><br>
                                <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita ayuda o tiene
                                    preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un correo
                                    electrónico a contacto@springtelecom.mx</p>
                                <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,</p>
                                <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Spring Telecom</p>
                                <br>
                                <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Spring Telecom, C. San Cristóbal 103 piso 2, San Cristóbal, 62250 Cuernavaca, Morelos.</p>
                                <!-- Redes sociales y más -->
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al enviar el correo de restablecimiento de contraseña.',
      );
    }
  }
}
