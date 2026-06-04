import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RemindersService } from './reminders.service';
import { BookingsModule } from '../bookings/bookings.module';
import { AmenitiesModule } from '../amenities/amenities.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ConfigModule, BookingsModule, AmenitiesModule, UsersModule, EmailModule],
  providers: [RemindersService],
})
export class RemindersModule {}
