import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('smtp')
  @Roles(UserRole.ADMIN)
  async getSmtp() {
    return this.settingsService.getSmtpSettings();
  }

  @Put('smtp')
  @Roles(UserRole.ADMIN)
  async updateSmtp(
    @Body()
    body: {
      smtp_host?: string;
      smtp_port?: string;
      smtp_user?: string;
      smtp_pass?: string;
      smtp_from?: string;
    },
  ) {
    const allowed = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'];
    for (const [key, value] of Object.entries(body)) {
      if (allowed.includes(key) && value !== undefined) {
        await this.settingsService.set(key, value || null);
      }
    }
    return this.settingsService.getSmtpSettings();
  }

  @Get('reminder')
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async getReminder() {
    const hours = await this.settingsService.get('reminder_hours_before');
    return { reminder_hours_before: hours ?? '24' };
  }

  @Put('reminder')
  @Roles(UserRole.ADMIN, UserRole.SUPER)
  async updateReminder(@Body() body: { reminder_hours_before?: string }) {
    if (body.reminder_hours_before !== undefined) {
      const val = parseInt(body.reminder_hours_before, 10);
      if (isNaN(val) || val < 1 || val > 168) {
        return { reminder_hours_before: await this.settingsService.get('reminder_hours_before') ?? '24' };
      }
      await this.settingsService.set('reminder_hours_before', String(val));
    }
    const hours = await this.settingsService.get('reminder_hours_before');
    return { reminder_hours_before: hours ?? '24' };
  }
}
