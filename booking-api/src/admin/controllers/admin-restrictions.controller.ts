import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RestrictionsService } from '../../shared/restrictions/restrictions.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/users/user.entity';

@Controller('admin/restrictions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER)
export class AdminRestrictionsController {
  constructor(private readonly restrictionsService: RestrictionsService) {}

  @Get()
  async listAll() {
    return this.restrictionsService.listAll();
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      daysAhead: number;
      maxPerPeriod: number;
      maxPerDay: number;
      isActive?: boolean;
    },
  ) {
    return this.restrictionsService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      daysAhead: number;
      maxPerPeriod: number;
      maxPerDay: number;
      isActive: boolean;
    }>,
  ) {
    return this.restrictionsService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.restrictionsService.remove(id);
    return { message: 'Restriction deleted' };
  }
}
