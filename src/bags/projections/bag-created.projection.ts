import { Injectable } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { BagCreatedEvent } from '../events';
import { ReadModelStoreService } from '../../shared/read-model.store';

@Injectable()
@EventsHandler(BagCreatedEvent)
export class BagCreatedProjectionHandler implements IEventHandler<BagCreatedEvent> {
  constructor(private readonly readModelStore: ReadModelStoreService) {}

  async handle(event: BagCreatedEvent) {
    await this.readModelStore.applyBagCreated({
      bagId: event.bagId,
      clientId: event.clientId,
      initialQuantity: event.initialQuantity,
      occurredAt: event.occurredAt,
    });
  }
}
