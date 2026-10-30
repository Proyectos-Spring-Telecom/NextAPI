import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * MySQL 8 desechable para la batería de punta a punta: datadir en un directorio
 * temporal, solo en 127.0.0.1 con un puerto libre, y sin contraseña. Nunca toca una base real.
 * Requiere los binarios `mysqld` y `mysql` del sistema.
 */
export class MysqlDesechable {
  readonly dir = mkdtempSync(join(tmpdir(), 'e2e-mysql-'));
  /** Los sockets Unix no aceptan rutas largas: va directo en el tmp del sistema. */
  readonly socket = join(tmpdir(), `e2e-${process.pid}-${Date.now() % 100000}.sock`);
  private proceso: ChildProcess | null = null;
  /** Puerto TCP solo en 127.0.0.1: NextAPI y crmAPI se conectan por TCP. */
  puerto = 0;

  async iniciar(puerto: number): Promise<void> {
    this.puerto = puerto;
    const datos = join(this.dir, 'data');
    execFileSync('mysqld', ['--no-defaults', '--initialize-insecure', `--datadir=${datos}`], { stdio: 'ignore' });
    this.proceso = spawn(
      'mysqld',
      [
        '--no-defaults',
        `--datadir=${datos}`,
        `--socket=${this.socket}`,
        `--port=${puerto}`,
        '--bind-address=127.0.0.1',
        `--pid-file=${join(this.dir, 'mysqld.pid')}`,
        `--log-error=${join(this.dir, 'error.log')}`,
        '--mysqlx=OFF',
        "--sql-mode=ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION",
        // Igual que producción: MySQL en la hora del servidor (Etc/GMT+6) y NextAPI con DB_TZ=-00:00.
        '--default-time-zone=-06:00',
      ],
      { stdio: 'ignore' },
    );
    for (let i = 0; i < 120 && !existsSync(this.socket); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!existsSync(this.socket)) {
      throw new Error(`mysqld no arrancó: ${readFileSync(join(this.dir, 'error.log'), 'utf8').slice(-2000)}`);
    }
  }

  /** Ejecuta SQL (texto o archivo) con el cliente `mysql`. */
  sql(base: string | null, sql: string): string {
    return execFileSync('mysql', ['--no-defaults', '-uroot', `-S${this.socket}`, '-N', ...(base ? [base] : [])], {
      input: sql,
      encoding: 'utf8',
    });
  }

  archivo(base: string, ruta: string): void {
    this.sql(base, readFileSync(ruta, 'utf8'));
  }

  /** Aplica en orden los `NNN_*.sql` de un directorio. */
  carpeta(base: string, dir: string): void {
    for (const f of readdirSync(dir).filter((x) => /^\d{3}_.*\.sql$/.test(x)).sort()) {
      try {
        this.archivo(base, join(dir, f));
      } catch (e) {
        throw new Error(`Falló ${f}: ${(e as Error).message.slice(0, 500)}`);
      }
    }
  }

  async detener(): Promise<void> {
    if (this.proceso) {
      try {
        execFileSync('mysqladmin', ['--no-defaults', '-uroot', `-S${this.socket}`, 'shutdown'], { stdio: 'ignore' });
      } catch {
        this.proceso.kill('SIGTERM');
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    rmSync(this.dir, { recursive: true, force: true });
    rmSync(this.socket, { force: true });
  }
}
