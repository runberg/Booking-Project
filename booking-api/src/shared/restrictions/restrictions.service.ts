import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingRestriction } from './booking-restriction.entity';

@Injectable()
export class RestrictionsService {
  constructor(
    @InjectRepository(BookingRestriction)
    private readonly restrictionsRepo: Repository<BookingRestriction>,
  ) {}

  async listAll(): Promise<BookingRestriction[]> {
    return this.restrictionsRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<BookingRestriction | null> {
    return this.restrictionsRepo.findOne({ where: { id } });
  }

  async listActive(): Promise<BookingRestriction[]> {
    return this.restrictionsRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(data: Partial<BookingRestriction>): Promise<BookingRestriction> {
    const existing = await this.restrictionsRepo.findOne({
      where: { name: data.name },
    });
    if (existing)
      throw new ConflictException('Restriction with this name already exists');
    const entity = this.restrictionsRepo.create({
      name: data.name,
      daysAhead: data.daysAhead ?? 14,
      maxPerPeriod: data.maxPerPeriod ?? 2,
      maxPerDay: data.maxPerDay ?? 1,
      isActive: data.isActive ?? true,
    });
    return this.restrictionsRepo.save(entity);
  }

  async update(
    id: string,
    attrs: Partial<BookingRestriction>,
  ): Promise<BookingRestriction> {
    const entity = await this.restrictionsRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Restriction not found');
    if (attrs.name && attrs.name !== entity.name) {
      const existing = await this.restrictionsRepo.findOne({
        where: { name: attrs.name },
      });
      if (existing)
        throw new ConflictException(
          'Restriction with this name already exists',
        );
    }
    Object.assign(entity, attrs);
    return this.restrictionsRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.restrictionsRepo.delete(id);
  }
}
