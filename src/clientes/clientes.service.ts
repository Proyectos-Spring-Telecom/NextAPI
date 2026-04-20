import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { UpdateClienteEstatusDto } from './dto/update-clientes-estatus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import {
  EnumModulos,
} from 'src/common/estatus.enum';
import { S3Service } from 'src/s3/s3.service';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly s3Service: S3Service,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  /**
   * Resultado de `spGetClientes` (árbol: raíz + descendientes).
   * Nombres en camelCase para consumo JSON (p. ej. Shift).
   */
  async getJerarquiaClientesSp(
    idClienteToken: number,
    rol: number,
    idClienteRaizOpcional?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const rolNum = Number(rol);
      const puedeElegirRaiz = rolNum === 1 || rolNum === 2;
      if (idClienteRaizOpcional !== undefined && !puedeElegirRaiz) {
        throw new ForbiddenException(
          'Solo roles autorizados pueden indicar idClienteRaiz',
        );
      }
      const idRaiz =
        puedeElegirRaiz && idClienteRaizOpcional != null
          ? idClienteRaizOpcional
          : idClienteToken;

      const result = await this.clienteRepository.query(
        'CALL spGetClientes(?);',
        [idRaiz],
      );
      const rows = (result?.[0] ?? []) as Record<string, unknown>[];

      const data = rows.map((row) => ({
        id: Number(row.Id ?? row.id),
        idPadre:
          row.IdPadre == null && row.idPadre == null
            ? null
            : Number(row.IdPadre ?? row.idPadre),
        rfc: String(row.RFC ?? row.rfc ?? ''),
        tipoPersona: Number(row.TipoPersona ?? row.tipoPersona ?? 0),
        estatus: Number(row.Estatus ?? row.estatus ?? 0),
        logo: row.Logo ?? row.logo ?? null,
        nombre: row.Nombre != null ? String(row.Nombre) : null,
        apellidoPaterno:
          row.ApellidoPaterno != null ? String(row.ApellidoPaterno) : null,
        apellidoMaterno:
          row.ApellidoMaterno != null ? String(row.ApellidoMaterno) : null,
        telefono: row.Telefono != null ? String(row.Telefono) : null,
        correo: row.Correo != null ? String(row.Correo) : null,
        nombrePadre: row.Padre != null ? String(row.Padre) : null,
      }));

      return { data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        (error as Error)?.message ?? 'Error al obtener jerarquía de clientes',
      );
    }
  }

  // ========================================
  // 🔹 CREAR UN CLIENTE
  // ========================================
  async createCliente(
    createClienteDto: CreateClienteDto,
    idUser: number,
    fileActa?: Express.Multer.File,
    fileComprobante?: Express.Multer.File,
    fileConstanciaSituacionFiscal?: Express.Multer.File,
    fileLogotipo?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos al cliente y verificamos
      const clienteCreate = await this.clienteRepository.findOne({
        where: {
          rfc: createClienteDto.rfc,
        },
      });
      if (clienteCreate) {
        throw new BadRequestException(
          `Cliente ya registrado con RFC: ${createClienteDto.rfc}. Por favor, ingrese un RFC diferente.`,
        );
      }

      const {
        actaConstitutiva: dtoActa,
        comprobanteDomicilio: dtoComp,
        constanciaSituacionFiscal: dtoCsf,
        logotipo: dtoLogo,
        ...restDto
      } = createClienteDto;

      const urlFromBody = (v: string | null | undefined) =>
        v && String(v).trim() ? String(v).trim() : null;

      let actaConstitutiva = urlFromBody(dtoActa);
      let comprobanteDomicilio = urlFromBody(dtoComp);
      let constanciaSituacionFiscal = urlFromBody(dtoCsf);
      let logotipo = urlFromBody(dtoLogo);

      if (fileActa) {
        const { url } = await this.s3Service.uploadFile(
          fileActa,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        actaConstitutiva = url;
      }
      if (fileComprobante) {
        const { url } = await this.s3Service.uploadFile(
          fileComprobante,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        comprobanteDomicilio = url;
      }
      if (fileConstanciaSituacionFiscal) {
        const { url } = await this.s3Service.uploadFile(
          fileConstanciaSituacionFiscal,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        constanciaSituacionFiscal = url;
      }
      if (fileLogotipo) {
        const { url } = await this.s3Service.uploadFile(
          fileLogotipo,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        logotipo = url;
      }

      if (!actaConstitutiva?.trim()) {
        throw new BadRequestException(
          'Debe proporcionar el acta constitutiva (URL o archivo PDF).',
        );
      }
      if (!comprobanteDomicilio?.trim()) {
        throw new BadRequestException(
          'Debe proporcionar el comprobante de domicilio (URL o archivo PDF).',
        );
      }
      if (!constanciaSituacionFiscal?.trim()) {
        throw new BadRequestException(
          'Debe proporcionar la constancia de situación fiscal (URL o archivo PDF).',
        );
      }

      //Creamos el nuevo cliente
      const clienteData = await this.clienteRepository.create({
        ...restDto,
        actaConstitutiva,
        comprobanteDomicilio,
        constanciaSituacionFiscal,
        logotipo,
      });
      const clienteCreado = await this.clienteRepository.save(clienteData);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createClienteDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente creado correctamente con RFC: ${createClienteDto.rfc}.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );


      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El cliente ha sido creado correctamente.',
        data: {
          id: clienteCreado.id,
          nombre:
            `${clienteCreado.nombre} ${clienteCreado.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createClienteDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente creado correctamente con RFC: ${createClienteDto.rfc}.`,
        'CREATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al intentar crear un cliente.',
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 OBTENER PAGINADO DE CLIENTES
  // ========================================
  async getAllClientes(
    idUser: number,
    cliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const offset = (page - 1) * limit;
      const tenant = await this.tenantFilter.build(rol, cliente, 'c', 'Id');
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      const selectFrom = `
SELECT
  c.Id AS id,
  c.RFC AS rfc,
  c.TipoPersona AS tipoPersona,
  c.Nombre AS nombre,
  c.ApellidoPaterno AS apellidoPaterno,
  c.ApellidoMaterno AS apellidoMaterno,
  c.Telefono AS telefono,
  c.Correo AS correo,
  c.Estado AS estado,
  c.Municipio AS municipio,
  c.Colonia AS colonia,
  c.Calle AS calle,
  c.EntreCalles AS entreCalles,
  c.NumeroExterior AS numeroExterior,
  c.NumeroInterior AS numeroInterior,
  c.CP AS cp,
  c.NombreEncargado AS nombreEncargado,
  c.TelefonoEncargado AS telefonoEncargado,
  c.CorreoEncargado AS correoEncargado,
  c.ConstanciaSituacionFiscal AS constanciaSituacionFiscal,
  c.ComprobanteDomicilio AS comprobanteDomicilio,
  c.ActaConstitutiva AS actaConstitutiva,
  c.Logotipo AS logotipo,
  c.Estatus AS estatus
FROM Clientes c
WHERE 1 = 1
${tenant.sql}
ORDER BY c.Id ASC`;

      const clientes = await this.clienteRepository.query(
        `${selectFrom}
LIMIT ? OFFSET ?`,
        [...tenant.params, limit, offset],
      );

      const totalResult = await this.clienteRepository.query(
        `SELECT COUNT(*) AS total FROM Clientes c WHERE 1 = 1 ${tenant.sql}`,
        [...tenant.params],
      );

      const data = clientes.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const total = Number(totalResult[0]?.total || 0);

      const result: ApiResponseCommon = {
        data,
        paginated: {
          total: total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Ocurrió un error al obtener paginados de los clientes.',
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN LISTADO DE CLIENTES
  // ========================================
  async getAllListClientes(
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.build(rol, cliente, 'c', 'Id');
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const clientes = await this.clienteRepository.query(
        `
SELECT
  c.Id AS id,
  c.Nombre AS nombre,
  c.ApellidoPaterno AS apellidoPaterno,
  c.ApellidoMaterno AS apellidoMaterno,
  c.Logotipo AS logotipo
FROM Clientes c
WHERE c.Estatus = 1
${tenant.sql}
ORDER BY c.Id ASC
`,
        [...tenant.params],
      );

      const data = clientes.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Ocurrió un error al obtener listado de los clientes.',
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN LISTADO POR ID CLIENTE
  // ========================================
  async getAllListClientesId(
    idUser: number,
    cliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const ids = await this.tenantFilter.getClienteHijosIds(cliente);
      if (ids.length === 0) {
        return { data: [] };
      }
      const placeholders = ids.map(() => '?').join(', ');
      const clientes = await this.clienteRepository.query(
        `
SELECT
  Id AS id,
  Nombre AS nombre,
  ApellidoPaterno AS apellidoPaterno,
  ApellidoMaterno AS apellidoMaterno
FROM Clientes
WHERE Id IN (${placeholders})
ORDER BY Id ASC
`,
        [...ids],
      );

      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = clientes.map((item) => ({
        ...item,
        id: Number(item.id),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      console.log(error)
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: 'Ocurrió un error al obtener listado de los clientes.',
      });
    }
  }

  // ========================================
  // 🔹 OBTENER UN CLIENTE
  // ========================================
  async getOneCliente(id: number) {
    try {
      const cliente = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }
      return { data: cliente };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({
        message: `Error al obtener el cliente con ID: ${id}.`,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR CLIENTE
  // ========================================
  async updateCliente(
    id: number,
    idUser: number,
    updateClienteDto: UpdateClienteDto,
    fileActa?: Express.Multer.File,
    fileComprobante?: Express.Multer.File,
    fileConstanciaSituacionFiscal?: Express.Multer.File,
    fileLogotipo?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      //Buscamos al cliente y verificamos
      const Cliente = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!Cliente) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      const {
        actaConstitutiva: dtoActa,
        comprobanteDomicilio: dtoComp,
        constanciaSituacionFiscal: dtoCsf,
        logotipo: dtoLogo,
        ...restDto
      } = updateClienteDto;

      const payload: Record<string, unknown> = { ...restDto };

      if (fileActa) {
        const { url } = await this.s3Service.updateFile(
          Cliente.actaConstitutiva,
          fileActa,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        payload.actaConstitutiva = url;
      } else if (dtoActa !== undefined) {
        payload.actaConstitutiva = dtoActa;
      }

      if (fileComprobante) {
        const { url } = await this.s3Service.updateFile(
          Cliente.comprobanteDomicilio,
          fileComprobante,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        payload.comprobanteDomicilio = url;
      } else if (dtoComp !== undefined) {
        payload.comprobanteDomicilio = dtoComp;
      }

      if (fileConstanciaSituacionFiscal) {
        const { url } = await this.s3Service.updateFile(
          Cliente.constanciaSituacionFiscal,
          fileConstanciaSituacionFiscal,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        payload.constanciaSituacionFiscal = url;
      } else if (dtoCsf !== undefined) {
        payload.constanciaSituacionFiscal = dtoCsf;
      }

      if (fileLogotipo) {
        const { url } = await this.s3Service.updateFile(
          Cliente.logotipo,
          fileLogotipo,
          'clientes',
          idUser,
          EnumModulos.CLIENTES,
        );
        payload.logotipo = url;
      } else if (dtoLogo !== undefined) {
        payload.logotipo = dtoLogo;
      }

      //Actualizamos datos del cliente
      await this.clienteRepository.update(id, payload as Partial<Clientes>);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateClienteDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente con ID: ${id} actualizado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      //buscamos el cliente ya actualizados
      const clientefind = await this.clienteRepository.findOne({
        where: { id: id },
      });
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Cliente actualizado correctamente.',
        data: {
          id: id,
          nombre:
            `${clientefind?.nombre} ${clientefind?.apellidoPaterno} ` || '',
        },
      };
      return result;
    } catch (error) {
      console.log(error)
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateClienteDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Cliente con ID: ${id} actualizado correctamente.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al actualizar la información del cliente con ID: ${id}`,
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ACTUALIZAR ESTATUS DEL CLIENTE
  // ========================================
  async updateClienteStatus(
    id: number,
    idUser: number,
    cliente: number,
    updateClienteEstatusDto: UpdateClienteEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const clienteEntidad = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!clienteEntidad) {
        throw new NotFoundException(`Cliente con ID: ${id} no encontrado`);
      }

      const idsJerarquia = await this.tenantFilter.getClienteHijosIds(id);
      const idsUpdate = idsJerarquia.length > 0 ? idsJerarquia : [id];
      const placeholders = idsUpdate.map(() => '?').join(', ');

      //Obtenemos el valor de estatus
      const estatus = updateClienteEstatusDto.estatus;

      //Hacemos eliminado logico al cliente padre e hijos
      await this.clienteRepository.query(
        `
        UPDATE Clientes
        SET Estatus = ${estatus}
        WHERE Id IN (${placeholders})
        `,
        [...idsUpdate],
      );

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateClienteEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `El estatus del cliente con ID ${id} se modificó exitosamente a: ${estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus del cliente actualizado correctamente.',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre:
            `${clienteEntidad.nombre ?? ''} ${clienteEntidad.apellidoPaterno ?? ''}`.trim() ||
            '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateClienteEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se cambió el estatus del cliente con ID: ${id} a estatus: ${updateClienteEstatusDto.estatus}.`,
        'UPDATE',
        querylogger,
        idUser,
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al cambiar el estatus del cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }

  // ========================================
  // 🔹 ELIMINAR CLIENTES
  // ========================================
  async removeCliente(
    id: number,
    idUser: number,
    cliente: number,
  ): Promise<ApiCrudResponse> {
    try {

      //Buscamos al cliente y verificamos
      const clienteEliminar = await this.clienteRepository.findOne({
        where: { id: id },
      });
      if (!clienteEliminar) {
        throw new NotFoundException(
          `El cliente con ID: ${id} no fue encontrado.`,
        );
      }

      const idsCascadeRaw = await this.tenantFilter.getClienteHijosIds(id);
      const idsCascade =
        idsCascadeRaw.length > 0 ? idsCascadeRaw : [id];
      const placeholdersCascade = idsCascade.map(() => '?').join(', ');

      await this.clienteRepository.query(
        `
        UPDATE Clientes
        SET Estatus = 0
        WHERE Id IN (${placeholdersCascade})
        `,
        [...idsCascade],
      );

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'El cliente fue eliminado correctamente.',
        data: {
          id: id,
          nombre:
            `${clienteEliminar.nombre} ${clienteEliminar.apellidoPaterno} ` ||
            '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Clientes',
        `Se eliminó el cliente con ID: ${id}.`,
        'UPDATE',
        querylogger,
        Number(idUser),
        EnumModulos.CLIENTES,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: `Error al eliminar el cliente con ID: ${id}.`,
        error: error.message,
      });
    }
  }
}
