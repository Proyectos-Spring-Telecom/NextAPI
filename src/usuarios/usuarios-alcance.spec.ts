import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  assertEdicionPropia,
  assertJerarquiaUsuarioDestino,
  assertPuedeAdministrarUsuarios,
  difiereConjunto,
  resolveIdRolAsignable,
} from './usuarios-alcance';

describe('usuarios-alcance (C1, escalada de rol)', () => {
  describe('assertPuedeAdministrarUsuarios', () => {
    it.each([1, 2, 3, 6])('rol %i administra usuarios', (rol) => {
      expect(() => assertPuedeAdministrarUsuarios(rol)).not.toThrow();
    });
    it.each([4, 5, 7, 8, 9])('rol %i recibe 403', (rol) => {
      expect(() => assertPuedeAdministrarUsuarios(rol)).toThrow(ForbiddenException);
    });
  });

  describe('resolveIdRolAsignable', () => {
    it('SA asigna cualquier rol', () => {
      expect(resolveIdRolAsignable(1, 1, true)).toBe(1);
      expect(resolveIdRolAsignable(1, 9, true)).toBe(9);
    });
    it('Dev asigna 2..9, no 1', () => {
      expect(resolveIdRolAsignable(2, 2, true)).toBe(2);
      expect(() => resolveIdRolAsignable(2, 1, true)).toThrow(ForbiddenException);
    });
    it('Admin asigna 3..9, no 1 ni 2', () => {
      expect(resolveIdRolAsignable(3, 3, false)).toBe(3);
      expect(resolveIdRolAsignable(3, 8, false)).toBe(8);
      expect(() => resolveIdRolAsignable(3, 2, false)).toThrow(ForbiddenException);
      expect(() => resolveIdRolAsignable(3, 1, false)).toThrow(ForbiddenException);
    });
    it('Cliente (6) siempre deja rol 9, aunque pida 1', () => {
      expect(resolveIdRolAsignable(6, 1, true)).toBe(9);
      expect(resolveIdRolAsignable(6, undefined, true)).toBe(9);
      expect(resolveIdRolAsignable(6, 3, false)).toBe(9);
      expect(resolveIdRolAsignable(6, undefined, false)).toBeUndefined();
    });
    it('alta sin idRol → 400; edición sin idRol → no cambia', () => {
      expect(() => resolveIdRolAsignable(1, undefined, true)).toThrow(BadRequestException);
      expect(resolveIdRolAsignable(3, undefined, false)).toBeUndefined();
    });
    it('idRol inválido → 400', () => {
      expect(() => resolveIdRolAsignable(1, 0, true)).toThrow(BadRequestException);
    });
  });

  describe('assertJerarquiaUsuarioDestino', () => {
    it('Admin no administra a SA ni Dev', () => {
      expect(() => assertJerarquiaUsuarioDestino(3, 1)).toThrow(ForbiddenException);
      expect(() => assertJerarquiaUsuarioDestino(3, 2)).toThrow(ForbiddenException);
      expect(() => assertJerarquiaUsuarioDestino(3, 3)).not.toThrow();
      expect(() => assertJerarquiaUsuarioDestino(3, 9)).not.toThrow();
    });
    it('SA administra a todos', () => {
      expect(() => assertJerarquiaUsuarioDestino(1, 1)).not.toThrow();
    });
    it('Cliente (6) no administra roles 1–5', () => {
      expect(() => assertJerarquiaUsuarioDestino(6, 5)).toThrow(ForbiddenException);
      expect(() => assertJerarquiaUsuarioDestino(6, 9)).not.toThrow();
    });
  });

  describe('assertEdicionPropia', () => {
    const base = { rolActor: 9, idRolActual: 9, idClienteActual: 10, cambiaPermisosOSoluciones: false };
    it('puede editar sus datos sin tocar rol ni cliente', () => {
      expect(() => assertEdicionPropia(base)).not.toThrow();
      expect(() => assertEdicionPropia({ ...base, idRolBody: 9, idClienteBody: 10 })).not.toThrow();
    });
    it('no puede cambiar su rol', () => {
      expect(() => assertEdicionPropia({ ...base, idRolBody: 1 })).toThrow(ForbiddenException);
    });
    it('no puede cambiar su cliente', () => {
      expect(() => assertEdicionPropia({ ...base, idClienteBody: 1 })).toThrow(ForbiddenException);
    });
    it('permisos propios: solo 1–3', () => {
      expect(() => assertEdicionPropia({ ...base, cambiaPermisosOSoluciones: true })).toThrow(ForbiddenException);
      expect(() =>
        assertEdicionPropia({ ...base, rolActor: 3, idRolActual: 3, cambiaPermisosOSoluciones: true }),
      ).not.toThrow();
    });
  });

  it('difiereConjunto ignora orden y duplicados', () => {
    expect(difiereConjunto([2, 1, 1], [1, 2])).toBe(false);
    expect(difiereConjunto([1], [1, 2])).toBe(true);
    expect(difiereConjunto([], [])).toBe(false);
  });
});
