import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingRestriction } from './booking-restriction.entity';
import { RestrictionsService } from './restrictions.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingRestriction])],
  providers: [RestrictionsService],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}
