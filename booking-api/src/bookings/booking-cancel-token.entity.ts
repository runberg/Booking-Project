import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('booking_cancel_tokens')
export class BookingCancelToken {
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
