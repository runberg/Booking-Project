import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('building_units')
@Unique(['buildingId', 'unitNumber'])
export class BuildingUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  buildingId: string;

  @Column()
  unitNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}
