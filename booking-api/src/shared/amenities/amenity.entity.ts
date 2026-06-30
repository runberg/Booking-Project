import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('amenities')
@Unique(['name'])
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Stored as HH:mm (24h)
  @Column({ default: '09:00' })
  openTime: string;

  @Column({ default: '22:00' })
  closeTime: string;

  // Optional image URL
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  // Booking slot length in minutes (30, 60, 90, 120)
  @Column('integer', { default: 60 })
  slotLength: number;

  @Column({ default: true })
  isActive: boolean;

  // Optional restriction assignment
  @Column({ type: 'text', nullable: true })
  bookingRestrictionId: string | null;

  // Random token encoded in the physical QR code at the amenity location.
  // Regenerating this invalidates all printed QR codes.
  @Column({ type: 'text', nullable: true })
  qrToken: string | null;

  // Optional closure period — bookings blocked and calendar greyed out when active.
  @Column({ type: 'text', nullable: true })
  closureStart: string | null;

  @Column({ type: 'text', nullable: true })
  closureEnd: string | null;

  @Column({ default: false })
  closureActive: boolean;

  @Column({ type: 'text', nullable: true })
  closureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
