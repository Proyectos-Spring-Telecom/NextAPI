import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';

@Injectable()
export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor(private readonly bitacoraLogger: BitacoraLoggerService) {
    this.client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.AWS_S3_BUCKET!;
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const key = urlObj.pathname.startsWith('/')
        ? urlObj.pathname.substring(1)
        : urlObj.pathname;
      return key && key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    idUser: number,
    idModule: number,
  ) {
    try {
      if (!file) throw new BadRequestException('Archivo requerido');

      // Validar tipo de archivo
      const allowedMimeTypes = [
        'image/png',
        'image/jpg',
        'image/jpeg',
        'application/pdf',
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Solo se permiten PNG, JPG, JPEG o PDF');
      }

      if (file.size >= Number(process.env.UPLOAD_MAX_SIZE)) {
        throw new BadRequestException('Archivo demasiado grande');
      }

      // Definir extensión
      let extension = '';
      if (file.mimetype === 'image/png') extension = 'png';
      else if (file.mimetype === 'image/jpg') extension = 'jpg';
      else if (file.mimetype === 'image/jpeg') extension = 'jpeg';
      else if (file.mimetype === 'application/pdf') extension = 'pdf';

      const key = `${folder}/${uuid()}.${extension}`;

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'private', // sigue siendo privado
        }),
      );

      const publicUrl = `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { data: `INSERT INTO ${folder} (...) VALUES (...) -> bucket:  ${this.bucket} url: ${publicUrl}` };
      await this.bitacoraLogger.logToBitacora(
        `${folder}`,
        `Se subio archivo al bucket: ${this.bucket}`,
        'CREATE',
        querylogger,
        idUser,
        idModule,
        EstatusEnumBitcora.SUCCESS,
      );

      return { url: publicUrl };
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { data: `INSERT INTO ${folder} (...) VALUES (...) -> bucket:  ${this.bucket}` };
      await this.bitacoraLogger.logToBitacora(
        `${folder}`,
        `Se subio archivo al bucket: ${this.bucket}`,
        'CREATE',
        querylogger,
        idUser,
        idModule,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error subiendo el archivo a S3');
    }
  }

  async deleteFile(
    fileUrl: string | null | undefined,
    idUser: number,
    idModule: number,
  ): Promise<{ deleted: boolean; key?: string }> {
    if (
      fileUrl === null ||
      fileUrl === undefined ||
      String(fileUrl).trim() === ''
    ) {
      return { deleted: false };
    }

    const trimmed = String(fileUrl).trim();
    const key = this.extractKeyFromUrl(trimmed);
    if (!key) {
      return { deleted: false };
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const modulo = key.split('/')[0] || 's3';
      const querylogger = {
        data: `DELETE from bucket ${this.bucket} key: ${key} url: ${trimmed}`,
      };
      await this.bitacoraLogger.logToBitacora(
        modulo,
        `Se eliminó archivo del bucket: ${this.bucket}`,
        'DELETE',
        querylogger,
        idUser,
        idModule,
        EstatusEnumBitcora.SUCCESS,
      );

      return { deleted: true, key };
    } catch (error) {
      const modulo = key.split('/')[0] || 's3';
      const querylogger = {
        data: `DELETE from bucket ${this.bucket} key: ${key}`,
      };
      await this.bitacoraLogger.logToBitacora(
        modulo,
        `Error al eliminar archivo del bucket: ${this.bucket}`,
        'DELETE',
        querylogger,
        idUser,
        idModule,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Error eliminando el archivo en S3');
    }
  }

  async updateFile(
    oldUrl: string | null | undefined,
    newFile: Express.Multer.File,
    folder: string,
    idUser: number,
    idModule: number,
  ): Promise<{ url: string }> {
    const result = await this.uploadFile(newFile, folder, idUser, idModule);

    if (oldUrl) {
      this.deleteFile(oldUrl, idUser, idModule).catch((err: Error) => {
        const errorMessage = err?.message ?? String(err);
        void this.bitacoraLogger.logToBitacora(
          folder,
          `No se pudo eliminar archivo anterior: ${oldUrl}`,
          'DELETE',
          { oldUrl, error: errorMessage },
          idUser,
          idModule,
          EstatusEnumBitcora.ERROR,
          errorMessage,
        );
      });
    }

    return result;
  }
  

  async getPresignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }
}
