import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingRestriction } from './booking-restriction.entity';
import { RestrictionsService } from './restrictions.service';
import { AdminRestrictionsController } from './controllers/admin-restrictions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BookingRestriction])],
  providers: [RestrictionsService],
  controllers: [AdminRestrictionsController],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}


