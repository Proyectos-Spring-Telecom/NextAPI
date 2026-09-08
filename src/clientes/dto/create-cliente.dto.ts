import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  MaxLength,
  IsEmail,
  IsIn,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from "class-validator";
import { NumeroEmergenciaClienteItemDto } from "./numero-emergencia-cliente-item.dto";

export class CreateClienteDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "IdPadre debe ser un número entero" })
  @ApiProperty({ description: "Id del cliente padre", example: 1, required: false })
  idPadre?: number;

  @IsString()
  @IsNotEmpty({ message: "El RFC es obligatorio" })
  @MaxLength(16, { message: "El RFC no puede exceder los 16 caracteres" })
  @ApiProperty({ description: "RFC del cliente", example: "XAXX010101000" })
  rfc: string;

  @Type(() => Number)
  @IsInt({ message: "TipoPersona debe ser un número entero (1=Física, 2=Moral)" })
  @IsIn([1, 2], { message: "TipoPersona debe ser 1 (Física) o 2 (Moral)" })
  @ApiProperty({ description: "Tipo de persona (1=Física, 2=Moral)", example: 1 })
  tipoPersona: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: "Nombre del cliente", example: "Juan", required: false })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: "Apellido paterno", example: "Pérez", required: false })
  apellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: "Apellido materno", example: "López", required: false })
  apellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  @ApiProperty({ description: "Teléfono", example: "5551234567", required: false })
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: "Debe ser un correo válido" })
  @ApiProperty({ description: "Correo electrónico", example: "cliente@correo.com", required: false })
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: "Sitio web", example: "https://miempresa.com", required: false })
  sitioWeb?: string;

  // ⚡ Dirección
  @IsOptional()
  @IsString()
  @MaxLength(50)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  municipio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  colonia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  calle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  entreCalles?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroExterior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroInterior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  cp?: string;

  // ⚡ Encargado
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombreEncargado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  telefonoEncargado?: string;

  @IsOptional()
  @IsEmail({}, { message: "Debe ser un correo válido" })
  correoEncargado?: string;

  // ⚡ Documentos (obligatorios en creación: URL o archivo multipart en el mismo nombre de campo)
  @IsString()
  @IsNotEmpty({
    message:
      "La constancia de situación fiscal es obligatoria (URL o archivo PDF constanciaSituacionFiscal).",
  })
  @MaxLength(500)
  @ApiProperty({
    description:
      "Obligatorio: URL o enviar el PDF en el campo de archivo `constanciaSituacionFiscal`.",
    required: true,
    maxLength: 500,
  })
  constanciaSituacionFiscal: string;

  @IsString()
  @IsNotEmpty({
    message:
      "El comprobante de domicilio es obligatorio (URL o archivo PDF comprobanteDomicilio).",
  })
  @MaxLength(500)
  @ApiProperty({
    description:
      "Obligatorio: URL o enviar el PDF en el campo de archivo `comprobanteDomicilio`.",
    required: true,
    maxLength: 500,
  })
  comprobanteDomicilio: string;

  @IsString()
  @IsNotEmpty({
    message: "El acta constitutiva es obligatoria (URL o archivo PDF actaConstitutiva).",
  })
  @MaxLength(500)
  @ApiProperty({
    description:
      "Obligatorio: URL o enviar el PDF en el campo de archivo `actaConstitutiva`.",
    required: true,
    maxLength: 500,
  })
  actaConstitutiva: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({
    description: "URL del logotipo (flujo híbrido) o omitir si se envía archivo logotipo",
    required: false,
    maxLength: 500,
  })
  logotipo?: string;

  /**
   * Contactos de emergencia (mínimo 1).
   * En multipart enviar JSON string, p. ej.:
   * `[{"telefono":"5512345678","nombre":"Central","prioridad":1}]`
   */
  @Transform(({ value }) => {
    let parsed: unknown = value;
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
    if (!Array.isArray(parsed)) {
      return parsed;
    }
    return plainToInstance(NumeroEmergenciaClienteItemDto, parsed);
  })
  @IsArray({ message: "numerosEmergencia debe ser un arreglo" })
  @ArrayMinSize(1, {
    message: "Debe registrar al menos un contacto de emergencia",
  })
  @ValidateNested({ each: true })
  @Type(() => NumeroEmergenciaClienteItemDto)
  @ApiProperty({
    type: [NumeroEmergenciaClienteItemDto],
    description:
      "Obligatorio: al menos un contacto de emergencia. En multipart, enviar como JSON string.",
    example: [
      {
        telefono: "5512345678",
        nombre: "Central de monitoreo",
        descripcion: "Línea 24/7",
        prioridad: 1,
      },
    ],
  })
  numerosEmergencia!: NumeroEmergenciaClienteItemDto[];

  // ⚡ Estatus (oculto en Swagger en POST/PATCH cliente; usar PATCH /clientes/estatus/:id)
  @ApiHideProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Estatus debe ser 0 ó 1" })
  @IsIn([0, 1], { message: "Solo puede ser 0 ó 1" })
  estatus?: number = 1;
}
