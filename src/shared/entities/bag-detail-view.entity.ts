import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'bag_detail_view' })
export class BagDetailViewEntity {
  @PrimaryColumn({ name: 'bag_id', type: 'varchar', length: 100 })
  bagId!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 100 })
  clientId!: string;

  @Column({ name: 'initial_quantity', type: 'int' })
  initialQuantity!: number;

  @Column({ name: 'available_balance', type: 'int' })
  availableBalance!: number;

  @Column({ name: 'consumed_quantity', type: 'int', default: 0 })
  consumedQuantity!: number;

  @Column({ name: 'status', type: 'varchar', length: 30 })
  status!: string;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
