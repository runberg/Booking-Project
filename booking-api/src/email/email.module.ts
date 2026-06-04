import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [EmailTemplatesModule, forwardRef(() => SettingsModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
