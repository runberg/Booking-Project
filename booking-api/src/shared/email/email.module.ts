import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingLog } from '../bookings/booking-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingLog]),
    EmailTemplatesModule,
    forwardRef(() => SettingsModule),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
