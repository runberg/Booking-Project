import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Setting } from './setting.entity';
import { SettingsService } from './settings.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    ConfigModule,
    forwardRef(() => EmailModule),
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
