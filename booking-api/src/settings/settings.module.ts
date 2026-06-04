import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Setting } from './setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Setting]), ConfigModule, EmailModule],
  providers: [SettingsService, RolesGuard],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
