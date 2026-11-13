import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EVENTOS_WEBHOOK } from '../webhooks-cliente.util';

export class CrearWebhookDto {
  @ApiProperty({
    description: 'Cliente dueño (recibe sus eventos y los de sus hijos).',
    example: 15,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente!: number;

  @ApiProperty({ example: 'Torre de Control Fis Fiber' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    description: 'Solo https y a un servidor público.',
    example: 'https://torre.fisfiber.mx/next/eventos',
  })
  @IsString()
  @MaxLength(500)
  url!: string;

  @ApiProperty({
    enum: EVENTOS_WEBHOOK,
    isArray: true,
    example: ['alerta.abierta', 'geocerca.entrada', 'geocerca.salida'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...EVENTOS_WEBHOOK], {
    each: true,
    message: `cada evento debe ser uno de: ${EVENTOS_WEBHOOK.join(', ')}`,
  })
  eventos!: string[];
}
