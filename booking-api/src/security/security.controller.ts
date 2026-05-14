import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { BookingsService } from '../bookings/bookings.service';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SECURITY, UserRole.ADMIN, UserRole.SUPER)
@SkipThrottle()
export class SecurityController {
  constructor(private bookingsService: BookingsService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.bookingsService.getSecurityDashboard();
  }
}
