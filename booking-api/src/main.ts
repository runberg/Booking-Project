import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

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
