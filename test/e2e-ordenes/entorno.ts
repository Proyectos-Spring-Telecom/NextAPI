import { ChildProcess, spawn } from 'child_process';
import { createHmac, randomUUID } from 'crypto';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { createServer as crearServidorHttp, request as peticionHttp, Server } from 'http';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { INestApplication } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { MysqlDesechable } from './mysql-desechable';

/**
 * Entorno de punta a punta de las órdenes de servicio: MySQL desechable con las
 * bases `Next` (esquema desde las entidades + deploy/sql) y `CRM` (sql/NNN_*.sql
 * de crmAPI), NextAPI dentro de la prueba y crmAPI como proceso aparte.
 *
 * Nada toca producción: ambos arrancan en un directorio sin `.env`, con
 * secretos de prueba, RabbitMQ apagado, S3 y correo simulados. CRM_API_DIR
 * apunta a un crmAPI ya compilado (dist/src/main.js); por omisión, el hermano
 * ../crmAPI, como en springfieldDev.
 */

const RAIZ_NEXT = resolve(__dirname, '../..');
export const CRM_DIR = resolve(process.env.CRM_API_DIR ?? join(RAIZ_NEXT, '../crmAPI'));

const SECRETO_NEXT_JWT = 'e2e-next-jwt-secreto-de-pruebas-0123456789';
const SECRETO_CRM_JWT = 'e2e-crm-jwt-secreto-de-pruebas-0123456789abcdef';
const SECRETO_HMAC = 'e2e-hmac-crm-next-secreto-0123456789abcdef';

/** Usuarios sembrados en Next (Id fijo). */
export const NEXT = {
  ADMIN: { id: 2, rol: 3, nombre: 'Admin Operación' },
  MONITOREO: { id: 15, rol: 5, nombre: 'Ana Monitorista' },
  JEFE: { id: 16, rol: 4, nombre: 'Jefe Monitoreo' },
  TECNICO: { id: 50, rol: 8, nombre: 'Juan Técnico' },
  TECNICO_2: { id: 51, rol: 8, nombre: 'Luis Técnico' },
  CRM: { id: 60, rol: 3, nombre: 'Integración CRM' },
} as const;

/** S3 simulado: guarda los archivos en memoria. */
export class S3Falso {
  readonly archivos = new Map<string, Buffer>();
  async uploadFile(file: { buffer: Buffer; mimetype: string }, folder: string) {
    const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'png';
    const key = `${folder}/${this.archivos.size + 1}.${ext}`;
    this.archivos.set(key, file.buffer);
    return { url: `https://bucket.s3.local/${key}` };
  }
  async updateFile(_old: string | null, file: { buffer: Buffer; mimetype: string }, folder: string) {
    return this.uploadFile(file, folder);
  }
  async getPresignedUrl(key: string) {
    return `https://firmada.local/${key}`;
  }
}

/** Correo simulado: guarda lo que se hubiera enviado. */
export class CorreoFalso {
  readonly enviados: Array<{ para: string[]; asunto: string; adjuntos?: Array<{ filename: string; content: Buffer }> }> = [];
  async enviar(c: { para: string[]; asunto: string; adjuntos?: Array<{ filename: string; content: Buffer }> }) {
    this.enviados.push(c);
  }
  async sendConfirmationEmail() {}
  async sendResetPasswordEmail() {}
  async sendResetPasswordEmailNext() {}
}

async function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => ok(p));
    });
    s.on('error', mal);
  });
}

/**
 * Proxy entre crmAPI y NextAPI para simular fallas:
 * - `normal`: reenvía.
 * - `caido`: 503 sin tocar Next (Next no responde).
 * - `perdida`: Next aplica la petición, pero el CRM recibe 504 (respuesta perdida).
 * - `rechazo401`: 401 sin tocar Next (p. ej. relojes desfasados).
 * - `lento`: reenvía después de `retrasoMs` (más que el tiempo de espera del CRM).
 */
export class ProxyFallas {
  modo: 'normal' | 'caido' | 'perdida' | 'rechazo401' | 'lento' = 'normal';
  retrasoMs = 2500;
  peticiones = 0;
  private servidor: Server | null = null;
  puerto = 0;

