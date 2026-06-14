import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('booking_logs')
@Index(['userEmail', 'createdAt'])
@Index(['action', 'createdAt'])
export class BookingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  action:
    | 'create'
    | 'delete'
    | 'login'
    | 'reminder_sent'
    | 'reminder_failed'
    | 'checkin_email_sent'
    | 'checkin_email_failed'
    | 'checked_in'
    | 'confirmation_failed';

  // Nullable for login events which have no associated booking
  @Column({ type: 'text', nullable: true })
  bookingId: string | null;

  @Column({ type: 'text', nullable: true })
  amenityName: string | null;

  @Column({ type: 'text', nullable: true })
  date: string | null;

  @Column({ type: 'text', nullable: true })
  startTime: string | null;

  @Column({ type: 'integer', nullable: true })
  slotLength: number | null;

  @Column('text')
  userId: string;

  @Column('text')
  userEmail: string;

  @Column('text')
  userName: string;

  @Column('text')
  building: string;

  @Column('text')
  apartmentNumber: string;

  @Column({ type: 'text', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
