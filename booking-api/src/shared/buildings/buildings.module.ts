import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './building.entity';
import { BuildingUnit } from './building-unit.entity';
import { BuildingsService } from './buildings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Building, BuildingUnit])],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
