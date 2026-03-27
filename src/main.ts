import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpStringResponseFilter } from './utils/http-string-response.filter';

async function bootstrap() {
  process.env.TZ = process.env.TZ || 'America/Mexico_City';
  console.log('TZ', process.env.TZ);
  const app = await NestFactory.create(AppModule);

  // Prefijo global: todas las rutas bajo /api (auth, mesas, clientes, etc.)
  app.setGlobalPrefix('api');

  app.useGlobalFilters(new HttpStringResponseFilter());

  app.enableCors({
    origin: '*', // Permitir todas las URLs; puedes poner un array de URLs específicas
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Next API')
    .setDescription('Documentación de la API de NEXT')
    .setVersion('1.0')
    .addServer('http://localhost:3004', 'Servidor Local')
    .addServer('https://springtelecom.mx/nextAPI', 'Servidor Spring')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'bearer-token',
        description: 'Ingresa el token Bearer',
        in: 'header',
      },
      'bearer-token',
    )
    .addTag('Autenticación', 'Endpoints de autenticación y registro')
    .addTag('Bitácora', 'Registro de actividades del sistema')
    .addTag('Clientes', 'Gestión de clientes')
    .addTag('Mail', 'Servicio de correo electrónico')
    .addTag('Modulos', 'Gestión de módulos del sistema')
    .addTag('Permisos', 'Gestión de permisos')
    .addTag(
      'S3 - archivos',
      'Almacenamiento en AWS S3: subir (POST /upload), reemplazar (PATCH /update) y eliminar (DELETE /delete). Requiere JWT; el usuario en bitácora sale del token. Tipos: PNG, JPEG, PDF. Ver carpeta permitida (folder) en cada endpoint.',
    )
    .addTag('Usuarios', 'Gestión de usuarios')
    .addTag('Catálogo Marca Vehículo', 'Marcas de vehículos (Ford, Chevrolet, etc.)')
    .addTag('Catálogo Modelo Vehículo', 'Modelos de vehículos por marca')
    .addTag('Catálogo Modelo Dispositivo', 'Modelos de dispositivos GPS por marca')
    .addTag('Catálogo Telefonía', 'Operadores de telefonía (Telcel, AT&T, etc.)')
    .addTag('Catálogo Planes Telefonía', 'Planes de datos/telefonía por operador')
    .addTag('Catálogos', 'Endpoint dinámico GET /catalogos/:nombre para consultar cualquier catálogo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3004);
}
bootstrap();
