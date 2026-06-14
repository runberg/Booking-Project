import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RemindersService } from './reminders.service';
import { BookingsModule } from '../bookings/bookings.module';
import { AmenitiesModule } from '../amenities/amenities.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    ConfigModule,
    BookingsModule,
    AmenitiesModule,
    UsersModule,
    EmailModule,
    SettingsModule,
  ],
  providers: [RemindersService],
})
export class RemindersModule {}
