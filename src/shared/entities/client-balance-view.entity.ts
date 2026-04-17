import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_balance_view' })
export class ClientBalanceViewEntity {
  @PrimaryColumn({ name: 'client_id', type: 'varchar', length: 100 })
  clientId!: string;

  @Column({ name: 'total_available_balance', type: 'int', default: 0 })
  totalAvailableBalance!: number;

  @Column({ name: 'active_bags', type: 'int', default: 0 })
  activeBags!: number;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
