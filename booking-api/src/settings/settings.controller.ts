import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('smtp')
  async getSmtp() {
    return this.settingsService.getSmtpSettings();
  }

  @Put('smtp')
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
}
