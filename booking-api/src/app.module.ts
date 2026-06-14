import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { AdminModule } from './admin/admin.module';
import { PortalModule } from './portal/portal.module';
import { RemindersModule } from './shared/reminders/reminders.module';
import { User } from './shared/users/user.entity';
import { Building } from './shared/buildings/building.entity';
import { BuildingUnit } from './shared/buildings/building-unit.entity';
import { Amenity } from './shared/amenities/amenity.entity';
import { BookingRestriction } from './shared/restrictions/booking-restriction.entity';
import { Booking } from './shared/bookings/booking.entity';
import { BookingLog } from './shared/bookings/booking-log.entity';
import { BookingCancelToken } from './shared/bookings/booking-cancel-token.entity';
import { BookingCheckinToken } from './shared/bookings/booking-checkin-token.entity';
import { EmailTemplate } from './shared/email-templates/email-template.entity';
import { Setting } from './shared/settings/setting.entity';

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
          BookingCheckinToken,
          EmailTemplate,
          Setting,
        ],
        synchronize: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AdminModule,
    PortalModule,
    RemindersModule,
  ],
  controllers: [AppController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
