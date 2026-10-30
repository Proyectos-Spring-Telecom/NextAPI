import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CatMotivosOrdenServicio } from 'src/entities/CatMotivosOrdenServicio';
import { CatOrdenServicioOpciones } from 'src/entities/CatOrdenServicioOpciones';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { OrdenServicioArchivos } from 'src/entities/OrdenServicioArchivos';
import { OrdenServicioRespuestas } from 'src/entities/OrdenServicioRespuestas';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';
import { Dispositivos } from 'src/entities/Dispositivos';
import { OrdenServicioPruebas } from 'src/entities/OrdenServicioPruebas';
import { Sims } from 'src/entities/Sims';
import { MailModule } from 'src/mail/mail.module';
import { Vehiculos } from 'src/entities/Vehiculos';
import { InstalacionesModule } from 'src/instalaciones/instalaciones.module';
import { S3Module } from 'src/s3/s3.module';
import { IntegracionOrdenesController } from './integracion-ordenes.controller';
import { OrdenesFlujoService } from './ordenes-flujo.service';
import { OrdenesServicioPdfService } from './ordenes-servicio-pdf.service';
import { OrdenesServicioController } from './ordenes-servicio.controller';
import { OrdenesServicioService } from './ordenes-servicio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrdenesServicio,
      OrdenServicioRespuestas,
      OrdenServicioArchivos,
      CatOrdenServicioOpciones,
      Clientes,
      Instalaciones,
      Productos,
      Usuarios,
      Vehiculos,
      CatMotivosOrdenServicio,
      OrdenServicioPruebas,
      Dispositivos,
      Sims,
    ]),
    InstalacionesModule,
    S3Module,
    BitacoraModule,
    MailModule,
  ],
  controllers: [OrdenesServicioController, IntegracionOrdenesController],
  providers: [OrdenesServicioService, OrdenesFlujoService, OrdenesServicioPdfService],
})
export class OrdenesServicioModule {}
