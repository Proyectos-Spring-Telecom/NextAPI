import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber } from 'class-validator';

export class ValidateFaceDto {
  @ApiProperty({
    description: 'Vector de embedding del rostro (ej. salida de POST /embed en BehaviorIQ)',
    example: [0.01, -0.02],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  embeddings: number[];

  @ApiProperty({ description: 'Latitud', example: 0 })
  @IsNumber()
  @Type(() => Number)
  latitud: number;

  @ApiProperty({ description: 'Longitud', example: 0 })
  @IsNumber()
  @Type(() => Number)
  longitud: number;
}
