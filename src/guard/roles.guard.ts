import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';

/**
 * RolesGuard - Guard genérico y reutilizable para controlar el acceso
 * a endpoints basado en los roles del usuario.
 * 
 * Este guard verifica que el usuario autenticado tenga uno de los roles
 * permitidos para acceder al endpoint. Los roles permitidos se especifican
 * usando el decorador @Roles() en el método del controller.
 * 
 * Funcionamiento:
 * 1. Obtiene los roles permitidos del decorador @Roles() mediante Reflector
 * 2. Si no hay roles especificados, permite el acceso (útil para endpoints públicos)
 * 3. Obtiene el rol del usuario desde req.user.rol
 * 4. Verifica que el rol del usuario esté en la lista de roles permitidos
 * 5. Si no tiene el rol necesario, lanza una excepción ForbiddenException
 * 
 * Requisitos:
 * - El usuario debe estar autenticado (JwtAuthGuard debe ejecutarse antes)
 * - req.user.rol debe existir y contener el ID del rol del usuario
 * 
 * @example
 * ```typescript
 * // En el controller
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(1, 2, 3) // Solo roles 1, 2 o 3 pueden acceder
 * @Get()
 * findAll() {
 *   return this.service.findAll();
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Constructor que inyecta el Reflector de NestJS.
   * El Reflector se utiliza para leer los metadatos almacenados
   * por el decorador @Roles().
   */
  constructor(private reflector: Reflector) {}

  /**
   * Método principal del guard que se ejecuta antes de cada request.
   * 
   * @param context - Contexto de ejecución que contiene la request y response
   * @returns true si el usuario tiene permisos, false o lanza excepción si no
   * 
   * @throws {UnauthorizedException} Si el usuario no está autenticado
   * @throws {ForbiddenException} Si el usuario no tiene el rol necesario
   */
  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles permitidos del decorador @Roles() usando Reflector
    // getAllAndOverride busca primero en el handler (método) y luego en la clase (controller)
    // Si encuentra en el handler, usa ese; si no, usa el de la clase
    const requiredRoles = this.reflector.getAllAndOverride<number[]>(ROLES_KEY, [
      context.getHandler(), // Primero busca en el método (handler)
      context.getClass(),  // Si no encuentra, busca en la clase (controller)
    ]);

    // Si no se especificaron roles requeridos o el array está vacío, permitir el acceso
    // Esto permite que algunos endpoints sean accesibles para todos los usuarios autenticados
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener el objeto request del contexto
    const request = context.switchToHttp().getRequest();
    
    // Obtener el usuario desde la request (debe estar autenticado por JwtAuthGuard)
    const user = request.user;

    // Verificar que el usuario esté autenticado
    if (!user) {
      throw new UnauthorizedException(
        'Usuario no autenticado. Debe iniciar sesión para acceder a este recurso.',
      );
    }

    // Obtener el rol del usuario desde req.user.rol
    // El rol debe ser un número que representa el ID del rol
    const userRole = user.rol;

    // Verificar que el usuario tenga un rol asignado
    if (userRole === undefined || userRole === null) {
      throw new ForbiddenException(
        'El usuario no tiene un rol asignado. Contacte al administrador del sistema.',
      );
    }

    // Convertir el rol a número si viene como string (por seguridad)
    // Manejar casos donde el valor puede ser string, number, o bigint
    let userRoleNumber: number;
    if (typeof userRole === 'string') {
      userRoleNumber = parseInt(userRole, 10);
      // Validar que la conversión fue exitosa
      if (isNaN(userRoleNumber)) {
        throw new ForbiddenException(
          `El rol del usuario tiene un formato inválido: "${userRole}". Contacte al administrador del sistema.`,
        );
      }
    } else if (typeof userRole === 'number') {
      userRoleNumber = userRole;
    } else {
      // Intentar convertir otros tipos (bigint, etc.)
      userRoleNumber = Number(userRole);
      if (isNaN(userRoleNumber)) {
        throw new ForbiddenException(
          'El rol del usuario tiene un formato inválido. Contacte al administrador del sistema.',
        );
      }
    }

    // Asegurar que requiredRoles contiene solo números válidos
    const validRequiredRoles = requiredRoles.filter(role => typeof role === 'number' && !isNaN(role));
    
    if (validRequiredRoles.length === 0) {
      // Si no hay roles válidos en el array, permitir acceso (fallback de seguridad)
      return true;
    }

    // Verificar si el rol del usuario está en la lista de roles permitidos
    const hasRole = validRequiredRoles.includes(userRoleNumber);

    // Si el usuario no tiene uno de los roles permitidos, denegar el acceso
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Este recurso requiere uno de los siguientes roles: ${validRequiredRoles.join(', ')}. Su rol actual es: ${userRoleNumber}.`,
      );
    }

    // Si el usuario tiene uno de los roles permitidos, permitir el acceso
    return true;
  }
}
