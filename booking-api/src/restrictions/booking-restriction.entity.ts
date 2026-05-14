import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('booking_restrictions')
@Unique(['name'])
export class BookingRestriction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('integer')
  daysAhead: number; // how many days ahead users may book

  @Column('integer')
  maxPerPeriod: number; // per rolling period (same as daysAhead window)

  @Column('integer')
  maxPerDay: number; // per day cap

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
