import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Usuarios } from './Usuarios';

@applySchema
@Index('UQ_RefreshSessions_Jti', ['jti'], { unique: true })
@Index('IX_RefreshSessions_IdUsuario', ['idUsuario'])
@Index('IX_RefreshSessions_IdUsuario_activa', [
  'idUsuario',
  'revokedAt',
  'expiresAt',
])
@Entity({ name: 'RefreshSessions' })
export class RefreshSessions {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdUsuario' })
  idUsuario: number;

  @Column({
    type: 'char',
    name: 'Jti',
    length: 36,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  jti: string;

  @Column({
    type: 'char',
    name: 'TokenHash',
    length: 64,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    comment: 'SHA-256 del refresh JWT en hexadecimal',
  })
  tokenHash: string;

  @Column('datetime', { name: 'ExpiresAt', precision: 3 })
  expiresAt: Date;

  @Column('datetime', { name: 'RevokedAt', precision: 3, nullable: true })
  revokedAt: Date | null;

  @Column('bigint', {
    name: 'ReplacedById',
    nullable: true,
    comment: 'PK de la sesión nueva tras rotación',
  })
  replacedById: number | null;

  @Column('datetime', {
    name: 'FechaCreacion',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  fechaCreacion: Date;

  @ManyToOne(() => Usuarios, {
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;
}
