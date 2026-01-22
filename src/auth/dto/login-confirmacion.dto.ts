import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginAuthConfirmacionDto{
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
                description: 'Usuario',
                example: 'ejemplo@ejemplo.com',
            })
    userName:string;
}