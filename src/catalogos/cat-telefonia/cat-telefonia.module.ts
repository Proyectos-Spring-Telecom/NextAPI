import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTelefoniaController } from './cat-telefonia.controller';
import { CatTelefoniaService } from './cat-telefonia.service';

@Module({
  imports: [TypeOrmModule.forFeature([CatTelefonia, CatPlanesTelefonia]), BitacoraModule],
  controllers: [CatTelefoniaController],
  providers: [CatTelefoniaService],
  exports: [CatTelefoniaService],
})
export class CatTelefoniaModule {}
