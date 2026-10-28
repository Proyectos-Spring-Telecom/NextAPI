import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ConsolaGaleriaService } from './consola-galeria.service';
import {
  ConsultaGaleriaDto,
  FiltrosGaleriaQueryDto,
  FotosImeiDto,
  ResumenGaleriaDto,
} from './dto/consola-galeria.dto';

const CANALES = [
  '**Canales (máx. 3 cámaras):** `canal` es la columna de `Posiciones` (0 = `IdFoto`, 1..3 = `IdFoto1..3`),',
  'no el canal físico. El API lo resuelve según el equipo (`idTipoDispositivo`, `canalesActivos`):',
  '- TrackCam (5): la foto N es el N-ésimo canal activo de `TrackcamConfig` → `etiquetaCanal`',
  '  "Vista Afuera" / "Vista Adentro" / "Cámara 3" y `canalReal` 1..3.',
  '- AVL u otros: `etiquetaCanal` "Cámara N", `canalReal` = N.',
  '- Canal 0 (histórico): "Foto Principal", `canalReal` null.',
].join('\n');

const ALCANCE = [
  '**Alcance por rol:**',
  '- Globales (1–5, 8): `idCliente` obligatorio y dentro del alcance del token.',
  '- Cliente (6): `idCliente` opcional (default el del token); debe estar en su jerarquía.',
  '- Operador (7) / Usuario (9): siempre su cliente y **solo** sus unidades asignadas (`UsuariosInstalaciones`).',
].join('\n');

const ALCANCE_IMEI = [
  '**Alcance por rol (IMEI):**',
  '- Globales (1–5, 8): cualquier cliente.',
  '- Cliente (6): la unidad debe pertenecer a un cliente de su jerarquía.',
  '- Operador (7) / Usuario (9): además, la unidad debe estar asignada al usuario del token',
  '  (`UsuariosInstalaciones` activo).',
  '- Si el IMEI no existe o está fuera de alcance → **404** con el mismo mensaje',
  '  (`IMEI no encontrado o sin acceso`); no se revela si existe en otro cliente.',
].join('\n');

@ApiTags('Consola - Galería')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('consola/galeria')
export class ConsolaGaleriaController {
  constructor(private readonly service: ConsolaGaleriaService) {}

