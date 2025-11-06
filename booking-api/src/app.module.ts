import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { User } from './users/user.entity';
import { Building } from './buildings/building.entity';
import { BuildingsModule } from './buildings/buildings.module';
import { Amenity } from './amenities/amenity.entity';
import { AmenitiesModule } from './amenities/amenities.module';
import { BookingRestriction } from './restrictions/booking-restriction.entity';
import { RestrictionsModule } from './restrictions/restrictions.module';
import { Booking } from './bookings/booking.entity';
import { BookingLog } from './bookings/booking-log.entity';
import { BookingsModule } from './bookings/bookings.module';
import { EmailTemplate } from './email-templates/email-template.entity';
import { EmailTemplatesModule } from './email-templates/email-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const dbPath = configService.get('DB_PATH', 'booking.db');
        
        // For fresh production deployments, enable synchronize if database doesn't exist or is empty
        // This allows initial setup without migrations
        let shouldSynchronize = !isProduction;
        if (isProduction) {
          const fs = require('fs');
          try {
            // Check if database file exists and has content
            const dbExists = fs.existsSync(dbPath);
            console.log(`📊 Database check: path=${dbPath}, exists=${dbExists}`);
            if (!dbExists) {
              shouldSynchronize = true;
              console.log('⚠️  Fresh database detected - enabling synchronize for initial setup');
            } else {
              // Check database file size - if it's very small, it's likely empty
              const stats = fs.statSync(dbPath);
              console.log(`📊 Database size: ${stats.size} bytes`);
              // SQLite database files with tables are typically > 2KB even when empty
              // If smaller than 2KB, assume it needs tables created
              if (stats.size < 2048) {
                shouldSynchronize = true;
                console.log('⚠️  Database appears empty or corrupted - enabling synchronize for initial setup');
              } else {
                console.log('✅ Database exists and appears to have content - synchronize disabled');
              }
            }
          } catch (error: any) {
            // If we can't check, assume it's fresh and enable synchronize
            shouldSynchronize = true;
            console.log('⚠️  Could not verify database state - enabling synchronize for initial setup');
            console.log(`   Error: ${error.message || error}`);
          }
        }
        
        console.log(`📊 Database configuration: synchronize=${shouldSynchronize}, path=${dbPath}`);
        
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [User, Building, Amenity, BookingRestriction, Booking, BookingLog, EmailTemplate],
          synchronize: shouldSynchronize,
          logging: configService.get('NODE_ENV') === 'development',
          // Enable WAL mode for better concurrency and performance
          extra: {
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            busyTimeout: 5000,
          },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 }, // 60 req/min/IP (increased from 30 to handle normal browsing)
    ]),
    AuthModule,
    UsersModule,
    EmailModule,
    AdminModule,
    BuildingsModule,
    AmenitiesModule,
    RestrictionsModule,
    BookingsModule,
    EmailTemplatesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
