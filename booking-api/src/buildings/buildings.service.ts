import { Injectable, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from './building.entity';

@Injectable()
export class BuildingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
  ) {}

  async onModuleInit() {
    // Seed a default building if none exist
    const count = await this.buildingsRepository.count();
    if (count === 0) {
      const defaultBuilding = this.buildingsRepository.create({ name: 'Default Building', isActive: true });
      try {
        await this.buildingsRepository.save(defaultBuilding);
        // eslint-disable-next-line no-console
        console.log('✅ Seeded default building: "Default Building"');
      } catch (e) {
        // ignore if unique constraint or any race on startup
      }
    }
  }

  async listActive(): Promise<Building[]> {
    return this.buildingsRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async listAll(): Promise<Building[]> {
    return this.buildingsRepository.find({ order: { name: 'ASC' } });
  }

  async create(name: string): Promise<Building> {
    const existing = await this.buildingsRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('Building with this name already exists');
    }
    const building = this.buildingsRepository.create({ name, isActive: true });
    return this.buildingsRepository.save(building);
  }

  async update(id: string, attrs: Partial<Pick<Building, 'name' | 'isActive'>>): Promise<Building> {
    const building = await this.buildingsRepository.findOne({ where: { id } });
    if (!building) throw new NotFoundException('Building not found');

    if (attrs.name && attrs.name !== building.name) {
      const existing = await this.buildingsRepository.findOne({ where: { name: attrs.name } });
      if (existing) throw new ConflictException('Building with this name already exists');
    }

    Object.assign(building, attrs);
    return this.buildingsRepository.save(building);
  }

  async remove(id: string): Promise<void> {
    await this.buildingsRepository.delete(id);
  }
}


