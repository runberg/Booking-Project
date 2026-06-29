import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../shared/auth/auth.module';
import { UsersModule } from '../shared/users/users.module';
import { AmenitiesModule } from '../shared/amenities/amenities.module';
import { BuildingsModule } from '../shared/buildings/buildings.module';
import { BookingsModule } from '../shared/bookings/bookings.module';
import { EmailModule } from '../shared/email/email.module';
import { RestrictionsModule } from '../shared/restrictions/restrictions.module';
import { EmailTemplatesModule } from '../shared/email-templates/email-templates.module';
import { SettingsModule } from '../shared/settings/settings.module';
import { BookingRestriction } from '../shared/restrictions/booking-restriction.entity';
import { Booking } from '../shared/bookings/booking.entity';
import { RolesGuard } from '../shared/guards/roles.guard';
import { UserThrottlerGuard } from '../shared/bookings/user-throttler.guard';
import { AmenitiesController } from './controllers/amenities.controller';
import { BuildingsController } from './controllers/buildings.controller';
import { BookingsController } from './controllers/bookings.controller';
import { BookingsPublicController } from './controllers/bookings-public.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';
import { ProfileController } from './controllers/profile.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingRestriction, Booking]),
    AuthModule,
    UsersModule,
    AmenitiesModule,
    BuildingsModule,
    BookingsModule,
    EmailModule,
    RestrictionsModule,
    EmailTemplatesModule,
    SettingsModule,
  ],
  providers: [RolesGuard, UserThrottlerGuard],
  controllers: [
    AmenitiesController,
    BuildingsController,
    BookingsController,
    BookingsPublicController,
    EmailTemplatesController,
    ProfileController,
  ],
})
export class PortalModule {}
