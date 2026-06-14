import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAmenitiesController } from './controllers/admin-amenities.controller';
import { AdminBuildingsController } from './controllers/admin-buildings.controller';
import { AdminEmailTemplatesController } from './controllers/admin-email-templates.controller';
import { AdminRestrictionsController } from './controllers/admin-restrictions.controller';
import { SecurityController } from './controllers/security.controller';
import { SettingsController } from './controllers/settings.controller';
import { AuthModule } from '../shared/auth/auth.module';
import { UsersModule } from '../shared/users/users.module';
import { EmailModule } from '../shared/email/email.module';
import { AmenitiesModule } from '../shared/amenities/amenities.module';
import { BuildingsModule } from '../shared/buildings/buildings.module';
import { EmailTemplatesModule } from '../shared/email-templates/email-templates.module';
import { RestrictionsModule } from '../shared/restrictions/restrictions.module';
import { SettingsModule } from '../shared/settings/settings.module';
import { BookingsModule } from '../shared/bookings/bookings.module';
import { RolesGuard } from '../shared/guards/roles.guard';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    EmailModule,
    AmenitiesModule,
    BuildingsModule,
    EmailTemplatesModule,
    RestrictionsModule,
    SettingsModule,
    BookingsModule,
  ],
  providers: [AdminService, RolesGuard],
  controllers: [
    AdminController,
    AdminAmenitiesController,
    AdminBuildingsController,
    AdminEmailTemplatesController,
    AdminRestrictionsController,
    SecurityController,
    SettingsController,
  ],
})
export class AdminModule {}