  async iniciar(destino: () => number): Promise<void> {
    this.puerto = await puertoLibre();
    this.servidor = crearServidorHttp((req, res) => {
      this.peticiones++;
      if (this.modo === 'caido' || this.modo === 'rechazo401') {
        const codigo = this.modo === 'caido' ? 503 : 401;
        res.writeHead(codigo, { 'content-type': 'text/plain' }).end(`Simulado: ${codigo}`);
        req.resume();
        return;
      }
      const perder = this.modo === 'perdida';
      const retraso = this.modo === 'lento' ? this.retrasoMs : 0;
      const fwd = peticionHttp(
        { host: '127.0.0.1', port: destino(), path: req.url, method: req.method, headers: req.headers },
        (r) => {
          if (perder) {
            r.resume();
            res.writeHead(504, { 'content-type': 'text/plain' }).end('Simulado: respuesta perdida');
            return;
          }
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        },
      );
      fwd.on('error', () => (res.headersSent ? res.end() : res.writeHead(502).end()));
      setTimeout(() => req.pipe(fwd), retraso);
    });
    await new Promise<void>((ok) => this.servidor!.listen(this.puerto, '127.0.0.1', ok));
  }

  async detener(): Promise<void> {
    await new Promise<void>((ok) => (this.servidor ? this.servidor.close(() => ok()) : ok()));
  }
}

export interface Respuesta<T = any> {
  status: number;
  body: T;
}

export class Entorno {
  readonly mysql = new MysqlDesechable();
  readonly s3 = new S3Falso();
  readonly correo = new CorreoFalso();
  /** El CRM habla con Next a través de este proxy (para simular caídas). */
  readonly proxy = new ProxyFallas();
  private puertoNext = 0;
  nextUrl = '';
  crmUrl = '';
  private next: INestApplication | null = null;
  private crm: ChildProcess | null = null;
  private crmLog = '';
  private readonly sinEnv = mkdtempSync(join(tmpdir(), 'e2e-cwd-'));

  async iniciar(): Promise<void> {
    if (!existsSync(join(CRM_DIR, 'dist/src/main.js'))) {
      throw new Error(`No encuentro crmAPI compilado en ${CRM_DIR} (CRM_API_DIR; falta npm run build)`);
    }
    await this.mysql.iniciar(await puertoLibre());
    this.mysql.sql(null, 'CREATE DATABASE Next CHARACTER SET utf8mb4; CREATE DATABASE CRM CHARACTER SET utf8mb4;');
    this.mysql.carpeta('CRM', join(CRM_DIR, 'sql'));
    await this.iniciarNext();
    await this.proxy.iniciar(() => this.puertoNext);
    await this.iniciarCrm();
  }

