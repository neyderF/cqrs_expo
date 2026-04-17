import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientBalanceViewEntity } from './entities/client-balance-view.entity';
import { BagDetailViewEntity } from './entities/bag-detail-view.entity';

export interface ClientConsolidatedView {
  clientId: string;
  totalAvailableBalance: number;
  activeBags: number;
  bags: Array<{
    bagId: string;
    balance: number;
    initialQuantity: number;
    status: string;
  }>;
  updatedAt: string | null;
}

@Injectable()
export class ReadModelStoreService {
  constructor(
    @InjectRepository(ClientBalanceViewEntity)
    private readonly clientBalanceRepository: Repository<ClientBalanceViewEntity>,
    @InjectRepository(BagDetailViewEntity)
    private readonly bagDetailRepository: Repository<BagDetailViewEntity>,
  ) {}

  async applyBagCreated(event: {
    bagId: string;
    clientId: string;
    initialQuantity: number;
    occurredAt: string;
  }): Promise<void> {
    const clientView =
      (await this.clientBalanceRepository.findOne({ where: { clientId: event.clientId } })) ??
      this.clientBalanceRepository.create({
        clientId: event.clientId,
        totalAvailableBalance: 0,
        activeBags: 0,
        updatedAt: new Date(event.occurredAt),
      });

    clientView.totalAvailableBalance += event.initialQuantity;
    clientView.activeBags += 1;
    clientView.updatedAt = new Date(event.occurredAt);

    await this.clientBalanceRepository.save(clientView);

    const bagView = this.bagDetailRepository.create({
      bagId: event.bagId,
      clientId: event.clientId,
      initialQuantity: event.initialQuantity,
      availableBalance: event.initialQuantity,
      consumedQuantity: 0,
      status: 'ACTIVE',
      updatedAt: new Date(event.occurredAt),
    });

    await this.bagDetailRepository.save(bagView);
  }

  async applyInvoiceConsumed(event: {
    bagId: string;
    clientId: string;
    quantity: number;
    occurredAt: string;
  }): Promise<void> {
    const clientView = await this.clientBalanceRepository.findOne({
      where: { clientId: event.clientId },
    });
    const bagView = await this.bagDetailRepository.findOne({ where: { bagId: event.bagId } });

    if (!clientView || !bagView) {
      return;
    }

    bagView.availableBalance -= event.quantity;
    bagView.consumedQuantity += event.quantity;
    bagView.updatedAt = new Date(event.occurredAt);

    clientView.totalAvailableBalance -= event.quantity;
    clientView.updatedAt = new Date(event.occurredAt);

    if (bagView.availableBalance <= 0 && bagView.status !== 'DEPLETED') {
      bagView.status = 'DEPLETED';
      clientView.activeBags = Math.max(0, clientView.activeBags - 1);
    }

    await this.bagDetailRepository.save(bagView);
    await this.clientBalanceRepository.save(clientView);
  }

  async getClientConsolidated(clientId: string): Promise<ClientConsolidatedView> {
    const clientView = await this.clientBalanceRepository.findOne({ where: { clientId } });
    const bagViews = await this.bagDetailRepository.find({
      where: { clientId },
      order: { updatedAt: 'DESC' },
    });

    return {
      clientId,
      totalAvailableBalance: clientView?.totalAvailableBalance ?? 0,
      activeBags: clientView?.activeBags ?? 0,
      bags: bagViews.map((bag) => ({
        bagId: bag.bagId,
        balance: bag.availableBalance,
        initialQuantity: bag.initialQuantity,
        status: bag.status,
      })),
      updatedAt: clientView?.updatedAt?.toISOString() ?? null,
    };
  }
}
