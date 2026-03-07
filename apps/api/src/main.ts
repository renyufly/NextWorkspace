import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { isAbsolute, resolve } from 'node:path';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const corsOrigin = app.get(ConfigService).get<string>('CORS_ORIGIN', 'http://localhost:3000');

  app.enableCors({
    origin: corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    credentials: true,
  });

  const uploadDir = app.get(ConfigService).get<string>('LOCAL_UPLOAD_DIR', '.uploads');
  const uploadPath = isAbsolute(uploadDir) ? uploadDir : resolve(process.cwd(), uploadDir);
  app.use('/uploads', express.static(uploadPath));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WorkNext API')
    .setDescription('Slack-inspired collaboration platform API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = app.get(ConfigService).get<number>('API_PORT', 3001);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();

