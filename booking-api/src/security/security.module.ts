import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  controllers: [SecurityController],
})
export class SecurityModule {}
