import { Controller, Get } from '@nestjs/common';
import { AmenitiesService } from '../amenities.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingRestriction } from '../../restrictions/booking-restriction.entity';

@Controller('amenities')
export class AmenitiesController {
  constructor(
    private amenitiesService: AmenitiesService,
    @InjectRepository(BookingRestriction) private restrictionsRepo: Repository<BookingRestriction>,
  ) {}

  @Get()
  async listActive() {
    const amenities = await this.amenitiesService.listActive();
    const restrictionIds = Array.from(new Set(amenities.map((a) => a.bookingRestrictionId).filter(Boolean))) as string[];
    const restrictions = restrictionIds.length
      ? await this.restrictionsRepo.find({ where: { id: In(restrictionIds) } })
      : [];
    const idToRestriction = new Map(restrictions.map((r) => [r.id, r]));

    return amenities.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      openTime: a.openTime,
      closeTime: a.closeTime,
      slotLength: a.slotLength,
      imageUrl: a.imageUrl,
      daysAhead: idToRestriction.get(a.bookingRestrictionId || '')?.daysAhead ?? 14,
      maxPerPeriod: idToRestriction.get(a.bookingRestrictionId || '')?.maxPerPeriod ?? null,
      maxPerDay: idToRestriction.get(a.bookingRestrictionId || '')?.maxPerDay ?? null,
    }));
  }
}


