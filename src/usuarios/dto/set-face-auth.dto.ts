import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetFaceAuthDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({
    description: 'Identificador de Face Auth a asociar al usuario autenticado',
    example: 1001,
  })
  idFaceAuth: number;
}
