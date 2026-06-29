import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ContactAdminDto,
} from './dto/auth.dto';
import { AuthResponseDto } from './dto/response.dto';
import { User } from '../users/user.entity';
import { BookingLog } from '../bookings/booking-log.entity';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    @InjectRepository(BookingLog)
    private readonly logsRepo: Repository<BookingLog>,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const user = await this.usersService.create(registerDto);

    const approvalRequired = await this.settingsService.get('admin_approval_required');
    if (approvalRequired === 'true') {
      await this.usersService.setApproval(user.id, false);
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

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    const lookupEmail = loginDto.email.includes('@')
      ? loginDto.email
      : `${loginDto.email}@security.local`;
    const user = await this.usersService.findByEmail(lookupEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await user.validatePassword(loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Please verify your email address before logging in',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user);

    this.logsRepo
      .save(
        this.logsRepo.create({
          action: 'login',
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          building: user.building ?? '',
          apartmentNumber: user.apartmentNumber ?? '',
          ipAddress: ipAddress ?? null,
          bookingId: null,
          amenityName: null,
          date: null,
          startTime: null,
          slotLength: null,
        }),
      )
      .catch(() => {});

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string; pendingApproval?: boolean }> {
    const user = await this.usersService.findByEmailVerificationToken(
      verifyEmailDto.token,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.updateEmailVerification(user.id, true);

    if (!user.isApproved) {
      return {
        message: 'Email verified. Your account is awaiting admin approval.',
        pendingApproval: true,
      };
    }

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      return {
        message:
          'If an account with this email exists, a password reset link has been sent.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.usersService.updatePasswordResetToken(
      user.id,
      resetToken,
      expiresAt,
    );

    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.name,
    );

    return {
      message:
        'If an account with this email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByPasswordResetToken(
      resetPasswordDto.token,
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.usersService.updatePassword(
      user.id,
      resetPasswordDto.newPassword,
    );

    return {
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  async contactAdmin(dto: ContactAdminDto): Promise<{ message: string }> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') ?? '';
    const body =
      `A registration enquiry has been submitted via the website.\n\n` +
      `Name: ${dto.name}\n` +
      `Email: ${dto.email}\n` +
      `Building: ${dto.building}\n` +
      `Unit: ${dto.unit}\n\n` +
      `Message:\n${dto.message}`;
    await this.emailService.sendGenericEmail(
      adminEmail,
      'Registration enquiry from website',
      body,
    );
    return { message: 'Your message has been sent to the administrator.' };
  }

  async refreshToken(user: User): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(
    user: User,
  ): Omit<User, 'password' | 'hashPassword' | 'validatePassword'> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      building: user.building,
      apartmentNumber: user.apartmentNumber,
      isEmailVerified: user.isEmailVerified,
      emailVerificationToken: user.emailVerificationToken,
      emailVerificationExpires: user.emailVerificationExpires,
      passwordResetToken: user.passwordResetToken,
      passwordResetExpires: user.passwordResetExpires,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.isApproved,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
