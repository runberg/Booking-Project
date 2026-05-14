import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Amenity } from './amenity.entity';
import { AmenitiesService } from './amenities.service';
import { AmenitiesController } from './controllers/amenities.controller';
import { BookingRestriction } from '../restrictions/booking-restriction.entity';
import { AdminAmenitiesController } from './controllers/admin-amenities.controller';
import { Booking } from '../bookings/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Amenity, BookingRestriction, Booking])],
  providers: [AmenitiesService],
  controllers: [AmenitiesController, AdminAmenitiesController],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
