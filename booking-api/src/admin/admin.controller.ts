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
  ) {}

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
