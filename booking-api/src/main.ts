import { types as pgTypes } from 'pg';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

interface PgTypeRegistry {
  setTypeParser(oid: number, parseFn: (value: string) => unknown): void;
}

// pg parses TIMESTAMP WITHOUT TIME ZONE as local time when Node.js has TZ set.
// Appending 'Z' forces the parser to always treat the stored value as UTC.
(pgTypes as unknown as PgTypeRegistry).setTypeParser(
  1114,
  (val: string) => new Date(val + 'Z'),
);
(pgTypes as unknown as PgTypeRegistry).setTypeParser(
  1184,
  (val: string) => new Date(val),
);

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 2 * 1024 * 1024 }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((s) => s.trim())
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000, '0.0.0.0');
  Logger.log('Server started on http://0.0.0.0:3000', 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Bootstrap failed',
    error instanceof Error ? error.stack : String(error),
    'Bootstrap',
  );
  process.exit(1);
});
