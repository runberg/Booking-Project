import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.createAdminIfNotExists();
  }

  private async createAdminIfNotExists() {
    const adminEmail = this.configService.get('ADMIN_EMAIL');
    const adminPassword = this.configService.get('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      console.log('Admin credentials not configured, skipping admin creation');
      return;
    }

    try {
      const existingAdmin = await this.usersService.findByEmail(adminEmail);
      
      if (!existingAdmin) {
        // Create admin user - password will be automatically hashed by User entity's @BeforeInsert hook
        const adminUser = await this.usersService.create({
          email: adminEmail,
          password: adminPassword, // This will be hashed automatically before saving
          name: 'Admin User',
          building: 'Admin Building',
          apartmentNumber: 'Admin',
        });

        // Mark as verified and admin
        await this.usersService.updateEmailVerification(adminUser.id, true);
        await this.usersService.updateUserRole(adminUser.id, UserRole.ADMIN);

        console.log(`✅ Admin user created: ${adminEmail}`);
      } else {
        console.log(`ℹ️ Admin user already exists: ${adminEmail}`);
      }
    } catch (error) {
      console.error('❌ Failed to create admin user:', error.message);
    }
  }
}
