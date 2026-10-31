import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ContactoAgendaDto {
  @IsString()
  @MaxLength(10)
  nombre: string;

  @IsString()
  @MaxLength(20)
  telefono: string;
}

export class NumerosEmergenciaRelojDto {
  @ApiPropertyOptional({ description: 'Hasta 3 números SOS, en el orden en que el reloj marca.', example: ['7771234567', '7779876543'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  sos?: string[];

  @ApiPropertyOptional({ description: 'Número del centro (recibe los SMS del reloj); null lo borra.', example: '7771234567', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  centro?: string | null;

  @ApiPropertyOptional({
    description: 'Agenda del reloj, hasta 15 contactos (nombre hasta 10 caracteres).',
    example: [{ nombre: 'Hija', telefono: '7771112222' }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => ContactoAgendaDto)
  agenda?: ContactoAgendaDto[];
}
