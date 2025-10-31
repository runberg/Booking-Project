import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [EmailTemplatesModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
