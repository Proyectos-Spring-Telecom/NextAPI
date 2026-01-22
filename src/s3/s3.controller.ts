import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UploadDto } from './dto/update-s3.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('S3 - archivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3) // Todos los roles pueden subir archivos
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new Error('Solo se permiten PNG, JPG, JPEG o PDF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDto,
    @Request() req,
  ) {
    const { folder, idModule } = body;
    const idUser = req.user.userId;

    if (!file) throw new BadRequestException('Archivo requerido');

    return this.s3Service.uploadFile(file, folder, idUser, Number(idModule));
  }
}
