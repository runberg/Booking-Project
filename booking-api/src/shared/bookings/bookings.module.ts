import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingLog } from './booking-log.entity';
import { BookingCancelToken } from './booking-cancel-token.entity';
import { BookingCheckinToken } from './booking-checkin-token.entity';
import { BookingsService } from './bookings.service';
import { AmenitiesModule } from '../amenities/amenities.module';
import { RestrictionsModule } from '../restrictions/restrictions.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingLog,
      BookingCancelToken,
      BookingCheckinToken,
    ]),
    EmailModule,
    AmenitiesModule,
    RestrictionsModule,
    UsersModule,
  ],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
