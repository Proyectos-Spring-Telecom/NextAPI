import type { JwtModuleOptions } from '@nestjs/jwt';

type JwtExpiresIn = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

export function toJwtExpiresIn(
  value: string | undefined,
  fallback: string,
): JwtExpiresIn {
  return (value ?? fallback) as JwtExpiresIn;
}
