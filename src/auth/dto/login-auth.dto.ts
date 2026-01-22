import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginAuthDto{
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