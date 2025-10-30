import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AmenitiesService } from '../amenities.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRole } from '../../users/user.entity';

@Controller('admin/amenities')
@UseGuards(JwtAuthGuard)
export class AdminAmenitiesController {
  constructor(private amenitiesService: AmenitiesService) {}

  private ensureAdminOrSuper(req: any) {
    if (![UserRole.ADMIN, UserRole.SUPER].includes(req.user?.role)) {
      throw new Error('Unauthorized: Admin access required');
    }
  }

  @Get()
  async listAll(@Request() req) {
    this.ensureAdminOrSuper(req);
    return this.amenitiesService.listAll();
  }

  @Post()
  async create(@Body() body: { name: string; description?: string; openTime?: string; closeTime?: string; imageUrl?: string; slotLength?: number; isActive?: boolean }, @Request() req) {
    this.ensureAdminOrSuper(req);
    return this.amenitiesService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; description?: string; openTime?: string; closeTime?: string; imageUrl?: string; slotLength?: number; isActive?: boolean; bookingRestrictionId?: string | null }, @Request() req) {
    this.ensureAdminOrSuper(req);
    return this.amenitiesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.ensureAdminOrSuper(req);
    await this.amenitiesService.remove(id);
    return { message: 'Amenity deleted' };
  }
}


