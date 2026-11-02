import { Module } from '@nestjs/common';
import { ClientesModule } from 'src/clientes/clientes.module';
import { InstalacionesModule } from 'src/instalaciones/instalaciones.module';
import { IntegracionCrmController } from './integracion-crm.controller';
import { IntegracionCrmService } from './integracion-crm.service';

@Module({
  imports: [ClientesModule, InstalacionesModule],
  controllers: [IntegracionCrmController],
  providers: [IntegracionCrmService],
})
export class IntegracionCrmModule {}
