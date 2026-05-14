import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplatesService } from './email-templates.service';
import { AdminEmailTemplatesController } from './controllers/admin-email-templates.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate])],
  providers: [EmailTemplatesService],
  controllers: [EmailTemplatesController, AdminEmailTemplatesController],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
