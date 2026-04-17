import { Injectable } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InvoiceConsumedEvent } from '../events';
import { ReadModelStoreService } from '../../shared/read-model.store';

@Injectable()
@EventsHandler(InvoiceConsumedEvent)
export class InvoiceConsumedProjectionHandler
  implements IEventHandler<InvoiceConsumedEvent>
{
  constructor(private readonly readModelStore: ReadModelStoreService) {}

  async handle(event: InvoiceConsumedEvent) {
    await this.readModelStore.applyInvoiceConsumed({
      bagId: event.bagId,
      clientId: event.clientId,
      quantity: event.quantity,
      occurredAt: event.occurredAt,
    });
  }
}
