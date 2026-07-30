import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatPlanesTelefoniaController } from './cat-planes-telefonia.controller';
import { CatPlanesTelefoniaService } from './cat-planes-telefonia.service';

@Module({
  imports: [TypeOrmModule.forFeature([CatPlanesTelefonia, CatTelefonia]), BitacoraModule],
  controllers: [CatPlanesTelefoniaController],
  providers: [CatPlanesTelefoniaService],
  exports: [CatPlanesTelefoniaService],
})
export class CatPlanesTelefoniaModule {}
