import { Module } from '@nestjs/common';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { JwtOLlaveApiGuard } from './jwt-o-llave-api.guard';
import { LlavesApiController } from './llaves-api.controller';
import { LlavesApiService } from './llaves-api.service';

@Module({
  imports: [TenantFilterModule, BitacoraModule],
  controllers: [LlavesApiController],
  providers: [LlavesApiService, JwtOLlaveApiGuard],
  exports: [LlavesApiService, JwtOLlaveApiGuard],
})
export class LlavesApiModule {}
