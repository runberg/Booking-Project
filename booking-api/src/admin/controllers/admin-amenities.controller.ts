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
import { AmenitiesService } from '../../shared/amenities/amenities.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';

@Controller('admin/amenities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminAmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  async listAll() {
    return this.amenitiesService.listAll();
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      openTime?: string;
      closeTime?: string;
      imageUrl?: string;
      slotLength?: number;
      isActive?: boolean;
    },
  ) {
    return this.amenitiesService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      openTime?: string;
      closeTime?: string;
      imageUrl?: string;
      slotLength?: number;
      isActive?: boolean;
      bookingRestrictionId?: string | null;
    },
  ) {
    return this.amenitiesService.update(id, body);
  }

  @Post(':id/qr/regenerate')
  async regenerateQr(@Param('id') id: string) {
    return this.amenitiesService.regenerateQrToken(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.amenitiesService.remove(id);
    return { message: 'Amenity deleted' };
  }
}
