import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('booking_checkin_tokens')
export class BookingCheckinToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  bookingId: string;

  @Index({ unique: true })
  @Column('text')
  token: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
