import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../shared/users/users.service';
import { UserRole } from '../shared/users/user.entity';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.createAdminIfNotExists();
  }

  private async createAdminIfNotExists() {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      return;
    }

    try {
      const existingAdmin = await this.usersService.findByEmail(adminEmail);
      if (existingAdmin) return;

      const adminUser = await this.usersService.create({
        email: adminEmail,
        password: adminPassword,
        name: 'Admin User',
        building: 'Admin Building',
        apartmentNumber: 'Admin',
      });

      await this.usersService.updateEmailVerification(adminUser.id, true);
      await this.usersService.updateUserRole(adminUser.id, UserRole.ADMIN);
    } catch {
      // non-fatal: admin user may already exist or DB may not be ready
    }
  }
}
