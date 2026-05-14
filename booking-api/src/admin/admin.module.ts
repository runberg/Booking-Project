import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [UsersModule, EmailModule],
  providers: [AdminService, RolesGuard],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
