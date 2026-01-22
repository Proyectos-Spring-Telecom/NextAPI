import { SetMetadata } from '@nestjs/common';

/**
 * Clave utilizada para almacenar los roles permitidos en los metadatos
 * del endpoint. Esta clave es utilizada por el RolesGuard para verificar
 * si el usuario tiene los permisos necesarios.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador que permite especificar qué roles pueden acceder a un endpoint.
 * 
 * Este decorador almacena los roles permitidos en los metadatos del endpoint,
 * que luego son leídos por el RolesGuard para realizar la validación.
 * 
 * @param roles - Array de números que representan los IDs de los roles permitidos
 * 
 * @example
 * ```typescript
 * @Roles(1, 2, 3) // Solo roles 1, 2 o 3 pueden acceder
 * @Get()
 * findAll() {
 *   return this.service.findAll();
 * }
 * ```
 * 
 * @example
 * ```typescript
 * @Roles(1) // Solo el rol 1 (SuperAdministrador) puede acceder
 * @Post()
 * create() {
 *   return this.service.create();
 * }
 * ```
 */
export const Roles = (...roles: number[]) => SetMetadata(ROLES_KEY, roles);
