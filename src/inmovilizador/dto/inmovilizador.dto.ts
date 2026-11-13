import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, Matches } from 'class-validator';

export class SolicitarInmovilizadorDto {
  @ApiProperty({ enum: ['paro', 'reanudar'], example: 'paro' })
  @IsIn(['paro', 'reanudar'])
  accion!: 'paro' | 'reanudar';

  @ApiProperty({
    description: 'Por qué (queda en bitácora). Mínimo 10 caracteres.',
    example: 'Robo reportado por el cliente, folio 1234',
  })
  @IsString()
  @Length(10, 300)
  motivo!: string;
}

export class ConfirmarInmovilizadorDto {
  @ApiProperty({ description: 'El código que devolvió la solicitud (vale 2 min).' })
  @Matches(/^[0-9a-f]{32}$/, { message: 'codigo inválido' })
  codigo!: string;
}
