import { IsIn, IsInt, IsNotEmpty } from "class-validator";

export class UpdatePermisoEstatusDto {
  @IsNotEmpty({ message: 'Confirmar estatus en valor de 0 ó 1' })
  @IsInt({ message: 'estatus debe ser un número entero' })
  @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
  estatus: number;
}