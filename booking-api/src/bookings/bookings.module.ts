import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingLog } from './booking-log.entity';
import { BookingCancelToken } from './booking-cancel-token.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsPublicController } from './bookings-public.controller';
import { UserThrottlerGuard } from './user-throttler.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmailModule } from '../email/email.module';
import { AmenitiesModule } from '../amenities/amenities.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingLog, BookingCancelToken]),
    EmailModule,
    AmenitiesModule,
    RestrictionsModule,
    UsersModule,
  ],
  providers: [BookingsService, UserThrottlerGuard, RolesGuard],
  controllers: [BookingsController, BookingsPublicController],
  exports: [BookingsService],
})
export class BookingsModule {}
