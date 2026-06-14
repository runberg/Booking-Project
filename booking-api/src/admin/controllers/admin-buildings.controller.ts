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
import { BuildingsService } from '../../shared/buildings/buildings.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';

@Controller('admin/buildings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminBuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

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
  async replaceUnits(@Param('id') id: string, @Body('units') units: string[]) {
    return this.buildingsService.replaceUnits(id, units ?? []);
  }
}
