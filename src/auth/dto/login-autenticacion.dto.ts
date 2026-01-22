import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CodigoPasajeroAutenticacion{

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
                description: 'Usuario',
                example: 'ejemplo@ejemplo.com',
            })
    codigo:string;
}