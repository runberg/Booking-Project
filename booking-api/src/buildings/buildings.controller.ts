import { Controller, Get } from '@nestjs/common';
import { BuildingsService } from './buildings.service';

@Controller('buildings')
export class BuildingsController {
  constructor(private buildingsService: BuildingsService) {}

  @Get()
  async listActive() {
    const buildings = await this.buildingsService.listActive();
    return buildings.map((b) => ({ id: b.id, name: b.name }));
  }
}