  @Get('filtros')
  @ApiOperation({
    summary: 'Usuarios y unidades del cliente para la Galería',
    description: [
      'Una sola llamada para armar los selectores en cascada (Cliente → Usuario → Unidad) sin más HTTP.',
      '',
      '- `instalaciones[]`: unidades **activas** con dispositivo e IMEI (sin paneles), con `etiqueta`',
      '  (placa → `Eco {económico}` → producto → IMEI), `camara` y `idsUsuario[]` asignados.',
      '- `usuarios[]`: usuarios activos del cliente con al menos una unidad asignada (`totalInstalaciones`).',
      '',
      ALCANCE,
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          idCliente: 15,
          nombreCliente: 'Cliente Demo',
          usuarios: [{ id: 5, nombre: 'Juan Pérez López', totalInstalaciones: 2 }],
          instalaciones: [
            {
              idInstalacion: 25,
              etiqueta: 'NU8261A',
              imei: '357042066511073',
              placas: 'NU8261A',
              economico: '18',
              descripcion: 'Tracto 18',
              idTipoProducto: 1,
              idTipoDispositivo: 5,
              camara: 1,
              idsUsuario: [5],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'idCliente faltante o inválido' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async filtros(@Query() query: FiltrosGaleriaQueryDto, @Request() req) {
    return this.service.filtros(
      query.idCliente,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('resumen')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Unidades con fotos en el periodo (secciones de la galería)',
    description: [
      'Una sola consulta agrupada: por cada unidad con al menos una captura con foto en el periodo,',
      'regresa `totalCapturas` y `ultimaCaptura`. Ordenadas por la captura más reciente.',
      'Las fotos de cada sección se piden con `POST /consola/galeria` + `idsInstalacion: [id]`.',
      '',
      '**Body:** `idCliente` (ver alcance), `fechaInicio`, `fechaFinal` (máx. 31 días);',
      '`idsUsuario?` / `idsInstalacion?` opcionales (mismas reglas que `POST /consola/galeria`).',
      '',
      ALCANCE,
    ].join('\n'),
  })
  @ApiBody({
    type: ResumenGaleriaDto,
    examples: {
      porCliente: {
        summary: 'Todas las unidades del cliente',
        value: {
          idCliente: 15,
          fechaInicio: '2026-10-15 00:00:00',
          fechaFinal: '2026-10-22 23:59:59',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          idCliente: 15,
          nombreCliente: 'Lord Logistic',
          fechaInicio: '2026-10-15 00:00:00',
          fechaFinal: '2026-10-22 23:59:59',
          totalCapturas: 57,
          totalUnidades: 2,
          unidades: [
            {
              idInstalacion: 25,
              etiqueta: 'NU8261A',
              imei: '357042066511073',
              placas: 'NU8261A',
              economico: '18',
              descripcion: 'Tracto 18',
              idTipoProducto: 1,
              nombreTipoProducto: 'Vehículo',
              marca: 'Toyota',
              modelo: 'Hilux',
              anio: 2024,
              color: 'Blanco',
              totalCapturas: 40,
              ultimaCaptura: '2026-10-22T09:12:40',
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Fechas inválidas / rango > 31 días' })
  @ApiForbiddenResponse({ description: 'Cliente o unidades fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async resumen(@Body() dto: ResumenGaleriaDto, @Request() req) {
    return this.service.resumen(
      dto,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fotos guardadas (capturas) por cliente, usuario o unidad',
    description: [
      'Capturas = posiciones del periodo con al menos una foto en `Fotos`',
      '(`Posiciones.IdFoto` → canal 0, `IdFoto1..3` → canales 1..3). Solo lectura.',
      '',
      '**Body:** `idCliente` (ver alcance), `idsUsuario?`, `idsInstalacion?`, `fechaInicio`, `fechaFinal`',
      '(hora de pared, máx. 31 días), `page?` (default 1), `limit?` (1..100, default 24).',
      '- `idsUsuario` → solo unidades asignadas a esos usuarios (deben ser del cliente; 400 si no).',
      '- `idsInstalacion` → deben estar dentro del alcance (403 si no).',
      '',
      '**Respuesta:** `{ data: [...], paginated: { total, page, limit, totalPages } }`.',
      'Orden: `fechaHora` DESC. `total` cuenta capturas, no fotos.',
      'Cada captura trae la unidad (`etiqueta`, placas, económico, IMEI), `fechaHora`, `lat`/`lng`,',
      '`velocidad` y `fotos[]` `{ id, canal, url, canalReal, etiquetaCanal }` (`url` = `Fotos.Ruta`, pública).',
      '',
      CANALES,
      '',
      ALCANCE,
    ].join('\n'),
  })
  @ApiBody({
    type: ConsultaGaleriaDto,
    examples: {
      porCliente: {
        summary: 'Todas las unidades del cliente',
        value: {
          idCliente: 15,
          fechaInicio: '2026-10-15 00:00:00',
          fechaFinal: '2026-10-21 23:59:59',
          page: 1,
          limit: 24,
        },
      },
      porUsuario: {
        summary: 'Unidades asignadas a un usuario',
        value: {
          idCliente: 15,
          idsUsuario: [5],
          fechaInicio: '2026-10-15 00:00:00',
          fechaFinal: '2026-10-21 23:59:59',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: [
          {
            idPosicion: 312733396,
            idInstalacion: 25,
            etiqueta: 'NU8261A',
            imei: '357042066511073',
            placas: 'NU8261A',
            economico: '18',
            descripcion: 'Tracto 18',
            fechaHora: '2026-10-21T14:34:35',
            lat: 18.7114,
            lng: -98.89902,
            velocidad: 42,
            fotos: [
              { id: 274300, canal: 1, url: 'https://spcode.ddns.net/registros/274300.jpeg' },
              { id: 274301, canal: 2, url: 'https://spcode.ddns.net/registros/274301.jpeg' },
            ],
          },
        ],
        paginated: { total: 1, page: 1, limit: 24, totalPages: 1 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / rango > 31 días / usuarios ajenos al cliente',
  })
  @ApiForbiddenResponse({ description: 'Cliente o unidades fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async consultar(@Body() dto: ConsultaGaleriaDto, @Request() req) {
    return this.service.consultar(
      dto,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('imei')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fotos de un equipo por IMEI',
    description: [
      'El usuario escribe un IMEI y recibe las fotos de ese equipo, paginadas,',
      'solo si la instalación activa está dentro de su alcance. Una fila por foto',
      '(canales 0..3: `IdFoto` / `IdFoto1..3`). Solo lectura.',
      '',
      '**Body:** `imei` (solo dígitos, hasta 20), `fechaInicio?` / `fechaFinal?` (máx. 31 días;',
      'si se omiten → día 1 del mes actual 00:00:00 hasta hoy 23:59:59),',
      '`page?` (default 1), `limit?` (1..100, default 20).',
      '',
      '**Vigencia:** el inicio efectivo es el mayor entre `fechaInicio` y la primera',
      'vigencia del dispositivo en el cliente actual (`HistoricoInstalaciones` o',
      '`Instalaciones.VigenteDesde`), para no mezclar fotos de un cliente anterior.',
      '',
      '**Orden:** `fechaHora` DESC, `idPosicion` DESC, `canal` ASC.',
      '',
      CANALES,
      '',
      ALCANCE_IMEI,
    ].join('\n'),
  })
  @ApiBody({
    type: FotosImeiDto,
    examples: {
      porImei: {
        summary: 'Fotos del mes actual (pagina 1)',
        value: {
          imei: '354442090100880',
          page: 1,
          limit: 20,
        },
      },
      conRango: {
        summary: 'Fotos en un periodo',
        value: {
          imei: '354442090100880',
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-23 23:59:59',
          page: 1,
          limit: 20,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Fotos paginadas + cabecera de la unidad',
    schema: {
      example: {
        unidad: {
          idInstalacion: 25,
          imei: '354442090100880',
          etiqueta: 'NU8261A',
          placas: 'NU8261A',
          economico: '18',
          marca: 'Toyota',
          modelo: 'Hilux',
          anio: 2024,
          descripcion: 'Tracto 18',
        },
        fechaInicio: '2026-10-01 00:00:00',
        fechaFinal: '2026-10-23 23:59:59',
        data: [
          {
            idFoto: 1562987,
            idPosicion: 96866081,
            canal: 1,
            url: 'https://spcode.ddns.net/registros/1562987.jpeg',
            fechaHora: '2026-10-23T11:25:10',
            lat: 18.71,
            lng: -98.89,
            velocidad: 0,
          },
        ],
        paginated: { total: 128, page: 1, limit: 20, totalPages: 7 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'IMEI inválido / fechas inválidas / rango > 31 días',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  @ApiNotFoundResponse({
    description: 'IMEI no encontrado o sin acceso',
  })
  async fotosPorImei(@Body() dto: FotosImeiDto, @Request() req) {
    return this.service.fotosPorImei(
      dto,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
