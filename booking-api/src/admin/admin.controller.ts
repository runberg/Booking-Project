import { randomBytes } from 'crypto';
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
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private usersService: UsersService,
    private emailService: EmailService,
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
  async deleteUser(@Param('id') id: string, @Request() req) {
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body()
    body: {
      // regular / super user fields
      email?: string;
      name?: string;
      building?: string;
      apartmentNumber?: string;
      isSuper?: boolean;
      // security user fields
      username?: string;
      isSecurity?: boolean;
      // shared
      password: string;
    },
  ) {
    let email: string;
    let name: string;
    let building: string;
    let apartmentNumber: string;

    if (!body.password || body.password.length < 8 || body.password.length > 128) {
      throw new BadRequestException('Password must be between 8 and 128 characters');
    }

    if (body.isSecurity) {
      if (!body.username) throw new BadRequestException('username is required for security users');
      email = `${body.username}@security.local`;
      name = body.username;
      building = 'Security';
      apartmentNumber = body.username;
    } else {
      if (!body.email || !body.name || !body.building || !body.apartmentNumber) {
        throw new BadRequestException('email, name, building and apartmentNumber are required');
      }
      email = body.email;
      name = body.name;
      building = body.building;
      apartmentNumber = body.apartmentNumber;
    }

    const user = await this.usersService.create({ email, password: body.password, name, building, apartmentNumber } as any);
    await this.usersService.updateEmailVerification(user.id, true);
    if (body.isSuper) {
      await this.usersService.updateUserRole(user.id, UserRole.SUPER);
    } else if (body.isSecurity) {
      await this.usersService.updateUserRole(user.id, UserRole.SECURITY);
    }
    return { id: user.id };
  }
}
