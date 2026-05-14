import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from './building.entity';
import { BuildingUnit } from './building-unit.entity';

@Injectable()
export class BuildingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    @InjectRepository(BuildingUnit)
    private unitsRepo: Repository<BuildingUnit>,
  ) {}

  async onModuleInit() {
    // Seed a default building if none exist
    const count = await this.buildingsRepository.count();
    if (count === 0) {
      const defaultBuilding = this.buildingsRepository.create({
        name: 'Default Building',
        isActive: true,
      });
      try {
        await this.buildingsRepository.save(defaultBuilding);

        console.log('✅ Seeded default building: "Default Building"');
      } catch (e) {
        // ignore if unique constraint or any race on startup
      }
    }
  }

  async listActive(): Promise<Building[]> {
    return this.buildingsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async listAll(): Promise<Building[]> {
    return this.buildingsRepository.find({ order: { name: 'ASC' } });
  }

  async create(name: string): Promise<Building> {
    const existing = await this.buildingsRepository.findOne({
      where: { name },
    });
    if (existing) {
      throw new ConflictException('Building with this name already exists');
    }
    const building = this.buildingsRepository.create({ name, isActive: true });
    return this.buildingsRepository.save(building);
  }

  async update(
    id: string,
    attrs: Partial<Pick<Building, 'name' | 'isActive'>>,
  ): Promise<Building> {
    const building = await this.buildingsRepository.findOne({ where: { id } });
    if (!building) throw new NotFoundException('Building not found');

    if (attrs.name && attrs.name !== building.name) {
      const existing = await this.buildingsRepository.findOne({
        where: { name: attrs.name },
      });
      if (existing)
        throw new ConflictException('Building with this name already exists');
    }

    if (attrs.isActive === true) {
      const unitCount = await this.unitsRepo.count({ where: { buildingId: id } });
      if (unitCount === 0) {
        throw new BadRequestException('Cannot activate a building with no units');
      }
    }

    Object.assign(building, attrs);
    return this.buildingsRepository.save(building);
  }

  async listUnitsForBuilding(buildingId: string): Promise<BuildingUnit[]> {
    return this.unitsRepo.find({
      where: { buildingId },
      order: { unitNumber: 'ASC' },
    });
  }

  async replaceUnits(
    buildingId: string,
    unitNumbers: string[],
  ): Promise<BuildingUnit[]> {
    await this.unitsRepo.delete({ buildingId });

    const deduped = [
      ...new Set(
        unitNumbers.map((u) => u.trim()).filter((u) => u.length > 0),
      ),
    ];

    if (deduped.length > 0) {
      const entities = deduped.map((unitNumber) =>
        this.unitsRepo.create({ buildingId, unitNumber }),
      );
      await this.unitsRepo.save(entities);
    }

    return this.listUnitsForBuilding(buildingId);
  }

  async remove(id: string): Promise<void> {
    await this.buildingsRepository.delete(id);
  }
}
