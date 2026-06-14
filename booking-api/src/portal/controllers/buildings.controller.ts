import { Controller, Get, Param } from '@nestjs/common';
import { BuildingsService } from '../../shared/buildings/buildings.service';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  async listActive() {
    const buildings = await this.buildingsService.listActive();
    return buildings.map((b) => ({ id: b.id, name: b.name }));
  }

  @Get(':id/units')
  async listUnits(@Param('id') id: string) {
    const units = await this.buildingsService.listUnitsForBuilding(id);
    return units.map((u) => ({ id: u.id, unitNumber: u.unitNumber }));
  }
}
