import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BuildingsService } from '../buildings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';

@Controller('admin/buildings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminBuildingsController {
  constructor(private buildingsService: BuildingsService) {}

  @Get()
  async listAll() {
    return this.buildingsService.listAll();
  }

  @Post()
  async create(@Body('name') name: string) {
    return this.buildingsService.create(name);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    return this.buildingsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.buildingsService.remove(id);
    return { message: 'Building deleted' };
  }

  @Get(':id/units')
  async listUnits(@Param('id') id: string) {
    return this.buildingsService.listUnitsForBuilding(id);
  }

  @Put(':id/units')
  async replaceUnits(
    @Param('id') id: string,
    @Body('units') units: string[],
  ) {
    return this.buildingsService.replaceUnits(id, units ?? []);
  }
}
