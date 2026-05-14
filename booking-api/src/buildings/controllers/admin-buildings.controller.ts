import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BuildingsService } from '../buildings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/user.entity';

@Controller('admin/buildings')
@UseGuards(JwtAuthGuard)
export class AdminBuildingsController {
  constructor(private buildingsService: BuildingsService) {}

  private ensureAdminOrSuper(req: any) {
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user?.role)) {
      throw new Error('Unauthorized: Admin access required');
    }
  }

  @Get()
  async listAll(@Request() req) {
    this.ensureAdminOrSuper(req);
    return this.buildingsService.listAll();
  }

  @Post()
  async create(@Body('name') name: string, @Request() req) {
    this.ensureAdminOrSuper(req);
    return this.buildingsService.create(name);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
    @Request() req,
  ) {
    this.ensureAdminOrSuper(req);
    return this.buildingsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.ensureAdminOrSuper(req);
    await this.buildingsService.remove(id);
    return { message: 'Building deleted' };
  }
}
