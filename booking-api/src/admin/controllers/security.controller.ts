import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';
import { BookingsService } from '../../shared/bookings/bookings.service';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SECURITY, UserRole.ADMIN, UserRole.SUPER)
@SkipThrottle()
export class SecurityController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.bookingsService.getSecurityDashboard();
  }
}
