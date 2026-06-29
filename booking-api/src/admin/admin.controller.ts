import { randomBytes } from 'node:crypto';
import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Post,
  Body,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UsersService } from '../shared/users/users.service';
import { EmailService } from '../shared/email/email.service';
import { BookingsService } from '../shared/bookings/bookings.service';
import { JwtAuthGuard } from '../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '../shared/users/user.entity';
import type { RequestWithUser } from '../shared/types/request-with-user';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly bookingsService: BookingsService,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private interpolateUser(template: string, name: string, email: string): string {
    return template
      .replaceAll('{{name}}', name || email)
      .replaceAll('{{email}}', email);
  }

  private interpolateBooking(
    template: string,
    booking: { userName: string; userEmail: string; amenityName: string; date: string; startTime: string },
  ): string {
    return template
      .replaceAll('{{name}}', booking.userName || booking.userEmail)
      .replaceAll('{{email}}', booking.userEmail)
      .replaceAll('{{amenity}}', booking.amenityName)
      .replaceAll('{{date}}', booking.date)
      .replaceAll('{{time}}', booking.startTime);
  }

  @Get('users')
  async getAllUsers() {
    const users = await this.usersService.findAll();
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      building: user.building,
      apartmentNumber: user.apartmentNumber,
      isEmailVerified: user.isEmailVerified,
      isApproved: user.isApproved,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (req.user.id === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  @Post('users/:id/resend-verification')
  async resendVerificationEmail(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified) {
      throw new BadRequestException('User email is already verified');
    }

    const verificationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.usersService.updateEmailVerificationToken(
      user.id,
      verificationToken,
      expiresAt,
    );
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.name,
    );

    return { message: 'Verification email sent successfully' };
  }

  @Post('users/:id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    if (!Object.values(UserRole).includes(body.role)) {
      throw new BadRequestException('Invalid role');
    }
    await this.usersService.updateUserRole(id, body.role);
    return { message: 'User role updated' };
  }

  @Post('users/:id/approve')
  async approveUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.setApproval(id, true);
    await this.emailService.sendTemplateEmail(
      user.email,
      'Your account has been approved',
      'user_approved',
      { name: user.name },
    );
    return { message: 'User approved' };
  }

  @Post('users/:id/reject')
  async rejectUser(
    @Param('id') id: string,
    @Body() body: { subject: string; emailBody: string },
  ) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const subject = this.interpolateUser(body.subject, user.name, user.email);
    const html = this.interpolateUser(body.emailBody, user.name, user.email);
    await this.emailService.sendHtmlEmail(user.email, subject, html);
    await this.bookingsService.deleteAllForUser(id);
    await this.usersService.deleteUser(id);
    return { message: 'User rejected and removed' };
  }

  @Post('users/:id/revoke')
  async revokeUser(
    @Param('id') id: string,
    @Body() body: { subject: string; emailBody: string },
    @Request() req: RequestWithUser,
  ) {
    if (req.user.id === id) {
      throw new ForbiddenException('Cannot revoke your own access');
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.setApproval(id, false);
    const subject = this.interpolateUser(body.subject, user.name, user.email);
    const html = this.interpolateUser(body.emailBody, user.name, user.email);
    await this.emailService.sendHtmlEmail(user.email, subject, html);
    return { message: 'User access revoked' };
  }

  @Post('users/:id/delete-account')
  async adminDeleteUserWithEmail(
    @Param('id') id: string,
    @Body() body: { subject: string; emailBody: string },
    @Request() req: RequestWithUser,
  ) {
    if (req.user.id === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const subject = this.interpolateUser(body.subject, user.name, user.email);
    const html = this.interpolateUser(body.emailBody, user.name, user.email);
    await this.emailService.sendHtmlEmail(user.email, subject, html);
    await this.bookingsService.deleteAllForUser(id);
    await this.usersService.deleteUser(id);
    return { message: 'User account deleted' };
  }

  @Get('bookings')
  async getAllBookings() {
    return this.bookingsService.findAllUpcomingForAdmin();
  }

  @Post('bookings/delete-bulk')
  async bulkDeleteBookings(
    @Body() body: { bookingIds: string[]; subject: string; emailBody: string },
  ) {
    if (!Array.isArray(body.bookingIds) || body.bookingIds.length === 0) {
      throw new BadRequestException('bookingIds must be a non-empty array');
    }
    const bookings = await this.bookingsService.findByIdsWithDetails(body.bookingIds);
    for (const booking of bookings) {
      const subject = this.interpolateBooking(body.subject, booking);
      const html = this.interpolateBooking(body.emailBody, booking);
      await this.emailService.sendHtmlEmail(booking.userEmail, subject, html);
      await this.bookingsService.deleteByIdForAdmin(booking.id);
      await this.sleep(200);
    }
    return { deleted: bookings.length };
  }

  @Post('users/approve-bulk')
  async bulkApproveUsers(@Body() body: { userIds: string[] }) {
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      throw new BadRequestException('userIds must be a non-empty array');
    }
    let approved = 0;
    for (const id of body.userIds) {
      const user = await this.usersService.findById(id);
      if (!user || user.isApproved) continue;
      await this.usersService.setApproval(id, true);
      await this.emailService.sendTemplateEmail(
        user.email,
        'Your account has been approved',
        'user_approved',
        { name: user.name },
      );
      approved++;
      await this.sleep(200);
    }
    return { message: `${approved} user(s) approved`, count: approved };
  }

  @Post('users')
  async createUser(
    @Body()
    body: {
      email?: string;
      name?: string;
      building?: string;
      apartmentNumber?: string;
      isSuper?: boolean;
      username?: string;
      isSecurity?: boolean;
      password: string;
    },
    @Request() req: RequestWithUser,
  ) {
    if (
      !body.password ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      throw new BadRequestException(
        'Password must be between 8 and 128 characters',
      );
    }

    if (body.isSuper && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create super users');
    }

    let email: string;
    let name: string;
    let building: string;
    let apartmentNumber: string;

    if (body.isSecurity) {
      if (!body.username)
        throw new BadRequestException(
          'username is required for security users',
        );
      email = `${body.username}@security.local`;
      name = body.username;
      building = 'Security';
      apartmentNumber = body.username;
    } else {
      if (
        !body.email ||
        !body.name ||
        !body.building ||
        !body.apartmentNumber
      ) {
        throw new BadRequestException(
          'email, name, building and apartmentNumber are required',
        );
      }
      email = body.email;
      name = body.name;
      building = body.building;
      apartmentNumber = body.apartmentNumber;
    }

    const user = await this.usersService.create({
      email,
      password: body.password,
      name,
      building,
      apartmentNumber,
    });
    await this.usersService.updateEmailVerification(user.id, true);
    if (body.isSuper) {
      await this.usersService.updateUserRole(user.id, UserRole.SUPER);
    } else if (body.isSecurity) {
      await this.usersService.updateUserRole(user.id, UserRole.SECURITY);
    }
    return { id: user.id };
  }
}
