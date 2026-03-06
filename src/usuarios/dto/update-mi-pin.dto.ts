import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, Validate } from 'class-validator';
import { PinValidator } from 'src/common/validators/pin.validator';

export class UpdateMiPinDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{6}|\d{8})$/, {
    message: 'El PIN debe tener exactamente 6 u 8 dígitos numéricos',
  })
  @Validate(PinValidator)
  @ApiProperty({
    description: 'NIP de 6 u 8 dígitos',
    examples: ['482915', '93746281'],
  })
  pinHash: string;
}
