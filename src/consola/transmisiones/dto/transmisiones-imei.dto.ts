import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Body de `POST /consola/transmisiones`: últimas N posiciones por IMEI. */
export class TransmisionesImeiDto {
  @ApiProperty({
    description: 'IMEI exacto del dispositivo (solo dígitos, hasta 20). Se aplica trim.',
    example: '354442090100880',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,20}$/, {
    message: 'imei debe tener solo dígitos (hasta 20)',
  })
  imei!: string;

  @ApiPropertyOptional({
    description: 'Cantidad de transmisiones a devolver (1..500). Default 50.',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  cantidad?: number;
}