  private async iniciarNext(): Promise<void> {
    const puerto = await puertoLibre();
    Object.assign(process.env, {
      TZ: 'America/Mexico_City',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(this.mysql.puerto),
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_DATABASE: 'Next',
      DB_TZ: '-00:00',
      JWT_SECRET: SECRETO_NEXT_JWT,
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_EXPIRES_IN: '1d',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'e2e',
      AWS_SECRET_ACCESS_KEY: 'e2e',
      AWS_S3_BUCKET: 'e2e',
      UPLOAD_MAX_SIZE: '10485760',
      HOST: 'smtp.e2e.local',
      SMTP: '465',
      E_MAIL: 'e2e@e2e.local',
      MAIL_PASSWORD: 'e2e',
      GATEWAY_HMAC_SECRET: 'e2e-gateway-hmac-0123456789',
      CRM_HMAC_SECRET: SECRETO_HMAC,
      CRM_ID_USUARIO: String(NEXT.CRM.id),
      RABBITMQ_ENABLED: 'false',
      WEBHOOK_SUBSCRIBERS: '',
      TRACKCAM_WEBHOOK_URL: '',
      LOG_LEVEL: 'error',
    });
    for (const k of [
      'THROTTLE_LOGIN', 'THROTTLE_PIN', 'THROTTLE_VERIFY', 'THROTTLE_RECUPERACION',
      'THROTTLE_RECUPERACION_CONFIRMACION', 'THROTTLE_REFRESH', 'THROTTLE_LOGOUT',
    ]) {
      process.env[`${k}_LIMIT`] = '1000';
      process.env[`${k}_TTL_MS`] = '60000';
    }

    // Esquema de Next igual al de producción (dump sin datos) + los SQL de
    // despliegue que producción aún no tenga. Después se compara contra las
    // entidades: si el código espera algo que la base real no tiene, la
    // batería falla aquí y no en producción.
    this.mysql.archivo('Next', join(__dirname, 'esquema/next-produccion.sql'));
    for (const f of ['OrdenesServicio.sql', 'OrdenesServicioEtapa2.sql', 'OrdenesServicioEtapa3.sql', 'OrdenesServicioEtapa4.sql', 'MotorActivosFaseA.sql', 'MotorActivosFaseD.sql']) {
      this.mysql.archivo('Next', join(RAIZ_NEXT, 'deploy/sql', f));
    }
    await this.compararEsquema();
    this.sembrarNext();

    // Arranca sin .env a la vista: ConfigModule lee el del directorio actual.
    const cwd = process.cwd();
    process.chdir(this.sinEnv);
    try {
      const { Test } = require('@nestjs/testing');
      const { ValidationPipe } = require('@nestjs/common');
      const { AppModule } = require('src/app.module');
      const { S3Service } = require('src/s3/s3.service');
      const { MailService } = require('src/mail/mail.service');
      const { HttpStringResponseFilter } = require('src/utils/http-string-response.filter');
      const mod = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(S3Service)
        .useValue(this.s3)
        .overrideProvider(MailService)
        .useValue(this.correo)
        .compile();
      this.next = mod.createNestApplication({ rawBody: true, logger: process.env.E2E_LOG ? ['error','warn','log'] : ['error'] });
      this.next.setGlobalPrefix('api');
      this.next.useGlobalFilters(new HttpStringResponseFilter());
      this.next.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      await this.next.listen(puerto, '127.0.0.1');
      this.puertoNext = puerto;
    } finally {
      process.chdir(cwd);
    }
    this.nextUrl = `http://127.0.0.1:${puerto}/api`;
  }

