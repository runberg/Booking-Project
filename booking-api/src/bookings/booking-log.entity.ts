import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('booking_logs')
export class BookingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  action: 'create' | 'delete';

  @Column('text')
  bookingId: string;

  @Column('text')
  amenityName: string;

  @Column('text')
  date: string; // YYYY-MM-DD

  @Column('text')
  startTime: string; // HH:mm

  @Column('integer')
  slotLength: number;

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

  @CreateDateColumn()
  createdAt: Date;
}


