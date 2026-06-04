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
import { BuildingUnit } from './buildings/building-unit.entity';
import { BuildingsModule } from './buildings/buildings.module';
import { Amenity } from './amenities/amenity.entity';
import { AmenitiesModule } from './amenities/amenities.module';
import { BookingRestriction } from './restrictions/booking-restriction.entity';
import { RestrictionsModule } from './restrictions/restrictions.module';
import { Booking } from './bookings/booking.entity';
import { BookingLog } from './bookings/booking-log.entity';
import { BookingCancelToken } from './bookings/booking-cancel-token.entity';
import { BookingsModule } from './bookings/bookings.module';
import { RemindersModule } from './reminders/reminders.module';
import { EmailTemplate } from './email-templates/email-template.entity';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { Setting } from './settings/setting.entity';
import { SettingsModule } from './settings/settings.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [
          User,
          Building,
          BuildingUnit,
          Amenity,
          BookingRestriction,
          Booking,
          BookingLog,
          BookingCancelToken,
          EmailTemplate,
          Setting,
        ],
        // synchronize creates/alters tables automatically on every startup.
        synchronize: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 },
    ]),
    AuthModule,
    UsersModule,
    EmailModule,
    AdminModule,
    BuildingsModule,
    AmenitiesModule,
    RestrictionsModule,
    BookingsModule,
    RemindersModule,
    EmailTemplatesModule,
    SettingsModule,
    SecurityModule,
  ],
  controllers: [AppController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
