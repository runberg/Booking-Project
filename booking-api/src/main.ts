import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const DEFAULT_TRAEFIK_PING_URL = 'http://proxy:8080/ping';

async function ensureTraefikAvailability() {
  const useInternalProxy = process.env.USE_INTERNAL_TRAEFIK !== 'false';
  if (useInternalProxy) {
    return;
  }

  const pingUrl = process.env.TRAEFIK_PING_URL || DEFAULT_TRAEFIK_PING_URL;
  const retries = Number.parseInt(process.env.TRAEFIK_PING_RETRIES || '5', 10);
  const backoffSeconds = Number.parseInt(process.env.TRAEFIK_PING_DELAY_SECONDS || '2', 10);
  const timeoutMs = Number.parseInt(process.env.TRAEFIK_PING_TIMEOUT_MS || '3000', 10);

  console.log(`🔍 USE_INTERNAL_TRAEFIK=false - verifying external Traefik at ${pingUrl} ...`);

  for (let attempt = 1; attempt <= Math.max(retries, 1); attempt += 1) {
    try {
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Received status ${response.status}`);
      }

      console.log('✅ External Traefik is reachable. Continuing startup.');
      return;
    } catch (error: any) {
      const hint =
        'Make sure this service is attached to the same Docker network as Traefik and that the /ping endpoint is enabled.';
      console.warn(
        `⚠️  Traefik check failed (attempt ${attempt}/${retries}): ${error?.message ?? error}. ${attempt < retries ? 'Retrying...' : ''}`,
      );

      if (attempt >= retries) {
        console.error('❌ Could not verify external Traefik availability.');
        console.error('   • Hint:', hint);
        console.error('   • Current ping URL:', pingUrl);
        console.error('   • To fall back to the built-in proxy, set USE_INTERNAL_TRAEFIK=true');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
    }
  }
}

async function bootstrap() {
  console.log('🚀 Starting NestJS application...');
  
  // Run migrations automatically on startup (production only)
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('📦 Attempting to run migrations...');
      const { runMigrations } = await import('./migrations/run-migrations.js');
      await runMigrations();
    } catch (error: any) {
      // If migrations fail, synchronize will handle fresh databases
      console.warn('⚠️  Could not run migrations automatically:', error.message || error);
      console.warn('   Fresh databases will be initialized with synchronize');
    }
  }

  console.log('📦 Creating NestJS application...');
  try {
    await ensureTraefikAvailability();

    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ logger: true, bodyLimit: 2 * 1024 * 1024 }), // 2 MB
    );
    
    console.log('🔧 Configuring CORS...');
    // Enable CORS for frontend
    const corsOrigin = process.env.CORS_ORIGIN;
    app.enableCors({
      origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()) : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    
    console.log('🌐 Starting server on port 3000...');
    await app.listen(3000, '0.0.0.0');
    console.log('✅ Server started successfully on http://0.0.0.0:3000');
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error.message || error);
    process.exit(1);
  }
}
bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
