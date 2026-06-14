import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('bookings')
@Unique(['amenityId', 'date', 'startTime'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  userId: string;

  @Column('text')
  amenityId: string;

  // ISO date string (yyyy-mm-dd)
  @Column('text')
  date: string;

  // HH:mm start time
  @Column('text')
  startTime: string;

  @Column('integer')
  slotLength: number;

  @Column({ type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkinEmailSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
