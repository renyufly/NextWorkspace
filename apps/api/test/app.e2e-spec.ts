import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';

describe('Health endpoint', () => {
  const originalEnv = { ...process.env };
  let sandboxDir: string;
  let app: INestApplication;

  beforeAll(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), 'worknext-health-e2e-'));

    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_DATA_FILE = resolve(sandboxDir, 'state.json');
    process.env.LOCAL_UPLOAD_DIR = resolve(sandboxDir, 'uploads');
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.API_PORT = '3101';
    delete process.env.REDIS_URL;
    delete process.env.ENABLE_REDIS_ADAPTER;
    delete process.env.ENABLE_BULLMQ;

    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await rm(sandboxDir, { recursive: true, force: true });

    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    Object.assign(process.env, originalEnv);
  });

  it('returns detailed health, liveness, and readiness probes', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.requiredChecks).toEqual(['storage']);
        expect(body.checks.storage).toBe('up');
        expect(body.checks.database).toBe('disabled');
      });

    await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.service).toBe('worknext-api');
      });

    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.ready).toBe(true);
        expect(body.requiredChecks).toEqual(['storage']);
      });
  });
});

async function createApp() {
  const { AppModule } = await import('../src/app.module.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const nestApp = moduleRef.createNestApplication();
  const configService = nestApp.get(ConfigService);
  nestApp.setGlobalPrefix('api');
  nestApp.use(helmet());
  nestApp.use(cookieParser());
  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  nestApp.useGlobalFilters(new AllExceptionsFilter());
  nestApp.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  await nestApp.init();

  return nestApp;
}
