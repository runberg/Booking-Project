import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [EmailTemplatesModule, SettingsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
