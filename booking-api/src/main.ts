import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  // Run migrations automatically on startup (production only)
  if (process.env.NODE_ENV === 'production') {
    try {
      const { runMigrations } = await import('./migrations/run-migrations');
      await runMigrations();
    } catch (error: any) {
      // If migrations fail, synchronize will handle fresh databases
      console.warn('⚠️  Could not run migrations automatically:', error.message || error);
      console.warn('   Fresh databases will be initialized with synchronize');
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 2 * 1024 * 1024 }), // 2 MB
  );
  
  // Enable CORS for frontend
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()) : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