  /**
   * Lo que el código espera de las tablas de órdenes de servicio y la base real
   * (producción + SQL de despliegue) no tiene: columnas, tipo, si acepta nulos
   * e índices declarados en las entidades. Comentarios y llaves foráneas que
   * solo existen en el DDL no cuentan.
   */
  private async compararEsquema(): Promise<void> {
    const { DataSource } = require('typeorm');
    const ds = new DataSource({
      type: 'mysql',
      host: '127.0.0.1',
      port: this.mysql.puerto,
      username: 'root',
      database: 'Next',
      entities: [join(RAIZ_NEXT, 'src/entities/*.ts')],
      synchronize: false,
    });
    await ds.initialize();
    const tablas = /^(OrdenesServicio|OrdenServicio\w+|CatOrdenServicioOpciones|CatMotivosOrdenServicio|CatEstatusRecurso|MovimientosRecurso|CorreccionesInstalacion)$/;
    const difs: string[] = [];
    try {
      for (const meta of ds.entityMetadatas.filter((m: any) => tablas.test(m.tableName))) {
        const cols = this.consulta(
          'Next',
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='Next' AND TABLE_NAME='${meta.tableName}'`,
        );
        if (!cols.length) {
          difs.push(`${meta.tableName}: la tabla no existe`);
          continue;
        }
        for (const c of meta.columns) {
          const db = cols.find((x) => x[0] === c.databaseName);
          const tipo = String(typeof c.type === 'function' ? c.type.name : c.type).toLowerCase();
          if (!db) difs.push(`${meta.tableName}.${c.databaseName}: falta la columna`);
          else {
            if (db[1] !== tipo && !(tipo === 'number' && /int$/.test(db[1])) && !(tipo === 'string' && /char|text/.test(db[1]))) {
              difs.push(`${meta.tableName}.${c.databaseName}: tipo ${db[1]} y el código espera ${tipo}`);
            }
            if ((db[2] === 'YES') !== Boolean(c.isNullable) && !c.isPrimary) {
              difs.push(`${meta.tableName}.${c.databaseName}: ${db[2] === 'YES' ? 'acepta' : 'no acepta'} nulos y el código espera lo contrario`);
            }
          }
        }
        const indices = new Set(
          this.consulta('Next', `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='Next' AND TABLE_NAME='${meta.tableName}'`).map((x) => x[0]),
        );
        for (const ix of meta.indices) {
          if (ix.name && !indices.has(ix.name)) difs.push(`${meta.tableName}: falta el índice ${ix.name}`);
        }
      }
    } finally {
      await ds.destroy();
    }
    this.diferenciasEsquema = difs;
  }

  /** Lo que el código espera y la base real (más los SQL de despliegue) no tiene. */
  diferenciasEsquema: string[] = [];

  /** Datos mínimos de Next: cuenta raíz, roles, usuarios, catálogos e inventario. */
  private sembrarNext(): void {
    const u = (x: { id: number; rol: number; nombre: string }) =>
      `(${x.id}, 'u${x.id}@e2e.local', 'x', 1, '${x.nombre}', ${x.rol}, 1, 1)`;
    this.mysql.sql(
      'Next',
      `
      SET FOREIGN_KEY_CHECKS = 0;
      INSERT IGNORE INTO Roles (Id, Nombre, Estatus) VALUES (1,'SA',1),(2,'DEV',1),(3,'ADMIN',1),(4,'JEFE_MONITOREO',1),(5,'MONITOREO',1),(6,'CLIENTE',1),(7,'OPERADOR',1),(8,'TECNICO',1),(9,'USUARIO',1);
      INSERT INTO Clientes (Id, IdPadre, RFC, TipoPersona, Nombre, Estatus) VALUES (1, NULL, 'SPR000000AAA', 2, 'Spring Telecom', 1);
      INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
        ${[NEXT.ADMIN, NEXT.MONITOREO, NEXT.JEFE, NEXT.TECNICO, NEXT.TECNICO_2, NEXT.CRM].map(u).join(',')};
      SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO');
      INSERT IGNORE INTO CatEstatusInstalacion (Id, Codigo, Nombre) VALUES
        (0,'INACTIVO','Inactiva'),(1,'ACTIVA','Activa'),(2,'ASIGNADO','Asignada'),(3,'BAJA_REMPLAZO','Baja por reemplazo'),
        (4,'BAJA_MANTENIMIENTO','Baja por mantenimiento'),(5,'INSERVIBLE','Inservible');
      INSERT IGNORE INTO CatTipoProducto (Id, Codigo, Nombre) VALUES (1,'VEHICULO','Vehículo'),(2,'ACTIVO','Activo'),(3,'INMUEBLE','Inmueble'),(4,'PERSONA','Persona');
      INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre) VALUES (1,'AVL','AVL');
      INSERT IGNORE INTO Modulos (Id, Nombre) SELECT n, CONCAT('Módulo ', n) FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25) t;
      INSERT IGNORE INTO CatTelefonia (Id, NombreTelefonia) VALUES (1,'Telcel');
      INSERT IGNORE INTO CatPlanesTelefonia (Id, IdTelefonia) VALUES (1,1);
      SET FOREIGN_KEY_CHECKS = 1;
      `,
    );
  }

  /**
   * Inventario del almacén asignado al cliente (equipos y SIM disponibles). En la
   * operación lo da de alta operación en Next antes de salir a campo.
   */
  inventarioNext(idCliente: number, n: number): Array<{ idDispositivo: number; idSim: number; imei: string }> {
    const base = 866000000000000 + Math.floor(Math.random() * 1e8) * 10;
    const salida: Array<{ idDispositivo: number; idSim: number; imei: string }> = [];
    for (let i = 0; i < n; i++) {
      const imei = String(base + i);
      const fila = this.mysql
        .sql(
          'Next',
          `INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (${idCliente}, 1, 'S${imei}', ${imei}, 1);
           SELECT LAST_INSERT_ID();
           INSERT INTO Sims (IdCliente, IdTelefonia, IdPlanTelefonia, IMEI, NumeroTelefono, Estatus) VALUES (${idCliente}, 1, 1, '895203${imei}', '777${imei.slice(-7)}', 1);
           SELECT LAST_INSERT_ID();`,
        )
        .trim()
        .split('\n');
      salida.push({ idDispositivo: Number(fila[0]), idSim: Number(fila[1]), imei });
    }
    return salida;
  }

  /**
   * Una venta ganada en el CRM: cliente, orden de instalación por agendar y su
   * servicio por instalar (en la operación nacen al aceptar la cotización).
   */
  ventaCrm(v: { razonSocial: string; rfc: string; unidades: number; precio?: number }): { idCliente: number; idOrden: number; idServicio: number } {
    const r = this.mysql
      .sql(
        'CRM',
        `INSERT IGNORE INTO Usuarios (Id, Correo, Nombre, IdRol, Estatus) VALUES (1, 'ops@e2e.local', 'Gerente de operaciones', 2, 1);
         INSERT INTO Clientes (TipoPersona, RazonSocial, Rfc, Direccion, CodigoPostal, Contacto, Correo, Telefono)
           VALUES ('PM', '${v.razonSocial}', '${v.rfc}', 'Av. Morelos 100, Cuernavaca', '62000', 'Laura Pérez', 'laura@cliente.mx', '7771234567');
         SET @c = LAST_INSERT_ID();
         INSERT INTO OrdenesInstalacion (IdCliente, Descripcion, Unidades, Estatus) VALUES (@c, '${v.unidades} × GPS con instalación', ${v.unidades}, 'POR_AGENDAR');
         SET @o = LAST_INSERT_ID();
         INSERT INTO ServiciosContratados (IdCliente, Concepto, Unidades, PrecioUnitario, Estatus, IdOrdenInstalacion)
           VALUES (@c, 'Monitoreo y plataforma', ${v.unidades}, ${v.precio ?? 350}, 'POR_INSTALAR', @o);
         SELECT @c, @o, LAST_INSERT_ID();`,
      )
      .trim()
      .split('\t')
      .map(Number);
    return { idCliente: r[0], idOrden: r[1], idServicio: r[2] };
  }

  /** Otra venta ganada para un cliente que ya existe: nueva orden de instalación. */
  nuevaOrdenCrm(idCliente: number, unidades: number): { idOrden: number; idServicio: number } {
    const r = this.mysql
      .sql(
        'CRM',
        `INSERT INTO OrdenesInstalacion (IdCliente, Descripcion, Unidades, Estatus) VALUES (${idCliente}, '${unidades} × GPS con instalación', ${unidades}, 'POR_AGENDAR');
         SET @o = LAST_INSERT_ID();
         INSERT INTO ServiciosContratados (IdCliente, Concepto, Unidades, PrecioUnitario, Estatus, IdOrdenInstalacion)
           VALUES (${idCliente}, 'Monitoreo y plataforma', ${unidades}, 350, 'POR_INSTALAR', @o);
         SELECT @o, LAST_INSERT_ID();`,
      )
      .trim()
      .split('\t')
      .map(Number);
    return { idOrden: r[0], idServicio: r[1] };
  }

  /** Consulta directa para comprobar (solo lectura). */
  consulta(base: 'Next' | 'CRM', sql: string): string[][] {
    const t = this.mysql.sql(base, sql).trim();
    return t ? t.split('\n').map((l) => l.split('\t')) : [];
  }

  private async iniciarCrm(): Promise<void> {
    const puerto = await puertoLibre();
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      TZ: 'America/Mexico_City',
      NODE_ENV: 'test',
      PORT: String(puerto),
      APP_URL: 'http://127.0.0.1',
      CORS_ORIGINS: 'http://127.0.0.1',
      DB_HOST: '127.0.0.1',
      DB_PORT: String(this.mysql.puerto),
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_DATABASE: 'CRM',
      DB_TZ: '-06:00',
      JWT_SECRET: SECRETO_CRM_JWT,
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_EXPIRES_IN: '1d',
      THROTTLE_LOGIN_LIMIT: '1000',
      THROTTLE_LOGIN_TTL_MS: '60000',
      INTEGRACION_HMAC_SECRET: 'e2e-integracion-contact-0123456789abcdef',
      CONTACT_API_URL: 'http://127.0.0.1:9',
      SEGUNDO_FACTOR_CLAVE: Buffer.alloc(32, 7).toString('base64'),
      NEXT_API_URL: `http://127.0.0.1:${this.proxy.puerto}/api`,
      NEXT_API_HMAC_SECRET: SECRETO_HMAC,
      NEXT_DB_USER: '',
      NEXT_DB_PASSWORD: '',
      INSTALACIONES_SYNC_MIN_MS: '0',
      NEXT_OUTBOX_MAX_INTENTOS: '3',
      NEXT_OUTBOX_ESPERA_MS: '0',
      NEXT_API_TIMEOUT_MS: '1000',
    };
    this.crm = spawn(process.execPath, [join(CRM_DIR, 'dist/src/main.js')], { cwd: this.sinEnv, env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.crm.stdout?.on('data', (d) => (this.crmLog = (this.crmLog + d).slice(-20000)));
    this.crm.stderr?.on('data', (d) => (this.crmLog = (this.crmLog + d).slice(-20000)));
    this.crmUrl = `http://127.0.0.1:${puerto}`;
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(`${this.crmUrl}/`, { signal: AbortSignal.timeout(1000) });
        if (r.status) return;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (this.crm.exitCode != null) break;
    }
    throw new Error(`crmAPI no arrancó:\n${this.crmLog.slice(-4000)}`);
  }

  // ------------------------------------------------------------------ sesiones

  tokenNext(u: { id: number; rol: number }, idCliente = 1): string {
    return jwt.sign({ type: 'access', id: u.id, rol: u.rol, idCliente, email: `u${u.id}@e2e.local` }, SECRETO_NEXT_JWT, { expiresIn: '1h' });
  }

  /** Usuario del CRM con permisos dados (rol 4 = Operaciones, sin segundo factor obligatorio). */
  tokenCrm(permisos: string[], id = 1, rol = 4): string {
    return jwt.sign({ type: 'access', id, rol, correo: 'ops@e2e.local', nombre: 'Gerente de operaciones', permisos, mfa: true }, SECRETO_CRM_JWT, {
      expiresIn: '1h',
    });
  }

  // ------------------------------------------------------------------ llamadas

  async llamar<T = any>(base: string, metodo: string, ruta: string, token?: string, cuerpo?: unknown): Promise<Respuesta<T>> {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const texto = await r.text();
    let body: any = texto;
    try {
      body = JSON.parse(texto);
    } catch {
      // texto plano (errores del CRM)
    }
    return { status: r.status, body };
  }

  /**
   * Headers firmados como el CRM (firma v2: método, ruta y cuerpo). `version: 1`
   * reproduce la firma anterior (solo cuerpo), para probar que ya no se acepta.
   */
  firmar(metodo: string, ruta: string, texto: string, version: 1 | 2 = 2): Record<string, string> {
    const ts = String(Date.now());
    const nonce = randomUUID();
    const base = version === 2 ? `${ts}.${nonce}.${metodo} ${ruta}\n${texto}` : `${ts}.${texto || `${metodo} ${ruta}`}`;
    return {
      'x-crm-timestamp': ts,
      ...(version === 2 ? { 'x-crm-nonce': nonce } : {}),
      'x-crm-signature': createHmac('sha256', SECRETO_HMAC).update(base).digest('hex'),
      ...(version === 2 ? { 'x-crm-firma': 'v2' } : {}),
      ...(texto ? { 'content-type': 'application/json' } : {}),
    };
  }

  /** Envía a NextAPI una petición con headers ya firmados (p. ej. para repetirla). */
  async enviarFirmado<T = any>(metodo: string, ruta: string, texto: string, headers: Record<string, string>): Promise<Respuesta<T>> {
    const r = await fetch(this.nextUrl + ruta, { method: metodo, headers, body: texto || undefined });
    const t = await r.text();
    let body: any = t;
    try {
      body = JSON.parse(t);
    } catch {
      // texto
    }
    return { status: r.status, body };
  }

  /** Llamada a /integracion de NextAPI firmada como el CRM. */
  async integracion<T = any>(metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta<T>> {
    const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
    return this.enviarFirmado<T>(metodo, ruta, texto, this.firmar(metodo, `/api${ruta}`, texto));
  }

  logCrm(): string {
    return this.crmLog;
  }

  async detener(): Promise<void> {
    if (this.crm && this.crm.exitCode == null) {
      this.crm.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
    }
    await this.proxy.detener();
    await this.next?.close();
    await this.mysql.detener();
    rmSync(this.sinEnv, { recursive: true, force: true });
  }
}
