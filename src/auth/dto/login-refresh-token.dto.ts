import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJ...refresh...',
  })
  refreshToken: string;
}

