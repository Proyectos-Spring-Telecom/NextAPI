import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginAuthResetDto{
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
                description: 'Usuario',
                example: 'ejemplo@ejemplo.com',
            })
    userName:string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
            description: 'Contraseña',
            example: 'contraseña1',
        })
    password: string;
}