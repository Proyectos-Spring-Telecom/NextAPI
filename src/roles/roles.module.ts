import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { Roles } from 'src/entities/Roles';

@Module({
  imports: [
      TypeOrmModule.forFeature([Roles]),
      BitacoraModule,
    ],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
