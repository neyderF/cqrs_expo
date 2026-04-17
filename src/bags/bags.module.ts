import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BagsController } from './bags.controller';
import { CreateBagHandler } from './handlers/create-bag.handler';
import { ConsumeInvoiceHandler } from './handlers/consume-invoice.handler';
import { GetClientConsolidatedHandler } from './handlers/get-client-consolidated.handler';
import { BagCreatedProjectionHandler } from './projections/bag-created.projection';
import { InvoiceConsumedProjectionHandler } from './projections/invoice-consumed.projection';
import { EventStoreService } from '../shared/event-store.service';
import { ReadModelStoreService } from '../shared/read-model.store';
import { EventEntity } from '../shared/entities/event.entity';
import { ClientBalanceViewEntity } from '../shared/entities/client-balance-view.entity';
import { BagDetailViewEntity } from '../shared/entities/bag-detail-view.entity';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([EventEntity, ClientBalanceViewEntity, BagDetailViewEntity]),
  ],
  controllers: [BagsController],
  providers: [
    EventStoreService,
    ReadModelStoreService,
    CreateBagHandler,
    ConsumeInvoiceHandler,
    GetClientConsolidatedHandler,
    BagCreatedProjectionHandler,
    InvoiceConsumedProjectionHandler,
  ],
})
export class BagsModule {}
