import { Controller, Get, Delete, Param, UseGuards, Request, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { Body } from '@nestjs/common';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private usersService: UsersService,
    private emailService: EmailService,
  ) {}

  @Get('users')
  async getAllUsers(@Request() req) {
    // Admin or Super
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user.role)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const users = await this.usersService.findAll();
    return users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      building: user.building,
      apartmentNumber: user.apartmentNumber,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    // Admin or Super
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user.role)) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Prevent admin from deleting themselves
    if (req.user.sub === id) {
      throw new Error('Cannot delete your own account');
    }

    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  @Post('users/:id/resend-verification')
  async resendVerificationEmail(@Param('id') id: string, @Request() req) {
    // Admin or Super
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user.role)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('User email is already verified');
    }

    // Generate new verification token
    const verificationToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Save new verification token
    await this.usersService.updateEmailVerificationToken(user.id, verificationToken, expiresAt);

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, verificationToken, user.name);

    return { message: 'Verification email sent successfully' };
  }

  // Admin-only: change user role (promote/demote including super)
  @Post('users/:id/role')
  async changeUserRole(@Param('id') id: string, @Request() req) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only admins can change user roles');
    }
    const body = (req as any).body as { role: UserRole };
    if (![UserRole.USER, UserRole.ADMIN, UserRole.SUPER].includes(body.role)) {
      throw new Error('Invalid role');
    }
    await this.usersService.updateUserRole(id, body.role);
    return { message: 'User role updated' };
  }

  // Admin-only: create user (optionally as super user)
  @Post('users')
  async createUser(
    @Body() body: { email: string; password: string; name: string; building: string; apartmentNumber: string; isSuper?: boolean },
    @Request() req,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only admins can create users');
    }
    const user = await this.usersService.create({
      email: body.email,
      password: body.password,
      name: body.name,
      building: body.building,
      apartmentNumber: body.apartmentNumber,
    } as any);
    // Mark verified and set role
    await this.usersService.updateEmailVerification(user.id, true);
    if (body.isSuper) {
      await this.usersService.updateUserRole(user.id, UserRole.SUPER);
    }
    return { id: user.id };
  }
}
