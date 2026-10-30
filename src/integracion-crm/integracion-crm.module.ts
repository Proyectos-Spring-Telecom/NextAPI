import { Module } from '@nestjs/common';
import { ClientesModule } from 'src/clientes/clientes.module';
import { IntegracionCrmController } from './integracion-crm.controller';
import { IntegracionCrmService } from './integracion-crm.service';

@Module({
  imports: [ClientesModule],
  controllers: [IntegracionCrmController],
  providers: [IntegracionCrmService],
})
export class IntegracionCrmModule {}
