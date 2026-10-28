import { ApiProperty, IntersectionType, OmitType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { CreateDispositivosDto } from '../../dto/create-dispositivos.dto';
import { RELOJ_IMEI_RE, RELOJ_NUMERO_SERIE_RE } from '../reloj-config.keys';
import { RelojConfigDto } from './reloj-config.dto';

class RelojIdentidadDto {
  @ApiProperty({
    description: 'ID del reloj de 10 dígitos (el que manda en cada trama `[3G*ID*…]`) o su IMEI',
    example: '6907850461',
  })
  @IsString()
  @Matches(RELOJ_NUMERO_SERIE_RE, { message: 'numeroSerie del reloj: ID de 10 dígitos o IMEI de 15' })
  numeroSerie: string;

  @ApiProperty({
    description: 'IMEI de 15 dígitos; con él se asocia la telemetría',
    example: '863269078504617',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(RELOJ_IMEI_RE, { message: 'imei del reloj: 15 dígitos' })
  imei: string;
}

export class CreateRelojDto extends IntersectionType(
  OmitType(CreateDispositivosDto, ['idTipoDispositivo', 'numeroSerie', 'imei', 'camara'] as const),
  IntersectionType(RelojIdentidadDto, RelojConfigDto),
) {}
