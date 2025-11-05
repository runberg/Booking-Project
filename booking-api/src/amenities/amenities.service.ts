import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amenity } from './amenity.entity';
import { BookingRestriction } from '../restrictions/booking-restriction.entity';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(Amenity)
    private amenitiesRepository: Repository<Amenity>,
    @InjectRepository(BookingRestriction)
    private restrictionsRepository: Repository<BookingRestriction>,
  ) {}

  async listActive(): Promise<Amenity[]> {
    return this.amenitiesRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async listAll(): Promise<Amenity[]> {
    return this.amenitiesRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Amenity | null> {
    return this.amenitiesRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Amenity>): Promise<Amenity> {
    const existing = await this.amenitiesRepository.findOne({ where: { name: data.name } });
    if (existing) throw new ConflictException('Amenity with this name already exists');
    const restrictionsCount = await this.restrictionsRepository.count();
    if (restrictionsCount === 0) {
      throw new BadRequestException('No booking restrictions exist. Create a restriction before adding an amenity.');
    }
    if (!data.bookingRestrictionId) {
      throw new BadRequestException('bookingRestrictionId is required');
    }
    const restriction = await this.restrictionsRepository.findOne({ where: { id: data.bookingRestrictionId as any } });
    if (!restriction) {
      throw new BadRequestException('Invalid bookingRestrictionId');
    }
    const amenity = this.amenitiesRepository.create({
      name: data.name!,
      description: data.description ?? null,
      openTime: data.openTime ?? '09:00',
      closeTime: data.closeTime ?? '22:00',
      imageUrl: data.imageUrl ?? null,
      slotLength: data.slotLength ?? 60,
      isActive: data.isActive ?? true,
      bookingRestrictionId: data.bookingRestrictionId,
    });
    return this.amenitiesRepository.save(amenity);
  }

  async update(id: string, attrs: Partial<Amenity>): Promise<Amenity> {
    const amenity = await this.amenitiesRepository.findOne({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    if (attrs.name && attrs.name !== amenity.name) {
      const existing = await this.amenitiesRepository.findOne({ where: { name: attrs.name } });
      if (existing) throw new ConflictException('Amenity with this name already exists');
    }
    if (attrs.bookingRestrictionId) {
      const r = await this.restrictionsRepository.findOne({ where: { id: attrs.bookingRestrictionId as any } });
      if (!r) throw new BadRequestException('Invalid bookingRestrictionId');
    }
    Object.assign(amenity, attrs);
    return this.amenitiesRepository.save(amenity);
  }

  async remove(id: string): Promise<void> {
    await this.amenitiesRepository.delete(id);
  }
}


