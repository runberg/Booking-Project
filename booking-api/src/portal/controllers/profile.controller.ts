import {
  Controller,
  Patch,
  Delete,
  Body,
  Request,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { UsersService } from '../../shared/users/users.service';
import { BookingsService } from '../../shared/bookings/bookings.service';
import type { RequestWithUser } from '../../shared/types/request-with-user';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Patch('name')
  async updateName(
    @Request() req: RequestWithUser,
    @Body() body: { name?: string },
  ) {
    const name = body.name?.trim();
    if (!name || name.length < 1 || name.length > 100) {
      throw new BadRequestException('Name must be between 1 and 100 characters');
    }
    await this.usersService.updateName(req.user.id, name);
    return { name };
  }

  @Patch('password')
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    if (
      body.newPassword.length < MIN_PASSWORD_LENGTH ||
      body.newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      throw new BadRequestException(
        `New password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
      );
    }
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new UnauthorizedException();

    const valid = await user.validatePassword(body.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    await this.usersService.updatePassword(req.user.id, body.newPassword);
    return { message: 'Password updated' };
  }

  @Delete()
  async deleteAccount(
    @Request() req: RequestWithUser,
    @Body() body: { password?: string },
  ) {
    if (!body.password) {
      throw new BadRequestException('Password is required to delete your account');
    }
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new UnauthorizedException();

    const valid = await user.validatePassword(body.password);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.bookingsService.deleteAllForUser(user.id);
    await this.usersService.deleteUser(user.id);
    return { message: 'Account deleted' };
  }
}
