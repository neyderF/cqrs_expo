import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'events' })
export class EventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'varchar', length: 100 })
  id!: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 100 })
  aggregateId!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType!: string;

  @Column({ name: 'version', type: 'int' })
  version!: number;

  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType!: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
