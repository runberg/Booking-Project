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
        
        // For fresh production deployments, enable synchronize if database doesn't exist
        // This allows initial setup without migrations
        let shouldSynchronize = !isProduction;
        if (isProduction) {
          const fs = require('fs');
          const path = require('path');
          const dbExists = fs.existsSync(dbPath);
          if (!dbExists) {
            shouldSynchronize = true;
            console.log('⚠️  Fresh database detected - enabling synchronize for initial setup');
          }
        }
        
        return {
          type: 'sqlite',
          database: dbPath,
          entities: [User, Building, Amenity, BookingRestriction, Booking, BookingLog, EmailTemplate],
          synchronize: shouldSynchronize,
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 30 }, // 30 req/min/IP
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
