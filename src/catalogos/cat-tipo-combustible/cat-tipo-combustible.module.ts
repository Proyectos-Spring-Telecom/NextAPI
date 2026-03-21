import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatTipoCombustibleController } from './cat-tipo-combustible.controller';
import { CatTipoCombustibleService } from './cat-tipo-combustible.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatTipoCombustible]),
    BitacoraModule,
  ],
  controllers: [CatTipoCombustibleController],
  providers: [CatTipoCombustibleService],
  exports: [CatTipoCombustibleService],
})
export class CatTipoCombustibleModule {}
