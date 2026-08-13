import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SquadLink API')
    .setDescription(
      'Backend API for the SquadLink gaming communication platform',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('friends')
    .addTag('messages')
    .addTag('party')
    .addTag('voice')
    .addTag('communities')
    .addTag('notifications')
    .addTag('search')
    .addTag('settings')
    .addTag('uploads')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Swagger exposes the full route/DTO surface of the API — useful in
  // dev, but an unnecessary reconnaissance aid for an attacker in
  // production. Gate it behind NODE_ENV instead of always mounting it;
  // if a production deployment genuinely needs hosted docs, mount them
  // behind auth/a private network rather than flipping this back to
  // always-on.
  if (!config.isProduction) {
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.port;
  await app.listen(port);

  Logger.log(
    `SquadLink API listening on http://localhost:${port}/${config.apiPrefix}`,
    'Bootstrap',
  );
  if (!config.isProduction) {
    Logger.log(
      `Swagger docs available at http://localhost:${port}/docs`,
      'Bootstrap',
    );
  }
}

void bootstrap();
