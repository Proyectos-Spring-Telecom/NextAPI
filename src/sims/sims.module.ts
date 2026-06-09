import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { SimsController } from './sims.controller';
import { SimsService } from './sims.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sims, CatTelefonia, CatPlanesTelefonia]),
    BitacoraModule,
    TenantFilterModule,
  ],
  controllers: [SimsController],
  providers: [SimsService],
  exports: [SimsService],
})
export class SimsModule {}
