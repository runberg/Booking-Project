import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { RestrictionsService } from '../restrictions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/user.entity';

@Controller('admin/restrictions')
@UseGuards(JwtAuthGuard)
export class AdminRestrictionsController {
  constructor(private restrictionsService: RestrictionsService) {}

  private ensureAdminOrSuper(req: any) {
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user?.role)) {
      throw new Error('Unauthorized: Admin access required');
    }
  }

  @Get()
  async listAll(@Request() req) {
    this.ensureAdminOrSuper(req);
    return this.restrictionsService.listAll();
  }

  @Post()
  async create(@Body() body: { name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive?: boolean }, @Request() req) {
    this.ensureAdminOrSuper(req);
    return this.restrictionsService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<{ name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive: boolean }>, @Request() req) {
    this.ensureAdminOrSuper(req);
    return this.restrictionsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.ensureAdminOrSuper(req);
    await this.restrictionsService.remove(id);
    return { message: 'Restriction deleted' };
  }
}


