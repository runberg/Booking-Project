import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './building.entity';
import { BuildingUnit } from './building-unit.entity';
import { BuildingsService } from './buildings.service';
import { BuildingsController } from './buildings.controller';
import { AdminBuildingsController } from './controllers/admin-buildings.controller';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Building, BuildingUnit])],
  providers: [BuildingsService, RolesGuard],
  controllers: [BuildingsController, AdminBuildingsController],
  exports: [BuildingsService],
})
export class BuildingsModule {}
