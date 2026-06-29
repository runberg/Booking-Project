import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

type CreateUserData = {
  email: string;
  password: string;
  name: string;
  building: string;
  apartmentNumber: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    if (data.email.toLowerCase().endsWith('@security.local')) {
      throw new BadRequestException('Invalid email address');
    }

    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUnit = await this.usersRepository.findOne({
      where: {
        building: data.building,
        apartmentNumber: data.apartmentNumber,
      },
    });
    if (existingUnit) {
      throw new ConflictException(
        'This building and apartment number is already registered',
      );
    }

    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.usersRepository.findBy({ id: In(ids) });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: MoreThan(new Date()),
      },
    });
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: MoreThan(new Date()),
      },
    });
  }

  async updateEmailVerification(
    userId: string,
    isVerified: boolean,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      isEmailVerified: isVerified,
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
    });
  }

  async updateEmailVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt,
    });
  }

  async updatePasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await this.usersRepository.update(userId, { role });
  }

  async updateName(userId: string, name: string): Promise<void> {
    await this.usersRepository.update(userId, { name });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.usersRepository.delete(userId);
  }

  async setApproval(userId: string, approved: boolean): Promise<void> {
    await this.usersRepository.update(userId, { isApproved: approved });
  }

  async findPendingApproval(): Promise<User[]> {
    return this.usersRepository.find({
      where: { isApproved: false, isEmailVerified: true },
    });
  }

  async findAdminsAndSupers(): Promise<User[]> {
    return this.usersRepository.find({
      where: [{ role: UserRole.ADMIN }, { role: UserRole.SUPER }],
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
