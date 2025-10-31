import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplatesService } from './email-templates.service';
import { AdminEmailTemplatesController } from './controllers/admin-email-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate])],
  providers: [EmailTemplatesService],
  controllers: [AdminEmailTemplatesController],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}


